/**
 * Per-provider MODEL management (admin-editable).
 *
 * Models change frequently — providers decommission them every few weeks. This
 * lets the admin update each provider's model cascade from Admin → AI Keys
 * WITHOUT a code deploy. Stored in app_configurations under
 * id = 'provider_models_v1':
 *
 *   { "groq": ["openai/gpt-oss-120b", "openai/gpt-oss-20b"], ... }
 *
 * Semantics:
 *   - An override REPLACES the built-in default cascade for that provider.
 *   - Order matters: first model is tried first; failures fall through the list.
 *   - No entry (or empty list) → built-in defaults are used.
 *
 * Real-time: 10 s in-process TTL cache + explicit bust on save (the admin PUT
 * also invalidates the multi-provider caches so the next chat request uses the
 * new models immediately on this instance, within ~10 s on any other instance).
 */

import { getMysqlClient } from './mysql-client';

export const CONFIG_ID = 'provider_models_v1';
const CACHE_TTL_MS = 10_000;
export const MAX_MODELS_PER_PROVIDER = 12;

export type ProviderModels = Record<string, string[]>;

let _cache: ProviderModels | null = null;
let _cachedAt = 0;

export function bustProviderModels(): void {
  _cache = null;
  _cachedAt = 0;
}

/** Keep only valid, non-empty, bounded strings; drop everything else. */
function sanitise(raw: unknown): ProviderModels {
  const out: ProviderModels = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [provider, models] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(models)) continue;
    const clean = [...new Set(
      models
        .filter((m): m is string => typeof m === 'string')
        .map(m => m.trim())
        .filter(m => m.length > 0 && m.length <= 80),
    )].slice(0, MAX_MODELS_PER_PROVIDER);
    if (clean.length > 0) out[provider] = clean;
  }
  return out;
}

export async function getProviderModelOverrides(): Promise<ProviderModels> {
  const now = Date.now();
  if (_cache && now - _cachedAt < CACHE_TTL_MS) return _cache;
  try {
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      `SELECT settings FROM app_configurations WHERE id = ? LIMIT 1`,
      [CONFIG_ID],
    );
    if (Array.isArray(rows) && rows[0]?.settings) {
      const raw = rows[0].settings;
      _cache = sanitise(typeof raw === 'string' ? JSON.parse(raw) : raw);
      _cachedAt = now;
      return _cache!;
    }
  } catch (err) {
    console.error('[ProviderModels] Failed to load overrides — using defaults:', err);
  }
  return {};
}

/** Replace the whole override map (admin batch save). Returns sanitised map. */
export async function saveProviderModelOverrides(next: ProviderModels): Promise<ProviderModels> {
  const clean = sanitise(next);
  const json = JSON.stringify(clean);
  const db = await getMysqlClient();
  // No CAST(... AS JSON) — MySQL-only syntax, breaks on MariaDB (Hostinger).
  await db.query(
    `INSERT INTO app_configurations (id, settings)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE settings = ?`,
    [CONFIG_ID, json, json],
  );
  bustProviderModels();
  return clean;
}

/** Set/clear ONE provider's override. null/empty models → back to defaults. */
export async function saveProviderModelOverride(
  provider: string,
  models: string[] | null,
): Promise<ProviderModels> {
  const current = { ...(await getProviderModelOverrides()) };
  if (!models || models.length === 0) delete current[provider];
  else current[provider] = models;
  return saveProviderModelOverrides(current);
}

/**
 * Resolve the effective model cascade for a provider:
 * admin override if present and valid, otherwise the built-in defaults.
 */
export async function getModelList(provider: string, defaults: readonly string[]): Promise<string[]> {
  try {
    const overrides = await getProviderModelOverrides();
    const override = overrides[provider];
    if (Array.isArray(override) && override.length > 0) return override;
  } catch {
    // fall through to defaults on any storage error
  }
  return [...defaults];
}
