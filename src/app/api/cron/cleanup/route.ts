/**
 * Cleanup / Data-Retention Cron — POST /api/cron/cleanup
 *
 * Runs daily housekeeping that should NOT live in the request path:
 *   1. Analytics retention purge (raw rows older than 90 days, batched).
 *   2. Stale shared rate-limit row cleanup.
 *
 * SECURITY: Requires `Authorization: Bearer <CRON_SECRET>`.
 *
 * SCHEDULING (Hostinger cron): daily at 03:00 IST (= 21:30 UTC previous day).
 *   Minute  Hour  Day  Month  Weekday
 *   30      21    *    *      *          ← UTC
 *
 * IDEMPOTENCY: one run per IST date; overlapping invocations are skipped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAnalyticsRetention } from '@/lib/analytics-retention';
import { cleanupStaleRateLimits } from '@/lib/shared-rate-limiter';
import { acquireCronRun, dailyRunKey } from '@/lib/cron-idempotency';
import { cronLockGate } from '@/lib/cron-lock-gate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runKey = dailyRunKey('cleanup');
  const lock = await acquireCronRun('cleanup', runKey);
  const blocked = cronLockGate(lock, runKey);
  if (blocked) return blocked;

  const summary: Record<string, any> = {
    startedAt: new Date().toISOString(),
    retention: null,
    rateLimits: { cleaned: 0 },
  };

  try {
    const retentionDays = Number(process.env.ANALYTICS_RETENTION_DAYS || 90);
    summary.retention = await runAnalyticsRetention({ retentionDays });
  } catch (err: any) {
    summary.retentionError = err?.message ?? String(err);
  }

  try {
    await cleanupStaleRateLimits(24 * 60 * 60 * 1000);
    summary.rateLimits = { cleaned: true };
  } catch (err: any) {
    summary.rateLimitsError = err?.message ?? String(err);
  }

  summary.finishedAt = new Date().toISOString();
  console.log('[Cron:cleanup] Completed:', summary);
  await lock.finish('done', summary);

  return NextResponse.json({ ok: true, ...summary });
}
