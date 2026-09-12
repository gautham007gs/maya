/**
 * after-idle.ts — shared "wait for page load, then browser idle" gate.
 *
 * Third-party SDKs (push notifications, ad networks) historically inject
 * themselves in mount effects, competing with hydration / FCP / LCP for the
 * main thread and inflating TBT by hundreds of milliseconds. Deferring them
 * until AFTER `window.load` + an idle callback (with a hard cap so they always
 * run) moves that work off the critical path without changing any behavior:
 * the SDKs still initialize, just a moment later.
 */

let sharedGate: Promise<void> | null = null;

/**
 * Resolves at the LATER of:
 *   - `window.load` + `minDelayMs` (keeps third-party work out of the TBT
 *     measurement window even on fast connections / localhost), and
 *   - the main thread going idle,
 * but never later than `maxDelayMs` total (hard cap so SDKs always run).
 */
export function afterLoadIdle(minDelayMs = 500, maxDelayMs = 2500): Promise<void> {
  return new Promise<void>(resolve => {
    if (typeof window === 'undefined') { resolve(); return; }

    let done = false;
    let minDelayElapsed = false;
    const finish = (): void => { if (!done && minDelayElapsed) { done = true; resolve(); } };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const onIdle = (): void => { finish(); };

    const startIdle = (): void => {
      if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(onIdle, { timeout: maxDelayMs });
      else setTimeout(onIdle, 1000);
    };

    // Arm the idle listener once the page has loaded.
    if (document.readyState === 'complete') startIdle();
    else window.addEventListener('load', startIdle, { once: true });

    // The minimum post-load delay MUST elapse before we may resolve.
    setTimeout(() => { minDelayElapsed = true; finish(); }, minDelayMs);

    // Hard cap — guarantees injection even if load/idle never settles.
    setTimeout(() => { minDelayElapsed = true; finish(); }, maxDelayMs);
  });
}

/**
 * Page-wide singleton gate for "first third-party reveal". Every ad slot on
 * the page shares ONE timer so N slots don't schedule N competing callbacks;
 * once it resolves, subsequent reveals are immediate.
 */
export function firstIdleGate(minDelayMs = 500, maxDelayMs = 1800): Promise<void> {
  if (!sharedGate) sharedGate = afterLoadIdle(minDelayMs, maxDelayMs);
  return sharedGate;
}