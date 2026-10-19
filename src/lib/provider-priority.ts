/**
 * Provider Priority — admin-managed cascade ranking.
 *
 * Stored in app_configurations under id = 'provider_priority_v1':
 *   { "gemini": 1, "openrouter": 2, ... }
 * Lower number = tried earlier in the AI cascade. Providers without a rank
 * fall back to the built-in default order AFTER every ranked provider
 * ("auto" mode), so the system works fully even when nothing is configured.
 *
 * Uniqueness guarantee: ranks are de-duplicated on save via
 * resolveRankConflicts() — at most one provider per rank; any provider
 * displaced by a new assignment falls back to Auto.
 *
 * Real-time: 10 s in-process TTL cache + explicit bust on save. The AI engine's
 * invalidateKeysCache() also clears this cache, so toggling a provider or saving
 * a priority applies to new chat requests immediately on this instance and
 * within ~10 s on any other instance.
 */

import { getMysqlClient } from './mysql-client';

export const CONFIG_ID = 'provider_priority_v1';
const CACHE_TTL_MS = 10_000;

export type ProviderRanks = Record<string, number>;

let _cache: ProviderRanks | null = null;
let _cachedAt = 0;

export function bustProviderPriority(): void {
  _cache = null;
  _cachedAt = 0;
}

export async function getProviderRanks(): Promise<ProviderRanks> {
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
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      _cache = sanitiseRanks(parsed);
      _cachedAt = now;
      return _cache!;
    }
  } catch (err) {
    console.error('[ProviderPriority] Failed to load ranks — using auto order:', err);
  }
  return {};
}

export async function saveProviderRanks(next: ProviderRanks): Promise<ProviderRanks> {
  const clean = sanitiseRanks(next);
  const json = JSON.stringify(clean);
  const db = await getMysqlClient();
  // NOTE: no CAST(? AS JSON) — that is MySQL-only syntax and fails with
  // ER_PARSE_ERROR on MariaDB (Hostinger). The `settings` column is JSON-typed
  // (LONGTEXT + json_valid CHECK on MariaDB), so binding the JSON string
  // directly is valid on both MySQL and MariaDB.
  await db.query(
    `INSERT INTO app_configurations (id, settings)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE settings = ?`,
    [CONFIG_ID, json, json],
  );
  bustProviderPriority();
  return clean;
}

/** Keep only finite positive integers; drop everything else defensively. */
function sanitiseRanks(raw: unknown): ProviderRanks {
  const out: ProviderRanks = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [provider, rank] of Object.entries(raw as Record<string, unknown>)) {
    if (Number.isInteger(rank) && (rank as number) >= 1) out[provider] = rank as number;
  }
  return out;
}

/**
 * Uniqueness guarantee: at most ONE provider may hold any given rank.
 * Ranks are processed ascending; for each rank the claimant closest to the
 * front of the default order keeps it, and every other claimant drops back to
 * Auto (removed from the map). Used by both single-assign and batch-save paths
 * so conflicting rankings can never reach the database.
 */
export function resolveRankConflicts(
  raw: ProviderRanks,
  defaultOrder: readonly string[],
): ProviderRanks {
  const clean = sanitiseRanks(raw);
  const orderIdx = new Map(defaultOrder.map((p, i) => [p as string, i]));
  const byRank = new Map<number, string[]>();
  for (const [provider, rank] of Object.entries(clean)) {
    const list = byRank.get(rank) ?? [];
    list.push(provider);
    byRank.set(rank, list);
  }
  const out: ProviderRanks = {};
  for (const [rank, claimants] of [...byRank.entries()].sort((a, b) => a[0] - b[0])) {
    const winner = claimants.sort(
      (a, b) => (orderIdx.get(a) ?? Number.MAX_SAFE_INTEGER) - (orderIdx.get(b) ?? Number.MAX_SAFE_INTEGER),
    )[0];
    out[winner] = rank;
  }
  return out;
}

// ── Pure ordering core (unit-tested, no DB dependency) ───────────────────────

/**
 * Order providers by admin-assigned rank.
 *  - Ranked providers first, ascending by rank.
 *  - Ties broken by position in the built-in default order.
 *  - Unranked providers follow, preserving the default order ("auto" fallback).
 */
export function orderProvidersByRank<T extends string>(
  baseOrder: readonly T[],
  ranks: ProviderRanks,
): T[] {
  const indexOf = new Map<string, number>(baseOrder.map((p, i) => [p as string, i]));
  const known = baseOrder.filter(p => Number.isInteger(ranks[p]));
  void Object.keys(ranks).filter(p => !indexOf.has(p)); // ranks for removed providers are ignored

  const ranked = known.sort((a, b) => (ranks[a]! - ranks[b]!) || (indexOf.get(a as string)! - indexOf.get(b as string)!));
  const auto = baseOrder.filter(p => !Number.isInteger(ranks[p]));
  return [...ranked, ...auto];
}
