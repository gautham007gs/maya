import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { executeServerQuery, type QueryState } from '@/lib/dbServer';

// ── Access model ──────────────────────────────────────────────────────────────
// /api/db is now ADMIN-ONLY for every action. Public configuration reads go
// through /api/public-config (row-level allowlist); public analytics writes go
// through /api/analytics/batch (signed-cookie identity + server-side dbServer).
// There are no public CRUD surfaces left on this proxy.
const adminTables = new Set([
  'app_configurations',
  'ai_media_assets',
  'global_statuses',
  'managed_demo_contacts',
  'ad_settings',
  'api_keys',        // AI provider keys — admin-only write access
  'api_key_logs',    // Key usage logs — admin-only write access
]);

// Tables the admin analytics dashboard reads through this proxy (admin-only).
// They are NOT writable through the proxy — writes go via /api/analytics/batch.
const adminReadTables = new Set([
  'messages_log',
  'daily_activity_log',
  'user_sessions',
  'user_analytics',
  'page_views',
  'ad_interactions',
  'ad_revenue_log',
  'user_journey_steps',
  'cookie_consents',
  'daily_analytics',
  'ai_response_times',
]);

const allowedTables = new Set([...adminTables, ...adminReadTables]);

function isDbConnectionError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('access denied') ||
    lower.includes('econnrefused') ||
    lower.includes('connect timeout') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('connection refused') ||
    lower.includes('missing mysql') ||
    lower.includes('getaddrinfo')
  );
}

export async function POST(request: NextRequest) {
  try {
    // Every request — RPC, read, or write — requires a valid admin session.
    const session = await verifyAdminSession(request);
    if (!session.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as QueryState;

    if (!allowedTables.has(body.table)) {
      return NextResponse.json({ error: `Table '${body.table}' not allowed` }, { status: 400 });
    }

    // Writes are only permitted on admin tables through this proxy; analytics
    // writes must use /api/analytics/batch (which runs server-side SQL).
    const isWrite = ['insert', 'update', 'upsert', 'delete'].includes(body.action);
    if (isWrite && !adminTables.has(body.table)) {
      return NextResponse.json(
        { error: `Writes to '${body.table}' are not allowed via this proxy` },
        { status: 403 }
      );
    }

    const result = await executeServerQuery(body);

    // If an admin modified any configuration tables, immediately invalidate Redis & memory caches
    if (isWrite && (body.table === 'app_configurations' || body.table === 'ad_settings' || body.table === 'ai_media_assets')) {
      try {
        const { redisDel } = await import('@/lib/redis');
        const { invalidateLocalPublicConfig } = await import('@/lib/public-config-cache');
        invalidateLocalPublicConfig();
        await redisDel(['public_config:v1']);
      } catch {
        // Non-blocking
      }
    }

    if (result.error) {
      const msg = result.error.message || '';
      const msgLower = msg.toLowerCase();

      if (isDbConnectionError(msg)) {
        return NextResponse.json(
          { error: 'Database unavailable. Check Hostinger MySQL remote access whitelist.', db_down: true },
          { status: 503 }
        );
      }

      // Common MySQL schema errors — treat as "no data" rather than a failure.
      // Covers: table not found, unknown column, duplicate key, data too long,
      // incorrect value, field doesn't exist, etc.
      const isSchemaOrDataError =
        msgLower.includes("doesn't exist") ||
        msgLower.includes('table') ||
        msgLower.includes('unknown column') ||
        msgLower.includes('duplicate entry') ||
        msgLower.includes('data too long') ||
        msgLower.includes('incorrect') ||
        msgLower.includes('cannot be null') ||
        msgLower.includes('out of range');

      if (isSchemaOrDataError) {
        return NextResponse.json({ data: null, error: null }, { status: 200 });
      }

      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error: any) {
    const msg = error.message || 'Database request failed';
    if (isDbConnectionError(msg)) {
      return NextResponse.json(
        { error: 'Database unavailable. Check Hostinger MySQL remote access whitelist.', db_down: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
