/**
 * Message Log Queue — client-side batching for messages_log inserts.
 *
 * Instead of one POST /api/db per message, rows are queued and flushed in a
 * single batch INSERT every FLUSH_INTERVAL ms (or when the buffer fills).
 * This reduces DB round-trips from 2-3 per message exchange to ~1 per 10s.
 */

export interface MessageLogRow {
  message_id: string;
  sender_type: 'user' | 'ai' | 'ai_proactive';
  chat_id: string;
  text_content: string;
  has_image: boolean;
}

const FLUSH_INTERVAL = 10_000; // 10 seconds
const MAX_QUEUE_SIZE = 8;      // flush early if queue fills

let queue: MessageLogRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

/** Add a row to the queue; schedules a flush if one isn't already pending. */
export function queueMessageLog(row: MessageLogRow): void {
  if (typeof window === 'undefined') return;
  queue.push(row);
  if (queue.length >= MAX_QUEUE_SIZE) {
    flushNow();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushNow, FLUSH_INTERVAL);
  }
}

/** Force an immediate flush (e.g. on page unload). */
export function flushMessageLogQueue(): void {
  flushNow();
}

async function flushNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0 || flushing) return;

  const batch = queue.splice(0, queue.length);
  flushing = true;

  try {
    await fetch('/api/log/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: batch }),
      // keepalive lets the request survive page unload
      keepalive: true,
    });
  } catch {
    // Non-critical — analytics loss is acceptable
  } finally {
    flushing = false;
  }
}

// Flush on page unload so we don't lose the last few messages
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
  window.addEventListener('pagehide', flushNow);
}
