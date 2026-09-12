/**
 * GET  /api/admin/sarvam-keys  — list all keys (env + DB), with exhaustion status
 * POST /api/admin/sarvam-keys  — add a new key to the DB pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { encryptSecret } from '@/lib/key-encryption';

const MAX_KEYS = 20; // env var ceiling

// ── Helpers ───────────────────────────────────────────────────────────────────

function keyFingerprint(key: string): string {
  if (key.length <= 14) return key.slice(0, 4) + '…';
  return `${key.slice(0, 6)}…${key.slice(-8)}`;
}

function keyHash(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0') + key.slice(-6);
}

function getAllEnvKeys(): Array<{ slot: number; key: string }> {
  const out: Array<{ slot: number; key: string }> = [];
  for (let i = 1; i <= MAX_KEYS; i++) {
    const k = process.env[`SARVAM_API_KEY_${i}`];
    if (k?.trim()) out.push({ slot: i, key: k.trim() });
  }
  return out;
}

async function ensureTable(db: any) {
  // sarvam_api_keys — exhaustion tracker for env-var keys (may already exist)
  await db.query(`
    CREATE TABLE IF NOT EXISTS sarvam_api_keys (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      key_hash     VARCHAR(32)  NOT NULL UNIQUE,
      key_prefix   VARCHAR(30)  NOT NULL,
      is_exhausted TINYINT(1)   NOT NULL DEFAULT 0,
      exhausted_at TIMESTAMP    NULL,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});

  // sarvam_admin_keys — keys added via admin panel (full value stored)
  await db.query(`
    CREATE TABLE IF NOT EXISTS sarvam_admin_keys (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      label        VARCHAR(100) NOT NULL,
      key_value    TEXT         NOT NULL,
      key_hash     VARCHAR(32)  NOT NULL UNIQUE,
      key_prefix   VARCHAR(30)  NOT NULL,
      is_exhausted TINYINT(1)   NOT NULL DEFAULT 0,
      exhausted_at TIMESTAMP    NULL,
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, 'api_keys');
  if (!auth.ok) return auth.response;

  try {
    const db = await getMysqlClient();
    await ensureTable(db);

    // Load exhaustion status for env keys
    const [envStatusRows]: any = await db.query(
      'SELECT key_hash, is_exhausted, exhausted_at FROM sarvam_api_keys'
    );
    const envStatusMap = new Map<string, { exhausted: boolean; exhaustedAt: string | null }>();
    for (const row of (envStatusRows as any[])) {
      envStatusMap.set(row.key_hash, {
        exhausted: !!row.is_exhausted,
        exhaustedAt: row.exhausted_at ? new Date(row.exhausted_at).toISOString() : null,
      });
    }

    // Build env key list
    const envKeyEntries = getAllEnvKeys();
    const envKeys = envKeyEntries.map(({ slot, key }, _i) => {
      const hash = keyHash(key);
      const status = envStatusMap.get(hash);
      return {
        id: -(slot),           // negative IDs = env keys
        label: `SARVAM_API_KEY_${slot}`,
        prefix: keyFingerprint(key),
        isExhausted: status?.exhausted ?? false,
        exhaustedAt: status?.exhaustedAt ?? null,
        source: 'env' as const,
        createdAt: null,
      };
    });

    // Load admin-added DB keys
    const [dbRows]: any = await db.query(
      'SELECT id, label, key_prefix, is_exhausted, exhausted_at, created_at FROM sarvam_admin_keys ORDER BY id ASC'
    );
    const dbKeys = (dbRows as any[]).map(r => ({
      id: r.id,
      label: r.label,
      prefix: r.key_prefix,
      isExhausted: !!r.is_exhausted,
      exhaustedAt: r.exhausted_at ? new Date(r.exhausted_at).toISOString() : null,
      source: 'db' as const,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));

    const allKeys = [...envKeys, ...dbKeys];
    const activeCount = allKeys.filter(k => !k.isExhausted).length;
    const exhaustedCount = allKeys.filter(k => k.isExhausted).length;

    return NextResponse.json({
      keys: allKeys,
      pool: { total: allKeys.length, active: activeCount, exhausted: exhaustedCount },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, 'api_keys');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { label, value } = body;

    if (!label?.trim() || !value?.trim())
      return NextResponse.json({ error: 'label and value are required' }, { status: 400 });
    if (value.trim().length < 10)
      return NextResponse.json({ error: 'Key value too short' }, { status: 400 });

    const db = await getMysqlClient();
    await ensureTable(db);

    const trimmedKey = value.trim();
    const hash = keyHash(trimmedKey);
    const prefix = keyFingerprint(trimmedKey);

    // Check for duplicate
    const [existing]: any = await db.query(
      'SELECT id FROM sarvam_admin_keys WHERE key_hash = ?', [hash]
    );
    if ((existing as any[]).length > 0)
      return NextResponse.json({ error: 'This key is already in the pool' }, { status: 409 });

    // Also check env keys
    const envKeys = getAllEnvKeys();
    for (const { key } of envKeys) {
      if (keyHash(key) === hash)
        return NextResponse.json({ error: 'This key is already configured as an environment variable' }, { status: 409 });
    }

    const [result]: any = await db.query(
      `INSERT INTO sarvam_admin_keys (label, key_value, key_hash, key_prefix) VALUES (?, ?, ?, ?)`,
      [label.trim().substring(0, 100), encryptSecret(trimmedKey), hash, prefix]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
