/**
 * AI Ignore Feature — Global Admin Toggle
 *
 * Stored in app_configurations under id = 'ai_ignore_settings':
 *   { ignore_enabled: boolean }   // default: true (feature behaves normally)
 *
 * Behaviour:
 *   ignore_enabled = true   → existing micro-pause / busy logic runs exactly as before
 *   ignore_enabled = false  → the ignore feature is globally bypassed: Kruthika
 *                             replies to EVERY message immediately, even overriding
 *                             a micro-pause that was already running for a user.
 *
 * Caching: in-process TTL cache (10 s) so the per-message gate stays cheap.
 * Saving from the admin panel busts the cache instantly, so the change takes
 * effect on this server instance immediately and on any other instance within
 * the TTL window. If the DB read fails we FAIL OPEN to `true` (normal
 * behaviour) — a storage outage must never silently change chat behaviour.
 *
 * Pattern mirrors src/lib/voice-router.ts (voice_provider_settings).
 */

import { getMysqlClient } from './mysql-client';

const CONFIG_ID = 'ai_ignore_settings';
const CACHE_TTL_MS = 10_000; // 10 s — near-real-time without per-message DB hits

export interface AIIgnoreSettings {
  ignore_enabled: boolean;
}

let _cache: AIIgnoreSettings | null = null;
let _cachedAt = 0;

export async function getAIIgnoreSettings(): Promise<AIIgnoreSettings> {
  const now = Date.now();
  if (_cache && now - _cachedAt < CACHE_TTL_MS) return _cache;

  try {
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      `SELECT settings FROM app_configurations WHERE id = ? LIMIT 1`,
      [CONFIG_ID],
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const parsed = typeof rows[0].settings === 'string'
        ? JSON.parse(rows[0].settings)
        : rows[0].settings;
      // Merge over defaults so future new fields stay backward-compatible.
      _cache = { ignore_enabled: true, ...parsed };
      _cachedAt = now;
      return _cache!;
    }
  } catch (err) {
    // FAIL OPEN: behave like the feature is ON (normal behaviour).
    console.error('[AIIgnoreSettings] Failed to load settings — failing open:', err);
  }

  return { ignore_enabled: true };
}

/** Convenience gate check used by the two chat entry points. Never throws. */
export async function isAIIgnoreGloballyEnabled(): Promise<boolean> {
  try {
    return (await getAIIgnoreSettings()).ignore_enabled !== false;
  } catch {
    return true; // fail open
  }
}

export async function saveAIIgnoreSettings(
  patch: Partial<AIIgnoreSettings>,
): Promise<AIIgnoreSettings> {
  const current = await getAIIgnoreSettings();
  const merged = { ...current, ...patch };

  const db = await getMysqlClient();
  // No CAST(... AS JSON) — MySQL-only syntax, breaks on MariaDB (Hostinger).
  await db.query(
    `INSERT INTO app_configurations (id, settings)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE settings = ?`,
    [CONFIG_ID, JSON.stringify(merged), JSON.stringify(merged)],
  );

  // Bust cache — the admin toggle applies immediately on this instance.
  _cache = merged;
  _cachedAt = Date.now();
  console.log('[AIIgnoreSettings] Saved:', merged);
  return merged;
}
