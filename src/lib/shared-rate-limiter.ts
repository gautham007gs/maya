/**
 * Shared Rate-Limit Store (MySQL-backed)
 *
 * The original rate limiters (src/proxy.ts, enhanced-security.ts,
 * api-security.ts, security-utils.ts, voice limiter) all use in-memory Maps.
 * That is fine on a single Node process but means each instance has its own
 * counters, so attackers can multiply their limits once the app scales
 * horizontally.
 *
 * This module provides a shared, cross-instance fixed-window counter backed by
 * MySQL. It is deliberately simple and dependency-free:
 *
 *   table rate_limit_counts(bucket_key PK, window_start, count, updated_at)
 *
 * Algorithm (fixed window):
 *   1. windowStart = floor(now / windowMs) * windowMs
 *   2. atomic upsert increments `count` for the current window (or resets to 1
 *      when the window rolled over)
 *   3. compare count against the limit
 *
 * A tiny in-memory cache (TTL = CACHE_TTL_MS) absorbs bursts within a single
 * window so a hot endpoint does not hit the DB on every single request, while
 * the DB remains the authoritative cross-instance counter.
 *
 * Usage:
 *   const rl = await checkRateLimit('ip', '1.2.3.4', { limit: 200, windowMs: 60_000 });
 *   if (!rl.allowed) return 429;
 *
 * NOTE: the middleware in src/proxy.ts keeps its in-memory limiter as the
 * per-request hot path (it runs for every request and must not block on the
 * MySQL pool). Endpoint-level abuse surfaces (analytics, chat, voice, log)
 * use this shared store. For a multi-instance deployment, additionally back
 * the middleware with this store (e.g. by setting PROXY_RATE_LIMIT_MODE=shared).
 */

import 'server-only';

const TABLE = 'rate_limit_counts';
const CACHE_TTL_MS = 150;

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterMs: number;
}

interface CheckOptions {
  limit: number;
  windowMs: number;
  /** Increment the counter by this amount (default 1). Use for batch endpoints. */
  incrementBy?: number;
  /**
   * When true, a DB failure DENIES the request (fail closed). Use for
   * expensive/spend-gating checks (AI budget, admin login) where an
   * unavailable rate store must never allow unlimited access.
   * Default false (fail open with an in-memory guard).
   */
  failClosed?: boolean;
}

// Tiny L1 cache: bucket_key -> { count, windowStart, allowed, cachedAt }
const cache = new Map<string, { count: number; windowStart: number; allowed: boolean; cachedAt: number }>();

let tableReady = false;
let tableReadyPromise: Promise<void> | null = null;

async function ensureTable(db: any): Promise<void> {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            bucket_key   VARCHAR(191) NOT NULL PRIMARY KEY,
            window_start BIGINT       NOT NULL,
            count        INT          NOT NULL DEFAULT 0,
            updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_rlc_window (window_start)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        tableReady = true;
      } catch (err) {
        console.warn('[RateLimitStore] Could not create rate_limit_counts table:', (err as Error).message);
      }
    })();
  }
  await tableReadyPromise;
}

/**
 * Shared fixed-window rate limiter.
 * @param bucket  Logical scope, e.g. 'ip' | 'session' | 'global'
 * @param key     Identifier within the scope, e.g. the IP or session id
 * @param opts    { limit, windowMs }
 */
export async function checkRateLimit(
  bucket: string,
  key: string,
  opts: CheckOptions,
): Promise<RateLimitResult> {
  const { limit, windowMs } = opts;
  const incrementBy = Math.max(1, Math.min(1000, Math.floor(opts.incrementBy ?? 1)));
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const cacheKey = `${bucket}:${key}:${windowStart}:${incrementBy}`;

  const hit = cache.get(cacheKey);
  if (hit && now - hit.cachedAt < CACHE_TTL_MS && incrementBy === 1) {
    return {
      allowed: hit.allowed,
      count: hit.count,
      limit,
      retryAfterMs: Math.max(0, windowStart + windowMs - now),
    };
  }

  // NOTE: Rate limiting intentionally does NOT use Redis. Redis is reserved
  // as a pure performance cache (public-config, blog) so it never competes
  // with security-critical rate limiting for the Upstash free-tier command
  // budget (500K commands/month). MySQL is the authoritative shared counter;
  // the L1 in-memory cache above absorbs bursts within a single window.

  // ── L2 (was L3): MySQL Shared DB Counter ──────────────────────────────────
  try {
    const { getMysqlClient } = await import('./mysql-client');
    const db = await getMysqlClient();
    await ensureTable(db);

    const bucketKey = `${bucket}:${key}`.substring(0, 191);

    await db.query(
      `INSERT INTO ${TABLE} (bucket_key, window_start, count)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         count        = IF(window_start = VALUES(window_start), count + VALUES(count), VALUES(count)),
         window_start = IF(window_start = VALUES(window_start), window_start, VALUES(window_start))`,
      [bucketKey, windowStart, incrementBy]
    );

    const [rows]: any = await db.query(
      `SELECT count FROM ${TABLE} WHERE bucket_key = ?`,
      [bucketKey]
    );
    const count = Array.isArray(rows) && rows[0] ? Number(rows[0].count) : 1;

    const allowed = count <= limit;
    cache.set(cacheKey, { count, windowStart, allowed, cachedAt: now });
    if (cache.size > 20000) cache.clear();

    return { allowed, count, limit, retryAfterMs: Math.max(0, windowStart + windowMs - now) };
  } catch (err) {
    console.warn('[RateLimitStore] DB check failed, using in-memory fallback:', (err as Error).message);

    const memKey = `mem:${bucket}:${key}`;
    const memHit = memFallback.get(memKey);
    const memCount = memHit ? memHit.count + 1 : 1;
    // failClosed contract: when the authoritative MySQL store is unreachable,
    // security-sensitive checks (admin login, AI budget, etc.) must DENY
    // rather than fall back to a per-instance memory counter that an
    // attacker could bypass by hitting a different instance/process.
    const allowed = opts.failClosed ? false : memCount <= limit;

    if (memHit && now - memHit.cachedAt < windowMs) {
      memHit.count = memCount;
      memHit.cachedAt = now;
    } else {
      memFallback.set(memKey, { count: memCount, cachedAt: now });
    }

    if (opts.failClosed) {
      console.warn('[RateLimitStore] DB unavailable and failClosed=true; denying request for safety.');
    }

    return {
      allowed,
      count: memCount,
      limit,
      retryAfterMs: allowed ? 0 : Math.max(0, (memHit?.cachedAt ?? now) + windowMs - now),
    };
  }
}

const memFallback = new Map<string, { count: number; cachedAt: number }>();

/**
 * Delete stale rate-limit rows. Run periodically (e.g. hourly) to keep the
 * table lean. Rows older than maxAgeMs are removed.
 */
export async function cleanupStaleRateLimits(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const { getMysqlClient } = await import('./mysql-client');
    const db = await getMysqlClient();
    const [result]: any = await db.query(
      `DELETE FROM ${TABLE} WHERE updated_at < DATE_SUB(NOW(), INTERVAL ? MICROSECOND)`,
      [maxAgeMs * 1000]
    );
    const deleted = (result as { affectedRows: number }).affectedRows ?? 0;
    if (deleted > 0) console.log(`[RateLimitStore] Cleaned up ${deleted} stale rate-limit row(s)`);
  } catch {
    // non-fatal
  }
}

export default {
  checkRateLimit,
  cleanupStaleRateLimits,
};
