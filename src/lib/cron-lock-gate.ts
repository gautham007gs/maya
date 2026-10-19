import { NextResponse } from 'next/server';
import type { CronRunResult } from '@/lib/cron-idempotency';

/** Returns a NextResponse when the cron job must not run; null when it may proceed. */
export function cronLockGate(
  lock: CronRunResult,
  runKey: string,
): NextResponse | null {
  if (lock.lockUnavailable) {
    return NextResponse.json(
      { error: 'Cron idempotency lock unavailable — job aborted', runKey },
      { status: 503 },
    );
  }
  if (!lock.acquired) {
    return NextResponse.json({
      skipped: true,
      reason: lock.alreadyDone
        ? 'Already completed for this run key (idempotent skip).'
        : 'Another run is still in progress (concurrent skip).',
      runKey,
    });
  }
  return null;
}
