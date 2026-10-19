import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { resolveOrMintSessionIdentity, attachSessionCookie, getClientIp } from '@/lib/session-identity';
import { hashIpForQuota } from '@/lib/installation-identity';
import { getQuotaDateString } from '@/lib/quota-date';
import { isAdvertisingAllowedOnRequest } from '@/lib/consent';

/**
 * POST /api/ads/direct-link
 * Server-authoritative direct-link ad caps (MED-037).
 */
export async function POST(request: NextRequest) {
  try {
    const identity = resolveOrMintSessionIdentity(request);
    const body = await request.json().catch(() => ({}));
    const action = body?.action === 'record' ? 'record' : 'check';
    const maxDaily = Math.min(Math.max(Number(body?.maxDaily) || 3, 1), 10);
    const maxSession = Math.min(Math.max(Number(body?.maxSession) || 2, 1), 5);

    if (!isAdvertisingAllowedOnRequest(name => request.cookies.get(name)?.value)) {
      return NextResponse.json({ allowed: false, reason: 'consent' }, { status: 403 });
    }

    const quotaDate = getQuotaDateString();
    const quotaKey = `${hashIpForQuota(getClientIp(request))}:${(identity.sid || 'anon').substring(0, 32)}`;
    const db = await getMysqlClient();

    // Ensure the ad_direct_link_quota table exists. Some installs may not have
    // had the migrations applied; handle common missing-table errors by
    // creating the table at runtime then retrying the query once.
    const ensureAdQuotaTable = async () => {
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS ad_direct_link_quota (
            quota_key VARCHAR(191) NOT NULL,
            quota_date DATE NOT NULL,
            daily_count INT NOT NULL DEFAULT 0,
            session_count INT NOT NULL DEFAULT 0,
            last_shown_at TIMESTAMP NULL DEFAULT NULL,
            PRIMARY KEY (quota_key, quota_date)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
      } catch (e) {
        // Log but don't crash; we'll handle upstream.
        console.warn('[ads/direct-link] ensureAdQuotaTable error', e instanceof Error ? e.message : e);
      }
    };

    let rows: any[] = [];
    try {
      const res: any = await db.query(
        `SELECT daily_count, session_count FROM ad_direct_link_quota
         WHERE quota_key = ? AND quota_date = ? LIMIT 1`,
        [quotaKey.substring(0, 191), quotaDate],
      );
      rows = res[0];
    } catch (err: any) {
      // If the table doesn't exist, create it and retry the select once.
      const msg = String(err?.message || err || '');
      if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('UNKNOWN_TABLE') || (err && err.code === 'ER_NO_SUCH_TABLE')) {
        console.warn('[ads/direct-link] missing table ad_direct_link_quota — creating it on-the-fly');
        await ensureAdQuotaTable();
        try {
          const res2: any = await db.query(
            `SELECT daily_count, session_count FROM ad_direct_link_quota
             WHERE quota_key = ? AND quota_date = ? LIMIT 1`,
            [quotaKey.substring(0, 191), quotaDate],
          );
          rows = res2[0];
        } catch (err2: any) {
          console.error('[ads/direct-link] retry select failed', err2 instanceof Error ? err2.message : err2);
          throw err2;
        }
      } else {
        throw err;
      }
    }

    const row = rows?.[0];
    const dailyCount = Number(row?.daily_count) || 0;
    const sessionCount = Number(row?.session_count) || 0;
    const allowed = dailyCount < maxDaily && sessionCount < maxSession;

    if (action === 'record' && allowed) {
      try {
        await db.query(
          `INSERT INTO ad_direct_link_quota (quota_key, quota_date, daily_count, session_count, last_shown_at)
           VALUES (?, ?, 1, 1, NOW())
           ON DUPLICATE KEY UPDATE
             daily_count = daily_count + 1,
             session_count = session_count + 1,
             last_shown_at = NOW()`,
          [quotaKey.substring(0, 191), quotaDate],
        );
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes("doesn't exist") || (err && err.code === 'ER_NO_SUCH_TABLE')) {
          // Attempt to create the table and retry once more
          console.warn('[ads/direct-link] insert failed due to missing table, creating and retrying');
          await ensureAdQuotaTable();
          await db.query(
            `INSERT INTO ad_direct_link_quota (quota_key, quota_date, daily_count, session_count, last_shown_at)
             VALUES (?, ?, 1, 1, NOW())
             ON DUPLICATE KEY UPDATE
               daily_count = daily_count + 1,
               session_count = session_count + 1,
               last_shown_at = NOW()`,
            [quotaKey.substring(0, 191), quotaDate],
          );
        } else {
          throw err;
        }
      }
    }

    const response = NextResponse.json({
      allowed: action === 'record' ? allowed : allowed,
      dailyCount: action === 'record' ? dailyCount + 1 : dailyCount,
      sessionCount: action === 'record' ? sessionCount + 1 : sessionCount,
      maxDaily,
      maxSession,
    });
    attachSessionCookie(response, identity);
    return response;
  } catch (err) {
    console.warn('[ads/direct-link]', err instanceof Error ? err.message : err);
    return NextResponse.json({ allowed: false, reason: 'error' }, { status: 503 });
  }
}
