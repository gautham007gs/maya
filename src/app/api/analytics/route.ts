import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, db } from '@/lib/dbServer';
import MaximumSecurity from '@/lib/enhanced-security';
import { APISecurityManager } from '@/lib/api-security';
import { verifyAdminSession } from '@/lib/admin-auth';
import {
  getDeviceBreakdownAggregated,
  getTopCountriesAggregated,
  getPeakHoursAggregated,
  getTopPagesAggregated,
  getSessionMetricsAggregated,
  getLanguageDistributionAggregated,
  getRepeatUsersAggregated,
  getAiResponseMetricsAggregated,
  getOverviewCountsAggregated,
  getOverviewTotals,
  getTodayActiveSessionsAggregated,
  getRealtimeSessionCountsAggregated,
  getMessageBreakdownAggregated,
  getHourlyDistributionAggregated,
} from '@/lib/analytics-queries';

// ─── Server-side in-memory cache ──────────────────────────────────────────────
// Prevents hammering the MySQL pool (connectionLimit=5) on every poll tick.
// Overview is heavy (10 queries) → 90 s TTL. Realtime is lighter → 20 s TTL.
interface CacheEntry { data: any; ts: number; ttl: number }
const serverCache = new Map<string, CacheEntry>();
function getCached(key: string): any | null {
  const entry = serverCache.get(key);
  if (entry && Date.now() - entry.ts < entry.ttl) return entry.data;
  serverCache.delete(key);
  return null;
}
function setCache(key: string, data: any, ttl: number) {
  serverCache.set(key, { data, ts: Date.now(), ttl });
  // Prevent unbounded growth
  if (serverCache.size > 50) {
    const oldest = serverCache.keys().next().value;
    if (oldest) serverCache.delete(oldest);
  }
}

// SQL aggregation helpers (MED-027) — no raw-row LIMIT sampling
const getRealDeviceBreakdown = getDeviceBreakdownAggregated;
const getRealTopCountries = getTopCountriesAggregated;
const getRealPeakHours = getPeakHoursAggregated;
const getRealTopPages = getTopPagesAggregated;
const getRealSessionMetrics = getSessionMetricsAggregated;
const getRealLanguageDistribution = getLanguageDistributionAggregated;
const getRealRepeatUsers = getRepeatUsersAggregated;
const getRealAiResponseMetrics = getAiResponseMetricsAggregated;

async function getRealAdMetrics(startDate: string) {
  try {
    const startBoundary = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    const { data: adData, error } = await db
      .from('ad_interactions')
      .select('action_type, ad_network, ad_type')
      .gte('timestamp', startBoundary);

    if (error) throw error;
    if (!adData || adData.length === 0) {
      return { impressions: 0, clicks: 0, ctr: 0 };
    }

    const clicks = adData.filter((ad: any) => ad.action_type === 'click').length;
    const impressions = adData.filter((ad: any) => ad.action_type === 'view').length;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100) : 0;

    // Note: no "revenue" field here on purpose. A flat $/click + $/impression
    // formula would be fabricated — actual CPM is Adsterra's own real-time
    // auction result, not something derivable from raw counts. Genuine
    // revenue already has its own integration at /api/adsterra (pulls real
    // figures from Adsterra's reporting API), which is what the dashboard's
    // revenue panel actually displays.
    return {
      impressions,
      clicks,
      ctr: parseFloat(ctr.toFixed(2)),
    };
  } catch (error) {
    console.error('Ad metrics error:', error);
    return { impressions: 0, clicks: 0, ctr: 0 };
  }
}

async function getRealUserJourney(startDate: string) {
  try {
    const startBoundary = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    // idx_ujs_completed (added via the migration in HOSTINGER_MYSQL_SETUP.sql)
    // now supports this range filter, so it can follow the dashboard's actual
    // selected date range instead of being hardcoded to the last 24 hours.
    const { data: journeyData, error } = await db
      .from('user_journey_steps')
      .select('step_name, session_id')
      .gte('completed_at', startBoundary)
      .limit(5000)
      .order('completed_at', { ascending: false });

    if (error) {
      console.warn('User journey query error:', error.message);
      return [];
    }
    if (!journeyData || journeyData.length === 0) return [];

    const stepCounts = journeyData.reduce((acc: Record<string, number>, step: any) => {
      acc[step.step_name] = (acc[step.step_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalSessions = new Set(journeyData.map((step: any) => step.session_id)).size;

    const stepOrder = ['landing', 'chat_started', 'message_sent', 'image_share', 'long_session', 'return_visit'];

    // Do not render a six-step funnel full of zeroes when only one step has
    // ever been recorded. The dashboard should show only observed behaviour.
    return stepOrder
      .filter(step => (stepCounts[step] || 0) > 0)
      .map(step => ({
        step: step.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: stepCounts[step],
        conversion: totalSessions > 0 ? Math.round((stepCounts[step] / totalSessions) * 100) : 0
      }));
  } catch (error) {
    console.error('User journey error:', error);
    return [];
  }
}

async function getRealCookieConsent() {
  try {
    const { data: consents, error } = await db
      .from('cookie_consents')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000);

    if (error) throw error;
    if (!consents || consents.length === 0) {
      return {
        necessary: 0,
        analytics: 0,
        advertising: 0,
        personalization: 0,
        aiLearning: 0
      };
    }

    const total = consents.length;
    return {
      necessary: Math.round((consents.filter((c: any) => c.necessary).length / total) * 100),
      analytics: Math.round((consents.filter((c: any) => c.analytics).length / total) * 100),
      advertising: Math.round((consents.filter((c: any) => c.advertising).length / total) * 100),
      personalization: Math.round((consents.filter((c: any) => c.personalization).length / total) * 100),
      aiLearning: Math.round((consents.filter((c: any) => c.ai_learning).length / total) * 100)
    };
  } catch (error) {
    console.error('Cookie consent error:', error);
    return {
      necessary: 0,
      analytics: 0,
      advertising: 0,
      personalization: 0,
      aiLearning: 0
    };
  }
}

export async function GET(request: NextRequest) {
  // Apply MAXIMUM security protection
  const enhancedSecurityCheck = await MaximumSecurity.secureRequest(request);
  if (enhancedSecurityCheck) return enhancedSecurityCheck;

  // Require valid admin session — analytics data is sensitive and must not
  // be readable by unauthenticated external requests.
  const session = await verifyAdminSession(request);
  if (!session.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // NOTE: requireAuth is intentionally NOT set here — see upload/route.ts
  // for why. verifyAdminSession above already gated this request via the
  // real cookie; the header-based requireAuth check was making every
  // analytics call fail with 401 even when properly logged in.
  const securityCheck = await APISecurityManager.secureAPIRoute(request, {
    allowedMethods: ['GET'],
    rateLimit: { requests: 100, window: 60000 },
  });
  if (securityCheck) return securityCheck;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const dateRange = searchParams.get('dateRange') || '7d';

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date();

    switch (dateRange) {
      case '1h':
        startDate.setTime(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate.setTime(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '3d':
        startDate.setDate(now.getDate() - 3);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Check cache FIRST — before any DB calls (including the seed check).
    // The old code ran the seed check before cache, wasting a DB connection
    // on every non-cached request and contributing to pool exhaustion.
    const cacheKey = `${type}-${dateRange}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    switch (type) {
      case 'overview': {
        const result = await getOverviewAnalytics(startDate.toISOString(), dateRange);
        const body = await result.json();
        if (body.success) setCache(cacheKey, body, 90_000); // 90-second cache
        return NextResponse.json(body, { status: body.success ? 200 : 500 });
      }
      case 'realtime': {
        const result = await getRealTimeMetrics();
        const body = await result.json();
        if (body.success) setCache(cacheKey, body, 20_000); // 20-second cache
        return NextResponse.json(body, { status: body.success ? 200 : 500 });
      }
      case 'detailed': {
        const result = await getDetailedAnalytics(startDate.toISOString());
        const body = await result.json();
        if (body.success) setCache(cacheKey, body, 60_000); // 60-second cache
        return NextResponse.json(body, { status: body.success ? 200 : 500 });
      }
      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Analytics API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', details: error.message },
      { status: 500 }
    );
  }
}

// Helper: run an async factory safely, return fallback on failure
async function safeRun<T>(fn: () => PromiseLike<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    console.warn(`${label} failed:`, err?.message ?? err);
    return fallback;
  }
}

async function getOverviewAnalytics(startDate: string, dateRange: string) {
  try {
    const [counts, totals, deviceBreakdown, topCountries, peakHours, adMetrics, topPages, userJourney, cookieConsent, sessionMetrics, languageDistribution, repeatUsers, aiResponseMetrics, todayActiveSessions] = await Promise.all([
      safeRun(() => getOverviewCountsAggregated(startDate), { messagesByDay: {}, usersByDay: {} }, 'overviewCounts'),
      safeRun(() => getOverviewTotals(startDate), { totalMessages: 0, totalUsers: 0, todayMessages: 0, imagesSharedToday: 0, todayChattedUsers: 0 }, 'overviewTotals'),
      safeRun(() => getRealDeviceBreakdown(startDate), { mobile: 0, desktop: 0, tablet: 0 }, 'deviceBreakdown'),
      safeRun(() => getRealTopCountries(startDate), [], 'topCountries'),
      safeRun(() => getRealPeakHours(startDate), [], 'peakHours'),
      safeRun(() => getRealAdMetrics(startDate), { impressions: 0, clicks: 0, ctr: 0 }, 'adMetrics'),
      safeRun(() => getRealTopPages(startDate), [], 'topPages'),
      safeRun(() => getRealUserJourney(startDate), [], 'userJourney'),
      safeRun(getRealCookieConsent, { necessary: 0, analytics: 0, advertising: 0, personalization: 0, aiLearning: 0 }, 'cookieConsent'),
      safeRun(() => getRealSessionMetrics(startDate), { averageMessagesPerSession: 0, averageSessionLength: 0, bounceRate: 0, retentionRate: 0 }, 'sessionMetrics'),
      safeRun(() => getRealLanguageDistribution(startDate), [], 'languageDistribution'),
      safeRun(() => getRealRepeatUsers(startDate), 0, 'repeatUsers'),
      safeRun(() => getRealAiResponseMetrics(startDate), { average: 0, samples: 0 }, 'aiResponseMetrics'),
      safeRun(getTodayActiveSessionsAggregated, 0, 'todayActiveSessions'),
    ]);

    const adMetricsR = adMetrics as any;
    const sessionMetricsR = sessionMetrics as any;
    const messagesByDay = counts.messagesByDay;
    const usersByDay = counts.usersByDay;

    const chartData = [];
    const chartDays = dateRange === '30d' ? 30 : dateRange === '3d' ? 3 : 7;
    for (let i = chartDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en', { weekday: 'short' });
      const dayMessages = messagesByDay[dateStr] || 0;
      const dayUsers = usersByDay[dateStr] || 0;
      chartData.push({
        name: dayName,
        date: dateStr,
        users: dayUsers,
        messages: dayMessages,
        engagement: dayMessages > 0 ? Math.min(100, (dayMessages / Math.max(dayUsers, 1)) * 10) : 0,
        revenue: (adMetricsR.revenue || 0) / chartDays,
        impressions: Math.floor((adMetricsR.impressions || 0) / chartDays),
        responseTime: aiResponseMetrics.average,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionsInSelectedRange: totals.totalUsers,
        todayActiveSessions,
        totalMessages: totals.totalMessages,
        avgSessionTime: sessionMetricsR.averageSessionLength,
        userRetention: sessionMetricsR.retentionRate,
        messagesSentToday: totals.todayMessages,
        imagesSharedToday: totals.imagesSharedToday,
        todayChattedUsers: totals.todayChattedUsers,
        bounceRate: sessionMetricsR.bounceRate,
        avgResponseTime: aiResponseMetrics.average,
        aiResponseTime: aiResponseMetrics.average,
        responseTimeSamples: aiResponseMetrics.samples,
        conversationLength: sessionMetricsR.averageMessagesPerSession,
        repeatUsers,
        languageDistribution,

        // Real analytics data
        deviceBreakdown,
        topCountries,
        peakHours,
        adMetrics,
        topPages,
        userJourney,
        cookieConsent,
        sessionMetrics,

        // Chart data with real metrics
        chartData,

        // Status
        isRealTime: true,
        lastUpdated: new Date().toISOString(),
        dataSource: 'mysql'
      }
    });
  } catch (error) {
    console.error('Overview Analytics Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch real analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getRealTimeMetrics() {
  try {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const [messagesResult, sessionCounts, adMetrics, topPages] = await Promise.all([
      // MUST have a LIMIT — without it this returns every row in the table,
      // hangs the MySQL pool (connectionLimit=5), and causes a browser-visible freeze.
      db
        .from('messages_log')
        .select('message_id, chat_id, sender_type, created_at')
        .gte('created_at', oneHourAgo.toISOString())
        .limit(2000),
      safeRun(
        getRealtimeSessionCountsAggregated,
        { sessionsStartedLast15Minutes: 0, sessionsStartedLast24Hours: 0 },
        'realtimeSessionCounts',
      ),
      getRealAdMetrics(oneHourAgo.toISOString().split('T')[0]),
      // getRealTopPages() now takes the same date-only string format as the
      // overview endpoint (see below) rather than a hardcoded 24h window —
      // today's date is the closest equivalent for a "realtime" panel.
      getRealTopPages(oneHourAgo.toISOString().split('T')[0])
    ]);

    if (messagesResult.error) {
      console.error('Messages query error:', messagesResult.error);
    }
    const messagesLastHour = (messagesResult as any).data?.length || 0;
    const activeChats = (messagesResult as any).data ? new Set((messagesResult as any).data.map((msg: any) => msg.chat_id)).size : 0;

    return NextResponse.json({
      success: true,
      data: {
        sessionsStartedLast15Minutes: sessionCounts.sessionsStartedLast15Minutes,
        sessionsStartedLast24Hours: sessionCounts.sessionsStartedLast24Hours,
        messagesLastHour,
        activeChats,
        avgResponseTime: 0,
        responseTimeSamples: 0,
        adMetrics,
        topPages,
        serverStatus: 'healthy',
        lastUpdated: new Date().toISOString(),
        dataSource: 'mysql'
      }
    });
  } catch (error) {
    console.error('Real-time Analytics Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch real-time data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getDetailedAnalytics(startDate: string) {
  try {
    const [messageBreakdown, hourlyData] = await Promise.all([
      getMessageBreakdownAggregated(startDate),
      getHourlyDistributionAggregated(startDate),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        messageBreakdown,
        hourlyDistribution: hourlyData,
        peakHours: [...hourlyData].sort((a, b) => b.messages - a.messages).slice(0, 6),
        lastUpdated: new Date().toISOString(),
        dataSource: 'mysql'
      }
    });
  } catch (error) {
    console.error('Detailed Analytics Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch detailed analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  // P0-5: The legacy event POST is REMOVED. It accepted client-supplied
  // sessionId/userId and wrote directly to analytics tables, letting anyone
  // mint arbitrary identifiers and forge analytics. All client event writes go
  // through POST /api/analytics/batch, which derives identity from the signed
  // HttpOnly session cookie and validates every event server-side.
  return NextResponse.json({ error: 'Use POST /api/analytics/batch instead' }, { status: 410 });
}
