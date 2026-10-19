/**
 * GET  /api/admin/elevenlabs-keys — list all ElevenLabs keys (env + DB)
 * POST /api/admin/elevenlabs-keys — add a new key to the DB pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { encryptSecret } from '@/lib/key-encryption';
import { elKeyFingerprint, elKeyHash, getElevenLabsKeyPoolStatus } from '@/lib/elevenlabs-key-manager';

const MAX_DB_KEYS = 20;

async function ensureTables(db: any) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS elevenlabs_api_keys (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      key_hash     VARCHAR(40)  NOT NULL UNIQUE,
      key_prefix   VARCHAR(30)  NOT NULL,
      is_exhausted TINYINT(1)   NOT NULL DEFAULT 0,
      exhausted_at TIMESTAMP    NULL,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  await db.query(`
    CREATE TABLE IF NOT EXISTS elevenlabs_admin_keys (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      label        VARCHAR(100) NOT NULL,
      key_value    TEXT         NOT NULL,
      key_hash     VARCHAR(40)  NOT NULL UNIQUE,
      key_prefix   VARCHAR(30)  NOT NULL,
      is_exhausted TINYINT(1)   NOT NULL DEFAULT 0,
      exhausted_at TIMESTAMP    NULL,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminPermission(req, 'api_keys');
  if (!auth.ok) return auth.response;

  const pool = await getElevenLabsKeyPoolStatus();
  return NextResponse.json({ pool: { total: pool.total, active: pool.active, exhausted: pool.exhausted }, keys: pool.keys });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminPermission(req, 'api_keys');
  if (!auth.ok) return auth.response;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const label = body?.label?.toString().trim();
  const value = body?.value?.toString().trim();

  if (!label || !value) return NextResponse.json({ error: 'label and value are required' }, { status: 400 });
  if (value.length < 10) return NextResponse.json({ error: 'ElevenLabs keys start with sk_ and are longer than 10 chars' }, { status: 400 });

  try {
    const db = await getMysqlClient();
    await ensureTables(db);

    // Check DB key count limit
    const [countRows]: any = await db.query('SELECT COUNT(*) AS cnt FROM elevenlabs_admin_keys WHERE is_exhausted = 0');
    const activeCount = (countRows as any[])[0]?.cnt ?? 0;
    if (activeCount >= MAX_DB_KEYS) {
      return NextResponse.json({ error: `Maximum ${MAX_DB_KEYS} active DB keys allowed` }, { status: 400 });
    }

    const hash   = elKeyHash(value);
    const prefix = elKeyFingerprint(value);

    await db.query(
      `INSERT INTO elevenlabs_admin_keys (label, key_value, key_hash, key_prefix)
       VALUES (?, ?, ?, ?)`,
      [label, encryptSecret(value), hash, prefix]
    );

    return NextResponse.json({ success: true, prefix });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'This key is already in the pool' }, { status: 409 });
    }
    console.error('[EL keys POST]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
