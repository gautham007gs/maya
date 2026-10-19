/**
 * Page-level mutex for ad script injection.
 *
 * WHY THIS EXISTS
 * ---------------
 * Adsterra banner codes work by calling `document.write('<iframe …>')` from an
 * external script (invoke.js). We intercept that call by temporarily replacing
 * the global `document.write` with a closure that routes the output into our
 * specific container div. The override is active for ~3 s (the SDK bootstrap
 * window) and then restored.
 *
 * Problem: when two `BannerAdDisplay` instances inject their ad codes at the
 * same time (e.g. the left and right desktop rails that both mount in the same
 * React render cycle), each installs its own override. The *last* override wins.
 * When the first component's async Adsterra script fires `document.write`, the
 * active override belongs to the *second* component, so the creative lands in
 * the wrong container. Result: one rail empty, the other doubled.
 *
 * Solution: a simple FIFO queue. Only one injection runs at a time. The current
 * injection calls `releaseInjectionLock()` once its 3.5 s window closes, which
 * dequeues and starts the next one. Slots that are cancelled while waiting
 * (component unmounted) are skipped without blocking the queue.
 *
 * DURATION
 * --------
 * Each injection holds the lock for 3 500 ms — 500 ms more than the 3 000 ms
 * `document.write` override window — so the restore timer always fires *before*
 * the next injection installs its own override.
 */

export const INJECTION_LOCK_DURATION_MS = 800;

type LockItem = { fn: () => void; cancelled: boolean; priority?: boolean };

let locked = false;
const queue: LockItem[] = [];

/**
 * Attempt to run `fn` inside the exclusive injection window.
 * - If the lock is free, `fn` runs immediately and the lock is acquired.
 * - If the lock is busy, `fn` is queued and will run once earlier injections
 *   finish. Priority items jump to the front of the wait list.
 *
 * Returns a cancel function. Call it if the component unmounts while waiting;
 * the queued item will be skipped without blocking other injections.
 */
export function acquireInjectionLock(fn: () => void, priority = false): () => void {
  const item: LockItem = { fn, cancelled: false, priority };

  if (!locked) {
    locked = true;
    fn(); // run immediately — lock is held until releaseInjectionLock() is called
  } else if (priority) {
    queue.unshift(item); // priority slots (e.g. homepage-between-chats) jump to front
  } else {
    queue.push(item);
  }

  return () => {
    item.cancelled = true; // mark for skip if still queued
  };
}

/**
 * Release the lock. The caller MUST invoke this once its injection window has
 * closed — either after the restore timer fires or on early cleanup (unmount).
 */
export function releaseInjectionLock(): void {
  // Drain cancelled items, then run the next live one
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (!next.cancelled) {
      next.fn(); // lock stays held; next.fn is responsible for calling release
      return;
    }
    // else: cancelled — skip and loop to next candidate
  }
  // No live items remain
  locked = false;
}
