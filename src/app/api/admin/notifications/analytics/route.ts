/**
 * Admin — Notification Analytics
 *
 * Fetches delivery + open stats from OneSignal for recent notifications.
 * Results are returned pre-computed so the client does zero math.
 *
 * Performance notes:
 * - Only called by admins, never by regular users
 * - Uses server-side fetch (no client bundle bloat)
 * - Client caches results for 5 minutes to avoid hammering the API
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';

const ONESIGNAL_API = 'https://api.onesignal.com';

function getCredentials() {
  return {
    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
    restApiKey: process.env.ONESIGNAL_REST_API_KEY ?? '',
  };
}

export interface NotifStat {
  id: string;
  heading: string;
  content: string;
  sentAt: number;       // unix epoch seconds
  delivered: number;    // successful deliveries
  opened: number;       // confirmed opens
  failed: number;       // failed deliveries
  remaining: number;    // queued / pending
  openRate: number;     // 0-100 percentage
  segment?: string;     // detected from collapse_id / heading
}

/** Detect segment from OneSignal notification metadata */
function detectSegment(n: any): string {
  const collapseId: string = n.collapse_id ?? n.web_push_topic ?? '';
  if (collapseId.includes('warm')) return 'warm';
  if (collapseId.includes('cooling')) return 'cooling';
  if (collapseId.includes('dormant')) return 'dormant';
  if (collapseId.includes('at_risk')) return 'at_risk';
  if (collapseId.includes('lost')) return 'lost';
  return 'manual';
}

function mapNotification(n: any): NotifStat {
  const delivered = (n.successful ?? 0) + (n.converted ?? 0);
  const opened = n.converted ?? 0;
  const failed = n.failed ?? 0;
  const remaining = n.remaining ?? 0;
  const openRate = delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0;

  const heading =
    n.headings?.en ??
    Object.values(n.headings ?? {})[0] ??
    'No title';
  const content =
    n.contents?.en ??
    Object.values(n.contents ?? {})[0] ??
    '';

  return {
    id: n.id,
    heading,
    content,
    sentAt: n.completed_at ?? n.queued_at ?? 0,
    delivered,
    opened,
    failed,
    remaining,
    openRate,
    segment: detectSegment(n),
  };
}

/** GET /api/admin/notifications/analytics?limit=20&ids=id1,id2 */
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { appId, restApiKey } = getCredentials();
  if (!appId || !restApiKey) {
    return NextResponse.json({ error: 'OneSignal credentials not configured.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
  const specificIds = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];

  const headers = {
    Authorization: `Key ${restApiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    let notifications: any[] = [];

    if (specificIds.length > 0) {
      // Fetch specific notification IDs in parallel (max 10 to keep it fast)
      const ids = specificIds.slice(0, 10);
      const results = await Promise.allSettled(
        ids.map(id =>
          fetch(`${ONESIGNAL_API}/notifications/${id}?app_id=${appId}`, { headers })
            .then(r => r.ok ? r.json() : null)
        )
      );
      notifications = results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map((r: any) => r.value);
    } else {
      // List recent notifications
      const res = await fetch(
        `${ONESIGNAL_API}/notifications?app_id=${appId}&limit=${limit}&kind=1`,
        { headers }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ error: err.errors?.[0] ?? 'OneSignal API error' }, { status: res.status });
      }
      const data = await res.json();
      notifications = data.notifications ?? [];
    }

    const stats = notifications.map(mapNotification);

    // Aggregate by segment
    const bySegment: Record<string, { delivered: number; opened: number; count: number }> = {};
    for (const s of stats) {
      const seg = s.segment ?? 'manual';
      if (!bySegment[seg]) bySegment[seg] = { delivered: 0, opened: 0, count: 0 };
      bySegment[seg].delivered += s.delivered;
      bySegment[seg].opened += s.opened;
      bySegment[seg].count += 1;
    }
    const segmentSummary = Object.entries(bySegment).map(([seg, agg]) => ({
      segment: seg,
      count: agg.count,
      delivered: agg.delivered,
      opened: agg.opened,
      openRate: agg.delivered > 0 ? Math.round((agg.opened / agg.delivered) * 1000) / 10 : 0,
    }));

    // Overall totals
    const totalDelivered = stats.reduce((acc, s) => acc + s.delivered, 0);
    const totalOpened = stats.reduce((acc, s) => acc + s.opened, 0);
    const totalFailed = stats.reduce((acc, s) => acc + s.failed, 0);
    const avgOpenRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 1000) / 10 : 0;

    return NextResponse.json({
      notifications: stats,
      segmentSummary,
      totals: { delivered: totalDelivered, opened: totalOpened, failed: totalFailed, avgOpenRate },
      fetchedAt: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Network error' }, { status: 500 });
  }
}
