/**
 * Rate-Limit Persistence Store
 *
 * Persists the IP blocklist to MySQL so bans survive server restarts and deployments.
 *
 * Architecture:
 *   L1 — in-memory Sets/Maps inside enhanced-security.ts  (zero-latency reads)
 *   L2 — this module / MySQL  (durable, survives restarts)
 *
 * The hot path (every request) only touches L1.  DB writes happen
 * asynchronously via instrumentation.ts draining IPReputationSystem._pendingPersist.
 */
import 'server-only';
import { getMysqlClient } from './mysql-client';

export interface BlockedIPRecord {
  ip: string;
  reason: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Table bootstrap
// ---------------------------------------------------------------------------

/**
 * Create the ip_blocklist table if it doesn't exist yet.
 * Called once on server startup in instrumentation.ts.
 */
export async function ensureRateLimitTables(): Promise<void> {
  try {
    const db = await getMysqlClient();
    await db.query(`
      CREATE TABLE IF NOT EXISTS ip_blocklist (
        ip         VARCHAR(45)  NOT NULL PRIMARY KEY,
        reason     VARCHAR(255) NOT NULL DEFAULT '',
        score      TINYINT      NOT NULL DEFAULT 0,
        blocked_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME     NULL,
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (err) {
    // Non-fatal — the app still enforces bans via in-memory state during
    // this process lifetime; it just won't survive a restart.
    console.warn('[RateLimitStore] Could not create ip_blocklist table:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Load on startup
// ---------------------------------------------------------------------------

/**
 * Read all currently-active blocked IPs from DB.
 * Called once on startup to repopulate the in-memory blocklist.
 */
export async function loadBlockedIPs(): Promise<BlockedIPRecord[]> {
  try {
    const db = await getMysqlClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows]: any = await db.query(
      `SELECT ip, reason, score FROM ip_blocklist
       WHERE expires_at IS NULL OR expires_at > NOW()`
    );
    return Array.isArray(rows)
      ? (rows as BlockedIPRecord[])
      : [];
  } catch (err) {
    console.warn('[RateLimitStore] Could not load blocklist from DB:', (err as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Write new block
// ---------------------------------------------------------------------------

/**
 * Upsert a newly blocked IP into the DB.  Fire-and-forget — never throws.
 *
 * @param expiresInMs  Optional TTL in ms.  Pass `undefined` for a permanent ban.
 */
export async function persistBlockedIP(
  ip: string,
  reason: string,
  score: number,
  expiresInMs?: number,
): Promise<void> {
  try {
    const db = await getMysqlClient();
    const expiresAt = expiresInMs != null ? new Date(Date.now() + expiresInMs) : null;
    await db.query(
      `INSERT INTO ip_blocklist (ip, reason, score, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reason     = VALUES(reason),
         score      = VALUES(score),
         blocked_at = CURRENT_TIMESTAMP,
         expires_at = VALUES(expires_at)`,
      [ip, reason.substring(0, 255), score, expiresAt],
    );
  } catch (err) {
    // Warn but never crash — in-memory block is already in place.
    console.warn('[RateLimitStore] Could not persist blocked IP:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Delete expired blocks.  Run periodically (e.g. weekly) to keep the table lean.
 */
export async function cleanupExpiredBlocks(): Promise<void> {
  try {
    const db = await getMysqlClient();
    const [result]: any = await db.query(
      `DELETE FROM ip_blocklist WHERE expires_at IS NOT NULL AND expires_at <= NOW()`,
    );
    const deleted = (result as { affectedRows: number }).affectedRows ?? 0;
    if (deleted > 0) {
      console.log(`[RateLimitStore] Cleaned up ${deleted} expired block(s)`);
    }
  } catch (err) {
    console.warn('[RateLimitStore] Cleanup failed:', (err as Error).message);
  }
}
