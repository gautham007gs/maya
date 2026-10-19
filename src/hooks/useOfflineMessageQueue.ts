'use client';

import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = 'kruthika_offline_queue';

export interface QueuedMessage {
  id: string;
  text: string;
  imageUri?: string;
  queuedAt: number;
}

/**
 * Poll `check()` every 300 ms until it returns true or the deadline elapses.
 * Returns true if the condition was met, false if we timed out.
 */
async function waitUntil(check: () => boolean, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (!check()) {
    if (Date.now() >= deadline) return false;
    await new Promise<void>(res => setTimeout(res, 300));
  }
  return true;
}

/**
 * Persists unsent messages to localStorage while the user is offline.
 * Automatically re-hydrates on mount so the queue survives page refreshes.
 *
 * Usage:
 *   const { queue, enqueue, flush, count } = useOfflineMessageQueue();
 *
 *   // When offline — save instead of sending:
 *   enqueue(text, imageUri);
 *
 *   // When back online — replay with delivery confirmation:
 *   await flush(
 *     async (text, img) => { sendMsg(text, img); return true; },
 *     () => !isSendingRef.current,   // polled between sends
 *   );
 */
export function useOfflineMessageQueue() {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);

  // Load persisted queue on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as QueuedMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setQueue(parsed);
      }
    } catch {
      /* ignore parse errors */
    }
  }, []);

  /** Add a message to the queue (written through to localStorage immediately). */
  const enqueue = useCallback((text: string, imageUri?: string) => {
    const msg: QueuedMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      imageUri,
      queuedAt: Date.now(),
    };
    setQueue(prev => {
      const next = [...prev, msg];
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  /**
   * Send queued messages sequentially, one at a time, with delivery confirmation.
   *
   * @param sendFn  Must return `Promise<true>` when the send was accepted and
   *                `Promise<false>` when it was rejected (e.g. the app's own
   *                in-flight guard blocked it).  A message is dequeued from
   *                localStorage ONLY after `sendFn` resolves `true`.
   *
   * @param isReady Called before each send attempt; flush waits (polls every
   *                300 ms, up to 15 s) until it returns `true`.  Pass a
   *                getter for your app's "not currently sending" flag so
   *                sequential messages don't race each other.  If the check
   *                times out, the flush aborts and remaining items stay in
   *                storage for the next reconnect event.
   */
  const flush = useCallback(async (
    sendFn: (text: string, imageUri?: string) => Promise<boolean>,
    isReady: () => boolean = () => true,
  ) => {
    // Capture the queue at the moment flush is called; state is trimmed as we go.
    const snapshot = [...queue];
    if (!snapshot.length) return;

    for (const msg of snapshot) {
      // 1. Wait until the app is ready to send (isSendingRef cleared, etc.)
      const ready = await waitUntil(isReady, 15_000);
      if (!ready) {
        // Timed out — remaining items are still in localStorage; stop here.
        break;
      }

      // 2. Attempt delivery — sendFn returns true if accepted, false if rejected.
      const accepted = await sendFn(msg.text, msg.imageUri);
      if (!accepted) {
        // Rejected (e.g. a concurrent send won the race) — stop to avoid loss.
        break;
      }

      // 3. Dequeue THIS item only after confirmed acceptance.
      setQueue(prev => {
        const next = prev.filter(m => m.id !== msg.id);
        try {
          if (next.length === 0) localStorage.removeItem(QUEUE_KEY);
          else localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
    }
  }, [queue]);

  /** Remove all queued messages without sending them. */
  const clearQueue = useCallback(() => {
    setQueue([]);
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
  }, []);

  return { queue, enqueue, flush, clearQueue, count: queue.length };
}
