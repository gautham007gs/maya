import { NextRequest, NextResponse } from 'next/server';
import { testMysqlConnection } from '@/lib/mysql-client';

export async function GET(_request: NextRequest) {
  try {
    const { ok, error } = await testMysqlConnection();
    const dbStatus = ok ? 'healthy' : 'unhealthy';

    const configStatus = process.env.MYSQL_HOST &&
                        process.env.MYSQL_USER &&
                        process.env.MYSQL_DATABASE &&
                        process.env.ADMIN_EMAIL &&
                        process.env.ADMIN_SESSION_SECRET ? 'healthy' : 'unhealthy';

    const { getRedisHealth } = await import('@/lib/redis');
    const redisHealth = await getRedisHealth();

    const overall = dbStatus === 'healthy' && configStatus === 'healthy' ? 'healthy' : 'degraded';

    // Return 503 when degraded so monitoring tools / uptime checkers treat it
    // as an unhealthy endpoint rather than silently passing a 200.
    const httpStatus = overall === 'healthy' ? 200 : 503;

    return NextResponse.json({
      status: overall,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        database_error: error || null,
        config: configStatus,
        redis: redisHealth.status,
        redis_latency_ms: redisHealth.latencyMs ?? null,
        redis_circuit_open: redisHealth.circuitOpen,
        memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB',
      },
      uptime: process.uptime().toFixed(1) + 's',
    }, { status: httpStatus });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
