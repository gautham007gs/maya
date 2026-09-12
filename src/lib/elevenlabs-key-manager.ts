/**
 * ElevenLabs Key Manager
 *
 * Manages a rotating pool of ElevenLabs API keys from two sources:
 *   1. Environment variables: ELEVENLABS_API_KEY_1 … ELEVENLABS_API_KEY_20
 *   2. Admin panel DB keys:   elevenlabs_admin_keys table
 *
 * Rotation strategy (mirrors sarvam-key-manager):
 *   - Env keys tried first (slot order), then DB admin keys.
 *   - 402 (quota hit) or 401 (invalid/banned):
 *       • Env keys  → marked exhausted in elevenlabs_api_keys (skipped in future)
 *       • DB keys   → DELETED from elevenlabs_admin_keys
 *   - 429 (rate-limited) → caller should wait+retry, key NOT exhausted
 */

import { getMysqlClient } from './mysql-client';
import { decryptSecret } from './key-encryption';

const MAX_ENV_KEYS = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function elKeyFingerprint(key: string): string {
  if (key.length <= 14) return key.slice(0, 4) + '…';
  return `${key.slice(0, 6)}…${key.slice(-8)}`;
}

export function elKeyHash(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h = h >>> 0;
  }
  return 'el_' + h.toString(16).padStart(8, '0') + key.slice(-6);
}

function getAllEnvKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= MAX_ENV_KEYS; i++) {
    const k = process.env[`ELEVENLABS_API_KEY_${i}`];
    if (k?.trim()) keys.push(k.trim());
  }
  return keys;
}

function isEnvKey(key: string): boolean {
  for (let i = 1; i <= MAX_ENV_KEYS; i++) {
    const k = process.env[`ELEVENLABS_API_KEY_${i}`]?.trim();
    if (k && k === key) return true;
  }
  return false;
}

// ── DB init ───────────────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

export async function getActiveElevenLabsKey(): Promise<string | null> {
  try {
    const db = await getMysqlClient();
    await ensureTables(db);

    // 1. Env keys
    const envKeys = getAllEnvKeys();
    if (envKeys.length > 0) {
      const hashes = envKeys.map(elKeyHash);
      const [exhaustedRows]: any = await db.query(
        `SELECT key_hash FROM elevenlabs_api_keys WHERE key_hash IN (${hashes.map(() => '?').join(',')}) AND is_exhausted = 1`,
        hashes
      ).catch(() => [[]]);

      const exhaustedSet = new Set((exhaustedRows as any[]).map((r: any) => r.key_hash));

      for (const key of envKeys) {
        if (!exhaustedSet.has(elKeyHash(key))) {
          await db.query(
            `INSERT IGNORE INTO elevenlabs_api_keys (key_hash, key_prefix) VALUES (?, ?)`,
            [elKeyHash(key), elKeyFingerprint(key)]
          ).catch(() => {});
          return key;
        }
      }
    }

    // 2. DB admin keys
    const [dbRows]: any = await db.query(
      `SELECT key_value FROM elevenlabs_admin_keys WHERE is_exhausted = 0 ORDER BY id ASC LIMIT 1`
    ).catch(() => [[]]);

    if (Array.isArray(dbRows) && dbRows.length > 0) {
      const stored = (dbRows[0] as any).key_value as string;
      try {
        // Decrypt only immediately before use — never cache the plaintext.
        return decryptSecret(stored);
      } catch (err) {
        console.error('[ElevenLabsKeys] Failed to decrypt DB key, skipping:', (err as Error).message);
      }
    }

    console.error('[ElevenLabsKeys] All API keys exhausted or none configured.');
    return null;
  } catch (err) {
    console.error('[ElevenLabsKeys] DB error, falling back to first env key:', err);
    return getAllEnvKeys()[0] ?? null;
  }
}

export async function exhaustElevenLabsKey(apiKey: string): Promise<string | null> {
  console.log(`[ElevenLabsKeys] Exhausting key ${elKeyFingerprint(apiKey)} — rotating.`);
  try {
    const db = await getMysqlClient();
    await ensureTables(db);

    if (isEnvKey(apiKey)) {
      const hash = elKeyHash(apiKey);
      await db.query(
        `INSERT INTO elevenlabs_api_keys (key_hash, key_prefix, is_exhausted, exhausted_at)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE is_exhausted = 1, exhausted_at = NOW()`,
        [hash, elKeyFingerprint(apiKey)]
      );
    } else {
      await db.query(
        'DELETE FROM elevenlabs_admin_keys WHERE key_hash = ?',
        [elKeyHash(apiKey)]
      );
    }
  } catch (err) {
    console.error('[ElevenLabsKeys] Failed to exhaust key in DB:', err);
  }
  return getActiveElevenLabsKey();
}

export async function getElevenLabsKeyPoolStatus(): Promise<{
  total: number;
  active: number;
  exhausted: number;
  keys: { id: number; label: string; prefix: string; exhausted: boolean; exhaustedAt: string | null; source: 'env' | 'db'; createdAt: string | null }[];
}> {
  const envKeys = getAllEnvKeys();
  try {
    const db = await getMysqlClient();
    await ensureTables(db);

    const [envRows]: any = await db.query(
      'SELECT key_hash, key_prefix, is_exhausted, exhausted_at FROM elevenlabs_api_keys ORDER BY id'
    ).catch(() => [[]]);
    const envStatusMap = new Map<string, any>();
    for (const r of (envRows as any[])) envStatusMap.set(r.key_hash, r);

    const envSummary = envKeys.map((key, idx) => {
      const status = envStatusMap.get(elKeyHash(key));
      return {
        id: -(idx + 1), // negative = env
        label: `ELEVENLABS_API_KEY_${idx + 1}`,
        prefix: elKeyFingerprint(key),
        exhausted: status ? !!status.is_exhausted : false,
        exhaustedAt: status?.exhausted_at ? new Date(status.exhausted_at).toISOString() : null,
        source: 'env' as const,
        createdAt: null,
      };
    });

    const [dbRows]: any = await db.query(
      'SELECT id, label, key_prefix, is_exhausted, exhausted_at, created_at FROM elevenlabs_admin_keys ORDER BY id'
    ).catch(() => [[]]);
    const dbSummary = (dbRows as any[]).map(r => ({
      id: r.id as number,
      label: r.label as string,
      prefix: r.key_prefix as string,
      exhausted: !!r.is_exhausted,
      exhaustedAt: r.exhausted_at ? new Date(r.exhausted_at).toISOString() : null,
      source: 'db' as const,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));

    const allKeys = [...envSummary, ...dbSummary];
    const active = allKeys.filter(k => !k.exhausted).length;
    return { total: allKeys.length, active, exhausted: allKeys.length - active, keys: allKeys };
  } catch {
    return { total: envKeys.length, active: envKeys.length, exhausted: 0, keys: [] };
  }
}
