/**
 * Chat abuse quotas (DB-backed + shared rate limits).
 *
 * Layered identity (MED-021 / BUG-053):
 *   - Per-session daily cap (signed session cookie)
 *   - Per-IP daily cap (survives cookie clearing)
 *   - Per-IP hourly burst cap (shared rate limiter)
 *   - Global AI budget (shared rate limiter)
 *
 * Daily reset uses business timezone (MED-022, default Asia/Kolkata).
 */

import { getMysqlClient } from './mysql-client';
import { checkRateLimit } from './shared-rate-limiter';
import { getQuotaDateString } from './quota-date';
import { hashIpForQuota } from './installation-identity';

export const SESSION_DAILY_LIMIT = 20;
export const IP_DAILY_LIMIT = 40;
export const IP_HOURLY_LIMIT = 120;
export const GLOBAL_PER_MINUTE_LIMIT = 500;

export interface ChatQuotaResult {
  allowed: boolean;
  status: 429 | 503 | 200;
  reason: string;
  retryAfterMs?: number;
}

async function ensureQuotaTables(db: any): Promise<void> {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_quota (
        session_id VARCHAR(191) NOT NULL,
        quota_date CHAR(10) NOT NULL,
        count INT NOT NULL DEFAULT 0,
        PRIMARY KEY (session_id, quota_date),
        INDEX idx_chat_quota_date (quota_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (e) {
    // best-effort; caller will treat as dbDown on subsequent operations
  }
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_ip_quota (
        ip_hash VARCHAR(191) NOT NULL,
        quota_date CHAR(10) NOT NULL,
        count INT NOT NULL DEFAULT 0,
        PRIMARY KEY (ip_hash, quota_date),
        INDEX idx_chat_ip_quota_date (quota_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (e) {
    // best-effort
  }
}

async function incrementQuotaRow(
  table: 'chat_quota' | 'chat_ip_quota',
  keyColumn: 'session_id' | 'ip_hash',
  key: string,
  quotaDate: string,
): Promise<{ allowed: boolean; dbDown: boolean; limit: number }> {
  const limit = table === 'chat_quota' ? SESSION_DAILY_LIMIT : IP_DAILY_LIMIT;
  try {
    const db = await getMysqlClient();
    await ensureQuotaTables(db);
    await db.query(
      `INSERT INTO ${table} (${keyColumn}, quota_date, count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE count = count + 1`,
      [key.substring(0, 191), quotaDate],
    );
    const [rows]: any = await db.query(
      `SELECT count FROM ${table} WHERE ${keyColumn} = ? AND quota_date = ?`,
      [key.substring(0, 191), quotaDate],
    );
    const currentCount: number = rows.length > 0 ? Number(rows[0].count) : 1;
    return { allowed: currentCount <= limit, dbDown: false, limit };
  } catch (err) {
    console.error('[ChatQuota] DB quota increment failed:', (err as Error).message);
    return { allowed: false, dbDown: true, limit };
  }
}

export async function enforceChatQuotas(opts: {
  sessionKey: string;
  ip: string;
}): Promise<ChatQuotaResult> {
  const { sessionKey, ip } = opts;
  const quotaDate = getQuotaDateString();

  const global = await checkRateLimit('chat_global', 'ai', {
    limit: GLOBAL_PER_MINUTE_LIMIT,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!global.allowed) {
    return {
      allowed: false,
      status: 429,
      reason: 'Chat is unusually busy right now — please try again in a minute',
      retryAfterMs: global.retryAfterMs,
    };
  }

  const ipRl = await checkRateLimit('chat_ip_hourly', ip, {
    limit: IP_HOURLY_LIMIT,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (!ipRl.allowed) {
    return {
      allowed: false,
      status: 429,
      reason: 'Message limit reached for this network — try again later',
      retryAfterMs: ipRl.retryAfterMs,
    };
  }

  const ipDaily = await incrementQuotaRow('chat_ip_quota', 'ip_hash', hashIpForQuota(ip), quotaDate);
  if (ipDaily.dbDown) {
    return { allowed: false, status: 503, reason: 'Service temporarily unavailable — please try again shortly' };
  }
  if (!ipDaily.allowed) {
    return {
      allowed: false,
      status: 429,
      reason: `Daily message limit reached for this network (${IP_DAILY_LIMIT} messages) — come back tomorrow`,
    };
  }

  const sessionDaily = await incrementQuotaRow('chat_quota', 'session_id', sessionKey, quotaDate);
  if (sessionDaily.dbDown) {
    return { allowed: false, status: 503, reason: 'Service temporarily unavailable — please try again shortly' };
  }
  if (!sessionDaily.allowed) {
    return {
      allowed: false,
      status: 429,
      reason: `Daily message limit reached (${SESSION_DAILY_LIMIT} messages) — come back tomorrow`,
    };
  }

  return { allowed: true, status: 200, reason: 'ok' };
}

export default {
  enforceChatQuotas,
  SESSION_DAILY_LIMIT,
  IP_DAILY_LIMIT,
  IP_HOURLY_LIMIT,
  GLOBAL_PER_MINUTE_LIMIT,
};
