/**
 * POST /api/admin/api-keys/providers
 * Toggle a provider on or off. Requires admin session.
 * Body: { provider: string, enabled: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { verifyAdminSession } from '@/lib/admin-auth';
import { invalidateKeysCache, PROVIDER_ORDER } from '@/ai/multi-provider';

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { provider, enabled } = body;
  if (!provider || typeof enabled !== 'boolean')
    return NextResponse.json({ error: 'provider and enabled (boolean) required' }, { status: 400 });
  if (!PROVIDER_ORDER.includes(provider))
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });

  try {
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      `SELECT settings FROM app_configurations WHERE id = 'provider_settings' LIMIT 1`
    );
    let settings: Record<string, boolean> = Object.fromEntries(PROVIDER_ORDER.map(p => [p, true]));
    if (rows?.[0]?.settings) {
      try {
        const raw = rows[0].settings;
        settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
    }
    settings[provider] = enabled;

    const json = JSON.stringify(settings);
    // No CAST(... AS JSON) — MySQL-only syntax, breaks on MariaDB (Hostinger).
    await db.query(
      `INSERT INTO app_configurations (id, settings) VALUES ('provider_settings', ?)
       ON DUPLICATE KEY UPDATE settings = ?`,
      [json, json]
    );
    invalidateKeysCache();
    return NextResponse.json({ success: true, provider, enabled });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
