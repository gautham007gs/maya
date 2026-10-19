/**
 * Sarvam AI Key Manager
 *
 * Manages a rotating pool of Sarvam API keys from two sources:
 *   1. Environment variables: SARVAM_API_KEY_1 … SARVAM_API_KEY_20
 *   2. Admin panel DB keys:   sarvam_admin_keys table
 *
 * Rotation strategy:
 *   - Env keys are tried first (in slot order), then DB admin keys.
 *   - When a key hits 402 (credits exhausted):
 *       • Env keys → marked exhausted in sarvam_api_keys (stays in env, just skipped)
 *       • DB keys  → DELETED from sarvam_admin_keys (zero value once credits gone)
 *   - New DB keys added via admin panel are picked up immediately — no restart needed.
 */

import { getMysqlClient } from './mysql-client';
import { decryptSecret } from './key-encryption';

const MAX_ENV_KEYS = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic short fingerprint of a key for DB storage (not reconstructible). */
export function keyFingerprint(key: string): string {
  return `${key.slice(0, 6)}…${key.slice(-8)}`;
}

/** Stable lookup hash for DB keyed lookup. */
export function keyHash(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h.toString(16).padStart(8, '0') + key.slice(-6);
}

/** All keys configured in environment variables (slot → value). */
function getAllEnvKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= MAX_ENV_KEYS; i++) {
    const k = process.env[`SARVAM_API_KEY_${i}`];
    if (k?.trim()) keys.push(k.trim());
  }
  return keys;
}

/** Check if a given key value is from an env var. */
function isEnvKey(key: string): boolean {
  for (let i = 1; i <= MAX_ENV_KEYS; i++) {
    const k = process.env[`SARVAM_API_KEY_${i}`]?.trim();
    if (k && k === key) return true;
  }
  return false;
}

// ── DB init (lazy) ────────────────────────────────────────────────────────────

async function ensureTables(db: any) {
  // Env-key exhaustion tracker (key value never stored)
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

  // Admin-panel–added keys (full value stored; deleted when exhausted)
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the first non-exhausted Sarvam API key.
 * Tries env keys first, then DB admin-added keys.
 * Returns null if no keys are available.
 */
export async function getActiveSarvamKey(): Promise<string | null> {
  try {
    const db = await getMysqlClient();
    await ensureTables(db);

    // ── 1. Env keys ───────────────────────────────────────────────────────
    const envKeys = getAllEnvKeys();
    if (envKeys.length > 0) {
      // Load all exhaustion records in one query
      const hashes = envKeys.map(keyHash);
      const [exhaustedRows]: any = await db.query(
        `SELECT key_hash FROM sarvam_api_keys WHERE key_hash IN (${hashes.map(() => '?').join(',')}) AND is_exhausted = 1`,
        hashes
      ).catch(() => [[]]);

      const exhaustedSet = new Set((exhaustedRows as any[]).map((r: any) => r.key_hash));

      for (const key of envKeys) {
        if (!exhaustedSet.has(keyHash(key))) {
          // Register this key if not yet seen (for tracking)
          await db.query(
            `INSERT IGNORE INTO sarvam_api_keys (key_hash, key_prefix) VALUES (?, ?)`,
            [keyHash(key), keyFingerprint(key)]
          ).catch(() => {});
          return key;
        }
      }
    }

    // ── 2. DB admin keys ──────────────────────────────────────────────────
    const [dbRows]: any = await db.query(
      `SELECT key_value FROM sarvam_admin_keys WHERE is_exhausted = 0 ORDER BY id ASC LIMIT 1`
    ).catch(() => [[]]);

    if (Array.isArray(dbRows) && dbRows.length > 0) {
      const stored = (dbRows[0] as any).key_value as string;
      try {
        // Decrypt only immediately before use — never cache the plaintext.
        return decryptSecret(stored);
      } catch (err) {
        console.error('[SarvamKeys] Failed to decrypt DB key, skipping:', (err as Error).message);
      }
    }

    console.error('[SarvamKeys] All API keys are exhausted or none configured.');
    return null;
  } catch (err) {
    // DB unavailable — try first env key as fallback
    console.error('[SarvamKeys] DB error, falling back to first env key:', err);
    const fallback = getAllEnvKeys()[0];
    return fallback ?? null;
  }
}

/**
 * Marks a key as exhausted (credits used up — 402 response).
 *
 * Env keys  → marked exhausted in sarvam_api_keys (preserved in env, just skipped)
 * DB keys   → DELETED from sarvam_admin_keys (no value once 100 free credits are gone)
 *
 * Returns the next available key, or null if none remain.
 */
export async function exhaustKey(apiKey: string): Promise<string | null> {
  console.log(`[SarvamKeys] Exhausting key ${keyFingerprint(apiKey)} — rotating to next.`);

  try {
    const db = await getMysqlClient();
    await ensureTables(db);

    if (isEnvKey(apiKey)) {
      // Env key: mark exhausted in tracker table
      const hash = keyHash(apiKey);
      await db.query(
        `INSERT INTO sarvam_api_keys (key_hash, key_prefix, is_exhausted, exhausted_at)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE is_exhausted = 1, exhausted_at = NOW()`,
        [hash, keyFingerprint(apiKey)]
      );
      console.log(`[SarvamKeys] Env key ${keyFingerprint(apiKey)} marked exhausted.`);
    } else {
      // DB key: delete it — exhausted DB keys have zero value
      const hash = keyHash(apiKey);
      const [result]: any = await db.query(
        'DELETE FROM sarvam_admin_keys WHERE key_hash = ?',
        [hash]
      );
      const deleted = result?.affectedRows ?? 0;
      console.log(`[SarvamKeys] DB key ${keyFingerprint(apiKey)} deleted (exhausted, ${deleted} row${deleted !== 1 ? 's' : ''} removed).`);
    }
  } catch (err) {
    console.error('[SarvamKeys] Failed to exhaust key in DB:', err);
  }

  // Return next active key (current key is now exhausted/deleted)
  return getActiveSarvamKey();
}

/**
 * Returns a summary of key pool health (for admin status display).
 */
export async function getKeyPoolStatus(): Promise<{
  total: number;
  active: number;
  exhausted: number;
  keys: { prefix: string; exhausted: boolean; exhaustedAt: string | null; source: 'env' | 'db' }[];
}> {
  const envKeys = getAllEnvKeys();
  try {
    const db = await getMysqlClient();
    await ensureTables(db);

    // Env key exhaustion status
    const [envRows]: any = await db.query(
      'SELECT key_hash, key_prefix, is_exhausted, exhausted_at FROM sarvam_api_keys ORDER BY id'
    ).catch(() => [[]]);
    const envStatusMap = new Map<string, any>();
    for (const r of (envRows as any[])) envStatusMap.set(r.key_hash, r);

    const envSummary = envKeys.map(key => {
      const status = envStatusMap.get(keyHash(key));
      return {
        prefix: keyFingerprint(key),
        exhausted: status ? !!status.is_exhausted : false,
        exhaustedAt: status?.exhausted_at ? new Date(status.exhausted_at).toISOString() : null,
        source: 'env' as const,
      };
    });

    // DB admin key status
    const [dbRows]: any = await db.query(
      'SELECT key_prefix, is_exhausted, exhausted_at FROM sarvam_admin_keys ORDER BY id'
    ).catch(() => [[]]);
    const dbSummary = (dbRows as any[]).map(r => ({
      prefix: r.key_prefix as string,
      exhausted: !!r.is_exhausted,
      exhaustedAt: r.exhausted_at ? new Date(r.exhausted_at).toISOString() : null,
      source: 'db' as const,
    }));

    const allKeys = [...envSummary, ...dbSummary];
    const active = allKeys.filter(k => !k.exhausted).length;
    return { total: allKeys.length, active, exhausted: allKeys.length - active, keys: allKeys };
  } catch {
    return { total: envKeys.length, active: envKeys.length, exhausted: 0, keys: [] };
  }
}
