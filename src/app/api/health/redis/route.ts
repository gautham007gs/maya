import { NextRequest, NextResponse } from 'next/server';
import { getRedisHealth, redisGet, redisSet, redisDel } from '@/lib/redis';
import { verifyAdminSession } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/shared-rate-limiter';
import { getClientIp } from '@/lib/session-identity';

/**
 * GET /api/health/redis
 *
 * Public callers get only a minimal, sanitized status (no internal error
 * strings, no failure counters, no command-usage numbers) and can never
 * trigger the write/read/delete test - that would let anyone burn Upstash
 * free-tier commands by hammering this endpoint. Admins (verified session)
 * get the full diagnostic payload and may pass ?test=1 to run a real
 * SET/GET/DEL round-trip.
 */
export async function GET(request: NextRequest) {
  // Cheap IP-based guard so even the minimal public response can't be spammed
  // for free - this itself costs zero Redis commands.
  const ip = getClientIp(request);
  const rl = await checkRateLimit('health_redis', ip, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const session = await verifyAdminSession(request);
  const isAdmin = session.isValid;

  const url = new URL(request.url);
  const wantsTest = url.searchParams.get('test') === '1';

  const health = await getRedisHealth();

  if (!isAdmin) {
    // Minimal, sanitized public response - no internals, no test round-trip.
    return NextResponse.json({
      status: health.status === 'connected' ? 'connected' : 'unavailable',
    });
  }

  let testResult: { write: boolean; read: boolean; delete: boolean } | null = null;
  if (wantsTest && health.status === 'connected') {
    const testKey = 'test:ping:' + Date.now();
    const testValue = { ping: 'pong', timestamp: Date.now() };

    const writeOk = await redisSet(testKey, testValue, { ex: 30 });
    const readVal = await redisGet<{ ping: string }>(testKey);
    const readOk = readVal?.ping === 'pong';
    const deleteOk = await redisDel(testKey);

    testResult = { write: writeOk, read: readOk, delete: deleteOk };
  }

  return NextResponse.json({
    status: health.status,
    configured: health.configured,
    latency_ms: health.latencyMs ?? null,
    circuit_open: health.circuitOpen,
    failure_count: health.failureCount,
    last_error: health.lastError,
    approx_commands_this_window: health.approxCommandsThisWindow ?? null,
    test: testResult,
    timestamp: new Date().toISOString(),
  });
}
