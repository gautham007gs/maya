import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';

const ADSTERRA_API_BASE = 'https://api3.adsterratools.com/publisher';

// Headers that tell every layer (browser, SW, CDN, Next.js) not to cache this response.
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const apiKey = process.env.ADSTERRA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ADSTERRA_API_KEY not configured', configured: false },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }

  const { searchParams } = new URL(request.url);
  const groupBy = searchParams.get('group_by') || 'date';

  const today = new Date();
  const finishDate = today.toISOString().split('T')[0];
  const startDateDefault = new Date(today);
  startDateDefault.setDate(startDateDefault.getDate() - 6);
  const startDate = searchParams.get('start_date') || startDateDefault.toISOString().split('T')[0];
  const finish = searchParams.get('finish_date') || finishDate;

  // Hard timeout — without this a slow Adsterra API leaves requests hanging,
  // which piles up concurrent connections and can exhaust the browser connection limit.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL(`${ADSTERRA_API_BASE}/stats.json`);
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('finish_date', finish);
    url.searchParams.set('group_by', groupBy);

    const domain = searchParams.get('domain');
    if (domain) url.searchParams.set('domain', domain);

    const siteId = searchParams.get('site_id');
    if (siteId) url.searchParams.set('site_id', siteId);

    const adFormat = searchParams.get('ad_format');
    if (adFormat) url.searchParams.set('ad_format', adFormat);

    // cache: 'no-store' ensures Next.js / fetch doesn't serve a stale response
    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Adsterra API] Error response:', response.status, errorBody);

      // 403 = token expired/revoked — this is the #1 cause of "API not working"
      if (response.status === 403) {
        return NextResponse.json(
          {
            error: 'Adsterra API token expired or revoked (403 Forbidden). Go to your Adsterra Publisher dashboard → Settings → API → Generate New Token, then update ADSTERRA_API_KEY in your .env file.',
            details: errorBody,
            configured: true,
            tokenExpired: true,
          },
          { status: 200, headers: NO_CACHE_HEADERS }
        );
      }

      return NextResponse.json(
        { error: `Adsterra API returned ${response.status}`, details: errorBody, configured: true },
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }

    const data = await response.json();

    const items: any[] = data?.items || [];

    // Compute per-item CPM and CTR so the frontend doesn't have to
    const enrichedItems = items.map((item: any) => {
      const imp = item.impression || 0;
      const clk = item.clicks || 0;
      const rev = parseFloat(item.revenue || 0);
      return {
        ...item,
        impression: imp,
        clicks: clk,
        revenue: rev,
        ctr: imp > 0 ? parseFloat(((clk / imp) * 100).toFixed(4)) : 0,
        cpm: imp > 0 ? parseFloat(((rev / imp) * 1000).toFixed(4)) : 0,
      };
    });

    const totals = enrichedItems.reduce(
      (acc: any, item: any) => ({
        impression: acc.impression + item.impression,
        clicks: acc.clicks + item.clicks,
        revenue: acc.revenue + item.revenue,
      }),
      { impression: 0, clicks: 0, revenue: 0 }
    );

    const totalImpressions = totals.impression;
    const totalClicks = totals.clicks;
    const totalRevenue = totals.revenue;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpm = totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0;

    return NextResponse.json(
      {
        configured: true,
        items: enrichedItems,
        totals: {
          impression: totalImpressions,
          clicks: totalClicks,
          revenue: parseFloat(totalRevenue.toFixed(4)),
          ctr: parseFloat(avgCtr.toFixed(4)),
          cpm: parseFloat(avgCpm.toFixed(4)),
        },
        dbLastUpdateTime: data?.dbLastUpdateTime || null,
        itemCount: data?.itemCount || enrichedItems.length,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.warn('[Adsterra API] Request timed out after 10s');
      return NextResponse.json(
        { error: 'Adsterra API timed out', configured: true },
        { status: 200, headers: NO_CACHE_HEADERS }
      );
    }
    console.error('[Adsterra API] Fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Adsterra stats', configured: true },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
