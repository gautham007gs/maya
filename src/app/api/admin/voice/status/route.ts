/**
 * GET /api/admin/voice/status
 *
 * Returns Sarvam AI key pool health and pending voice message stats.
 * Secured with CRON_SECRET (same auth pattern as other admin routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKeyPoolStatus } from '@/lib/sarvam-key-manager';
import { getMysqlClient } from '@/lib/mysql-client';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [keyStatus, pendingStats] = await Promise.all([
    getKeyPoolStatus().catch(() => ({ total: 0, active: 0, exhausted: 0, keys: [] })),
    (async () => {
      try {
        const db = await getMysqlClient();
        const [rows]: any = await db.query(`
          SELECT
            COUNT(*) AS total,
            SUM(is_delivered = 0 AND expires_at > NOW()) AS pending,
            SUM(is_delivered = 1) AS delivered,
            SUM(expires_at <= NOW() AND is_delivered = 0) AS expired
          FROM pending_voice_messages
        `);
        return rows[0] ?? { total: 0, pending: 0, delivered: 0, expired: 0 };
      } catch {
        return { total: 0, pending: 0, delivered: 0, expired: 0 };
      }
    })(),
  ]);

  return NextResponse.json({
    keys: keyStatus,
    pendingVoice: pendingStats,
    timestamp: new Date().toISOString(),
  });
}
