'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, Heart, TrendingUp, Clock, Globe, Eye, MousePointer, UserCheck, Zap, Timer, Image, Star, RefreshCw, Database } from 'lucide-react';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from '@/components/charts/AdminCharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { RealTimeTab } from './real-time-tab';
import ClientOnly from '@/components/ClientOnly';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';

interface AnalyticsData {
  // Real-time metrics
  dailyUsers: number;
  totalMessages: number;
  avgSessionTime: number;
  userRetention: number;

  // User engagement
  messagesSentToday: number;
  imagesSharedToday: number;
  avgResponseTime: number;
  bounceRate: number;

  // Cookie analytics
  cookieConsent: {
    necessary: number;
    analytics: number;
    advertising: number;
    personalization: number;
    aiLearning: number;
  };

  // AI performance
  aiResponseTime: number;
  userSatisfaction: number;
  conversationLength: number;
  repeatUsers: number;

  // Ad performance
  adImpressions: number;
  adClicks: number;
  adRevenue: number;
  ctr: number;

  // Device & location data
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  topCountries: Array<{ country: string; users: number }>;
  peakHours: Array<{ hour: number; users: number }>;
}

interface RealTimeMetrics {
  currentOnlineUsers: number;
  messagesLastHour: number;
  averageSessionDuration: number;
  topPages: Array<{ page: string; views: number }>;
}


const AnalyticsDashboard = React.memo(function AnalyticsDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    dailyUsers: 0,
    totalMessages: 0,
    avgSessionTime: 0,
    userRetention: 0,
    messagesSentToday: 0,
    imagesSharedToday: 0,
    avgResponseTime: 0,
    bounceRate: 0,
    cookieConsent: {
      necessary: 0,
      analytics: 0,
      advertising: 0,
      personalization: 0,
      aiLearning: 0
    },
    aiResponseTime: 0,
    userSatisfaction: 0,
    conversationLength: 0,
    repeatUsers: 0,
    adImpressions: 0,
    adClicks: 0,
    adRevenue: 0,
    ctr: 0,
    deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
    topCountries: [],
    peakHours: []
  });

  const [isLoading, setIsLoading] = useState(true);
  // Tracks whether the very first data fetch has completed.
  // Background polls must NOT call setIsLoading(true) — doing so forces a full
  // re-render of every Recharts chart (1 400+ lines) which freezes the browser
  // for several seconds and makes the page appear to hang.
  const isInitialFetchDoneRef = React.useRef(false);
  const [dataSource, setDataSource] = useState<'database' | 'fallback' | 'loading'>('loading');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics>({
    currentOnlineUsers: 0,
    messagesLastHour: 0,
    averageSessionDuration: 0,
    topPages: []
  });

  const [newRealTimeStats, setNewRealTimeStats] = useState({
    responseTimeChart: [] as Array<{ time: string; responseTime: number }>,
    userFlowChart: [] as Array<{ step: string; count: number; dropOff: number }>,
    emotionalStateDistribution: [] as Array<{ emotion: string; count: number; percentage: number }>,
    languageUsageChart: [] as Array<{ language: string; messages: number; percentage: number }>,
    sessionQualityMetrics: {
      averageMessagesPerSession: 0,
      averageSessionLength: 0,
      bounceRate: 0,
      retentionRate: 0
    },
    apiCostMetrics: {
      totalCost: 0,
      costPerUser: 0,
      tokenUsage: 0,
      cacheHitRate: 0
    }
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Consolidated data states - no separate userJourney and device states
  const [consolidatedAnalytics, setConsolidatedAnalytics] = useState<{
    userJourney: any[];
    deviceData: any[];
  }>({
    userJourney: [],
    deviceData: []
  });

  // Adsterra real API stats
  const [adsterraStats, setAdsterraStats] = useState<{
    configured: boolean;
    loading: boolean;
    error: string | null;
    totals: { impression: number; clicks: number; revenue: number; ctr: number; cpm: number };
    items: any[];
    dbLastUpdateTime: string | null;
    fetchedAt: string | null;
  }>({
    configured: false,
    loading: true,
    error: null,
    totals: { impression: 0, clicks: 0, revenue: 0, ctr: 0, cpm: 0 },
    items: [],
    dbLastUpdateTime: null,
    fetchedAt: null,
  });

  type AdsterraPreset = '1d' | '7d' | '14d' | '30d' | 'custom';
  const [adsterraPreset, setAdsterraPreset] = useState<AdsterraPreset>('7d');

  // Custom date range state
  const today = new Date().toISOString().split('T')[0];
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Country breakdown from Adsterra API
  const [countryStats, setCountryStats] = useState<{
    loading: boolean;
    items: Array<{ country: string; country_name?: string; impression: number; clicks: number; revenue: number; ctr: number; cpm: number }>;
  }>({ loading: false, items: [] });

  // Guards against overlapping requests: manual refresh and preset switches
  // can fire fetchAdsterraStats concurrently. Without this, a slow Adsterra
  // API response causes requests to pile up and exhaust connection limits.
  const adsterraFetchIdRef = React.useRef(0);
  const adsterraAbortRef = React.useRef<AbortController | null>(null);
  const adsterraCountryAbortRef = React.useRef<AbortController | null>(null);

  // Returns { start, finish } date strings for a given preset.
  // '1d' = TODAY only (start === finish). Previously used today-1 which
  // accidentally included yesterday's impressions in the "Today" total.
  const getDateRange = (preset: AdsterraPreset): { start: string; finish: string } => {
    const now = new Date();
    const finish = now.toISOString().split('T')[0];
    if (preset === '1d') return { start: finish, finish }; // today only
    if (preset === 'custom') return { start: customStart, finish: customEnd };
    const start = new Date(now);
    if (preset === '14d') start.setDate(start.getDate() - 13);
    else if (preset === '30d') start.setDate(start.getDate() - 29);
    else start.setDate(start.getDate() - 6); // 7d default
    return { start: start.toISOString().split('T')[0], finish };
  };

  const fetchAdsterraStats = async (preset: AdsterraPreset = adsterraPreset) => {
    adsterraAbortRef.current?.abort();
    const controller = new AbortController();
    adsterraAbortRef.current = controller;
    const requestId = ++adsterraFetchIdRef.current;
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      setAdsterraStats(prev => ({ ...prev, loading: true, error: null }));
      const { start, finish } = getDateRange(preset);
      // _t= cache-busting timestamp prevents any intermediate layer (browser cache,
      // SW API cache) from returning a stale response even if cache headers are ignored.
      const res = await fetch(
        `/api/adsterra/stats?start_date=${start}&finish_date=${finish}&group_by=date&_t=${Date.now()}`,
        { credentials: 'include', signal: controller.signal, cache: 'no-store' }
      );
      const data = await res.json();
      if (requestId !== adsterraFetchIdRef.current) return;
      if (data.error && !data.configured) {
        setAdsterraStats({ configured: false, loading: false, error: data.error, totals: { impression: 0, clicks: 0, revenue: 0, ctr: 0, cpm: 0 }, items: [], dbLastUpdateTime: null, fetchedAt: null });
      } else if (data.error) {
        setAdsterraStats(prev => ({ ...prev, loading: false, error: data.error, configured: true }));
      } else {
        setAdsterraStats({ configured: true, loading: false, error: null, totals: data.totals || { impression: 0, clicks: 0, revenue: 0, ctr: 0, cpm: 0 }, items: data.items || [], dbLastUpdateTime: data.dbLastUpdateTime || null, fetchedAt: data.fetchedAt || new Date().toISOString() });
      }
    } catch (e: any) {
      if (requestId !== adsterraFetchIdRef.current) return;
      if (e?.name === 'AbortError') {
        setAdsterraStats(prev => ({ ...prev, loading: false, error: 'Request timed out — Adsterra API is slow, try again' }));
        return;
      }
      setAdsterraStats(prev => ({ ...prev, loading: false, error: e.message }));
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Fetches country breakdown from Adsterra using group_by=country.
  const fetchAdsterraCountries = async (preset: AdsterraPreset = adsterraPreset) => {
    adsterraCountryAbortRef.current?.abort();
    const controller = new AbortController();
    adsterraCountryAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      setCountryStats(prev => ({ ...prev, loading: true }));
      const { start, finish } = getDateRange(preset);
      const res = await fetch(
        `/api/adsterra/stats?start_date=${start}&finish_date=${finish}&group_by=country&_t=${Date.now()}`,
        { credentials: 'include', signal: controller.signal, cache: 'no-store' }
      );
      const data = await res.json();
      if (data.configured && !data.error) {
        const items = (data.items || [])
          .map((item: any) => ({
            country: item.country || item.country_code || '??',
            country_name: item.country_name || item.country || '??',
            impression: item.impression || 0,
            clicks: item.clicks || 0,
            revenue: item.revenue || 0,
            ctr: item.impression > 0 ? parseFloat(((item.clicks / item.impression) * 100).toFixed(4)) : 0,
            cpm: item.impression > 0 ? parseFloat(((item.revenue / item.impression) * 1000).toFixed(4)) : 0,
          }))
          .sort((a: any, b: any) => b.revenue - a.revenue)
          .slice(0, 30);
        setCountryStats({ loading: false, items });
      } else {
        setCountryStats({ loading: false, items: [] });
      }
    } catch {
      setCountryStats(prev => ({ ...prev, loading: false }));
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Cancel in-flight Adsterra requests on unmount.
  React.useEffect(() => {
    return () => {
      adsterraAbortRef.current?.abort();
      adsterraCountryAbortRef.current?.abort();
    };
  }, []);

  // Fetch both date stats + country breakdown whenever preset changes.
  const handleAdsterraPreset = (preset: AdsterraPreset) => {
    setAdsterraPreset(preset);
    if (preset !== 'custom') setShowCustomPicker(false);
    fetchAdsterraStats(preset);
    fetchAdsterraCountries(preset);
  };

  // Apply custom date range.
  const handleCustomApply = () => {
    if (!customStart || !customEnd || customStart > customEnd) return;
    setAdsterraPreset('custom');
    setShowCustomPicker(false);
    fetchAdsterraStats('custom');
    fetchAdsterraCountries('custom');
  };

  // fetchEnhancedRealTimeMetrics was removed — it hit /api/analytics?type=realtime
  // simultaneously with analyticsTracker.getRealtimeAnalytics(), causing 2 identical
  // concurrent queries (both SELECT * with no LIMIT on messages_log), exhausting the
  // 5-connection MySQL pool and freezing the browser. Session/cost metrics are now
  // derived directly from the overview response inside fetchRealTimeData().

  // Guards against overlapping polls: if a previous fetchRealTimeData call
  // (e.g. one blocked on a slow DB/API) hasn't finished yet, skip firing a
  // duplicate one. Without this, the 30s interval + manual refresh + tab
  // visibility handler can all stack concurrent fetch cycles on top of each
  // other, which is what "duplicate calls" / "loop" looks like from outside.
  const isFetchingRealTimeDataRef = React.useRef(false);

  // Real-time data fetching from Hostinger MySQL
  const fetchRealTimeData = async () => {
    if (isFetchingRealTimeDataRef.current) {
      console.warn('⏭️ Skipping analytics fetch — previous fetch still in flight');
      return;
    }
    isFetchingRealTimeDataRef.current = true;
    // Only show the full loading spinner on the FIRST fetch.
    // Subsequent polling refreshes update state in the background without
    // unmounting/remounting charts, which would freeze the browser.
    if (!isInitialFetchDoneRef.current) {
      setIsLoading(true);
    }
    try {
      if (process.env.NODE_ENV === 'development') console.log('🔄 Fetching analytics data...');

      // NOTE: Adsterra is NOT fetched here. Fetching it inside the 30s poll
      // caused two problems: (1) it always used the initial '7d' preset from
      // the closure, silently overwriting whatever preset the user had chosen;
      // (2) it added an extra concurrent API call to an already-busy poll cycle.
      // Adsterra data is fetched once on mount and only on user action (preset
      // switch, custom date apply, or manual refresh button).

      // Fetch real analytics data from API.
      // NOTE: Do NOT add fetchEnhancedRealTimeMetrics() here — it hits the same
      // /api/analytics?type=realtime endpoint as getRealtimeAnalytics(), causing
      // 2 identical concurrent queries (both running SELECT * with no LIMIT on
      // messages_log), exhausting the 5-connection MySQL pool and freezing the browser.
      const [overviewData, realtimeData] = await Promise.all([
        analyticsTracker.getAnalyticsOverview('7d').catch(err => {
          console.error('Overview data fetch failed:', err);
          return { success: false, error: err.message };
        }),
        analyticsTracker.getRealtimeAnalytics().catch(err => {
          console.error('Realtime data fetch failed:', err);
          return { success: false, error: err.message };
        }),
      ]);

      if (process.env.NODE_ENV === 'development') console.log('📊 Analytics data fetched:', {
        overviewSuccess: overviewData?.success,
        realtimeSuccess: realtimeData?.success,
      });

      // If the session expired mid-session, don't just render blank charts —
      // send the admin back to login so it's obvious what happened.
      if (overviewData?.status === 401 || realtimeData?.status === 401) {
        router.replace('/admin/login?returnUrl=/admin/analytics');
        return;
      }

      if (overviewData?.success && overviewData.data) {
        const data = overviewData.data;
        setDataSource(data.dataSource === 'fallback' ? 'fallback' : 'database');

        // Get local metrics for immediate data
        const dailyMessages = parseInt(localStorage.getItem('daily_message_count') || '0');
        const totalImages = parseInt(localStorage.getItem('total_images_sent') || '0');
        const currentDuration = parseFloat(localStorage.getItem('current_session_duration') || '0');

        setAnalytics({
          // Use real data from API with local enhancements
          dailyUsers: data.dailyUsers || 0,
          totalMessages: data.totalMessages || 0,
          avgSessionTime: currentDuration > 0 ? currentDuration : data.avgSessionTime || 0,
          userRetention: data.userRetention || 0,
          messagesSentToday: Math.max(dailyMessages, data.messagesSentToday || 0),
          imagesSharedToday: Math.max(totalImages, data.imagesSharedToday || 0),
          avgResponseTime: data.avgResponseTime || 0,
          bounceRate: data.bounceRate || 0,
          cookieConsent: data.cookieConsent || {
            necessary: 0,
            analytics: 0,
            advertising: 0,
            personalization: 0,
            aiLearning: 0
          },
          aiResponseTime: data.aiResponseTime || 0,
          userSatisfaction: data.userSatisfaction || 0,
          conversationLength: data.conversationLength || 0,
          repeatUsers: data.repeatUsers || 0,
          adImpressions: data.adImpressions || 0,
          adClicks: data.adClicks || 0,
          adRevenue: data.adRevenue || 0,
          ctr: data.ctr || 0,
          deviceBreakdown: data.deviceBreakdown || { mobile: 0, desktop: 0, tablet: 0 },
          topCountries: data.topCountries || [],
          peakHours: data.peakHours || []
        });

          // Update chart data with real data if available
        if (data.chartData && Array.isArray(data.chartData)) {
          setChartData(data.chartData);
        }

        // Update consolidated analytics data
        const updatedConsolidated = {
          userJourney: data.userJourney && Array.isArray(data.userJourney) ? data.userJourney : [],
          deviceData: data.deviceBreakdown ? (() => {
            const deviceBreakdown = data.deviceBreakdown;
            const totalDevices = deviceBreakdown.mobile + deviceBreakdown.desktop + deviceBreakdown.tablet;
            return totalDevices > 0 ? [
              { name: 'Mobile', value: deviceBreakdown.mobile, color: '#8884d8' },
              { name: 'Desktop', value: deviceBreakdown.desktop, color: '#82ca9d' },
              { name: 'Tablet', value: deviceBreakdown.tablet, color: '#ffc658' }
            ] : [];
          })() : []
        };
        setConsolidatedAnalytics(updatedConsolidated);

        // Populate newRealTimeStats from overview data.
        // Previously fetchEnhancedRealTimeMetrics() did a second realtime API call to get
        // some of these values, but that was a duplicate request that helped cause the
        // browser freeze. The overview response already contains sessionMetrics and the
        // totals needed to compute apiCostMetrics, so derive them here instead.
        setNewRealTimeStats(prev => ({
          ...prev,
          languageUsageChart: data.languageDistribution || prev.languageUsageChart,
          emotionalStateDistribution: data.emotionalStates || prev.emotionalStateDistribution,
          sessionQualityMetrics: data.sessionMetrics ? {
            averageMessagesPerSession: data.sessionMetrics.averageMessagesPerSession || 0,
            averageSessionLength: data.sessionMetrics.averageSessionLength || 0,
            bounceRate: data.sessionMetrics.bounceRate || 0,
            retentionRate: data.sessionMetrics.retentionRate || 0,
          } : prev.sessionQualityMetrics,
          apiCostMetrics: {
            totalCost: 0,
            costPerUser: 0,
            tokenUsage: 0,
            cacheHitRate: 0,
          },
        }));
      }

      // Update real-time metrics
      if (realtimeData?.success && realtimeData.data) {
        const rtData = realtimeData.data;
        const overviewMetrics = overviewData?.success ? overviewData.data : null;
        setRealTimeMetrics({
          currentOnlineUsers: rtData.currentOnlineUsers || 0,
          messagesLastHour: rtData.messagesLastHour || 0,
          averageSessionDuration: overviewMetrics?.avgSessionTime || rtData.averageSessionDuration || 0,
          topPages: rtData.topPages?.length ? rtData.topPages : (overviewMetrics?.topPages || [])
        });
      }

      setLastRefresh(new Date());

    } catch (error) {
      console.error('Failed to fetch real-time analytics:', error);
      setDataSource('fallback');
      // Fall back to simulated data
      await fetchFallbackData();
    } finally {
      // Always clear the spinner; mark initial fetch done so polling never
      // re-triggers the loading spinner (which would freeze the browser).
      setIsLoading(false);
      isInitialFetchDoneRef.current = true;
      isFetchingRealTimeDataRef.current = false;
    }
  };

  const fetchFallbackData = async () => {
    // Show zero values for all metrics when no real data is available
    setAnalytics({
      dailyUsers: 0,
      totalMessages: 0,
      avgSessionTime: 0,
      userRetention: 0,
      messagesSentToday: 0,
      imagesSharedToday: 0,
      avgResponseTime: 0,
      bounceRate: 0,
      cookieConsent: {
        necessary: 0,
        analytics: 0,
        advertising: 0,
        personalization: 0,
        aiLearning: 0
      },
      aiResponseTime: 0,
      userSatisfaction: 0,
      conversationLength: 0,
      repeatUsers: 0,
      adImpressions: 0,
      adClicks: 0,
      adRevenue: 0,
      ctr: 0,
      deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
      topCountries: [],
      peakHours: []
    });

    setRealTimeMetrics({
      currentOnlineUsers: 0,
      messagesLastHour: 0,
      averageSessionDuration: 0,
      topPages: []
    });

    setNewRealTimeStats({
      responseTimeChart: [],
      userFlowChart: [],
      emotionalStateDistribution: [],
      languageUsageChart: [],
      sessionQualityMetrics: {
        averageMessagesPerSession: 0,
        averageSessionLength: 0,
        bounceRate: 0,
        retentionRate: 0
      },
      apiCostMetrics: {
        totalCost: 0,
        costPerUser: 0,
        tokenUsage: 0,
        cacheHitRate: 0
      }
    });
  };

  // Authentication check — uses HTTP-only cookie via session API (not sessionStorage)
  useEffect(() => {
    fetch('/api/admin/session')
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
          setIsCheckingAuth(false);
        } else {
          router.replace('/admin/login?returnUrl=/admin/analytics');
        }
      })
      .catch(() => router.replace('/admin/login?returnUrl=/admin/analytics'));
  }, [router]);

  // Real-time data fetching from Hostinger MySQL
  useEffect(() => {
    if (!isAuthenticated) return;

    setIsClient(true);
    fetchRealTimeData();

    // Fetch Adsterra data once on mount (not in the 30s poll — see note above).
    fetchAdsterraStats('7d');
    fetchAdsterraCountries('7d');

    // Optimize real-time polling interval based on activity
    const getPollingInterval = () => {
      return document.hidden ? 60000 : 30000; // 60s when hidden, 30s when active
    };

    let interval = setInterval(fetchRealTimeData, getPollingInterval());

    const handleVisibilityChange = () => {
      clearInterval(interval);
      interval = setInterval(fetchRealTimeData, getPollingInterval());
      if (!document.hidden) {
        fetchRealTimeData(); // Immediate update when returning to tab
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refresh function
  const handleRefresh = () => {
    fetchRealTimeData();
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getHealthStatus = (metric: number, thresholds: [number, number]): string => {
    if (metric >= thresholds[1]) return 'text-green-500';
    if (metric >= thresholds[0]) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return <div className="flex justify-center items-center h-screen bg-background text-foreground">Checking authentication...</div>;
  }

  // Show loading while not authenticated (will redirect)
  if (!isAuthenticated) {
    return <div className="flex justify-center items-center h-screen bg-background text-foreground">Redirecting to login...</div>;
  }

  return (
    <CmsWorkspaceShell
      title="Analytics"
      eyebrow="Performance & Insights"
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Revenue today: ${analytics.adRevenue.toFixed(2)}
          </span>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      }
    >
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap -mt-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${dataSource === 'database' ? 'bg-emerald-500' : dataSource === 'fallback' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
          <span className="text-xs font-medium text-slate-500">
            {dataSource === 'database' ? 'Live data' : dataSource === 'fallback' ? 'Fallback data' : 'Loading…'}
          </span>
          {dataSource === 'database' && (
            <Badge variant="secondary" className="ml-1">
              <Database className="w-3 h-3 mr-1" />
              Hostinger DB
            </Badge>
          )}
        </div>
        {lastRefresh && (
          <span className="text-xs text-slate-400">Last updated: {lastRefresh.toLocaleTimeString()}</span>
        )}
      </div>

      {/* Real-time Status Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{realTimeMetrics.currentOnlineUsers}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Online Now</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-violet-600">{realTimeMetrics.messagesLastHour}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Messages/Hour</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{realTimeMetrics.averageSessionDuration.toFixed(1)}m</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Avg Session</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{analytics.aiResponseTime}ms</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">AI Response</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-7 gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="ai-performance">AI Performance</TabsTrigger>
          <TabsTrigger value="monetization">Monetization</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.dailyUsers)}</div>
                <p className="text-xs text-muted-foreground">{analytics.dailyUsers > 0 ? 'Unique users from database' : 'No unique users yet'}</p>
                <Progress value={analytics.dailyUsers > 0 ? Math.min(100, analytics.dailyUsers * 2) : 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.totalMessages)}</div>
                <p className="text-xs text-muted-foreground">{analytics.totalMessages > 0 ? 'Real messages from database' : 'No messages yet'}</p>
                <Progress value={analytics.totalMessages > 0 ? Math.min(100, analytics.totalMessages / 10) : 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Session Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.avgSessionTime.toFixed(1)}m</div>
                <p className="text-xs text-muted-foreground">{analytics.avgSessionTime > 0 ? 'Real session data' : 'No session data yet'}</p>
                <Progress value={Math.min(100, analytics.avgSessionTime * 5)} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Retention</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.userRetention.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">{analytics.userRetention > 0 ? 'Real retention data' : 'No retention data yet'}</p>
                <Progress value={analytics.userRetention} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Engagement Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {!isClient ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Loading chart...
                    </div>
                  ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="users" stackId="1" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="engagement" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No engagement data available yet. Start using the app to see real metrics.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {!isClient ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Loading chart...
                    </div>
                  ) : consolidatedAnalytics.deviceData.length > 0 && consolidatedAnalytics.deviceData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={consolidatedAnalytics.deviceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {consolidatedAnalytics.deviceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No device data available yet. Device tracking will appear once users visit the app.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-6">
          <RealTimeTab
            newRealTimeStats={newRealTimeStats}
            peakHours={analytics.peakHours}
            currentOnlineUsers={realTimeMetrics.currentOnlineUsers}
            aiResponseTime={analytics.aiResponseTime}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Journey Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                {consolidatedAnalytics.userJourney.length > 0 ? (
                  <div className="space-y-3">
                    {consolidatedAnalytics.userJourney.map((step, _index) => (
                      <div key={step.step} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{step.step}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{step.users || step.count}</span>
                          <Progress value={step.conversion} className="w-20" />
                          <span className="text-xs text-muted-foreground">{step.conversion}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground">
                    No user journey data available yet. Start using the app to see real user flow.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topCountries.map((country, _index) => (
                    <div key={country.country} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{country.country}</span>
                      <Badge variant="secondary">{country.users} users</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Usage Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[200px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.peakHours.filter((_, i) => i % 3 === 0)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="users" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.messagesSentToday}</div>
                <p className="text-xs text-muted-foreground">{analytics.messagesSentToday > 0 ? 'From database' : 'No data yet'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Images Shared</CardTitle>
                <Image className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.imagesSharedToday}</div>
                <p className="text-xs text-muted-foreground">{analytics.imagesSharedToday > 0 ? 'From database' : 'No data yet'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.avgResponseTime > 0 ? `${analytics.avgResponseTime.toFixed(1)}s` : '—'}</div>
                <p className={`text-xs ${analytics.avgResponseTime > 0 ? getHealthStatus(analytics.avgResponseTime, [2, 1]) : 'text-muted-foreground'}`}>
                  {analytics.avgResponseTime === 0 ? 'No data yet' : analytics.avgResponseTime < 1 ? 'Excellent' : analytics.avgResponseTime < 2 ? 'Good' : 'Needs Work'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.bounceRate > 0 ? `${analytics.bounceRate.toFixed(1)}%` : '—'}</div>
                <p className="text-xs text-muted-foreground">{analytics.bounceRate > 0 ? 'From session data' : 'No data yet'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Engagement Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Engagement Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="messages" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="engagement" stroke="#82ca9d" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Language Usage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={newRealTimeStats.languageUsageChart || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ language, percentage }: any) => `${language} ${percentage ? percentage.toFixed(1) : '0'}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="messages"
                      >
                        {(newRealTimeStats.languageUsageChart || []).map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.aiResponseTime}ms</div>
                <p className={`text-xs ${getHealthStatus(analytics.aiResponseTime, [1000, 500])}`}>
                  {analytics.aiResponseTime < 500 ? 'Excellent' : analytics.aiResponseTime < 1000 ? 'Good' : 'Slow'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.userSatisfaction > 0 ? `${analytics.userSatisfaction.toFixed(1)}/5` : '—'}</div>
                <p className="text-xs text-muted-foreground">{analytics.userSatisfaction > 0 ? 'From session ratings' : 'No ratings yet'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Conversation Length</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.conversationLength > 0 ? `${analytics.conversationLength.toFixed(1)} msgs` : '—'}</div>
                <p className="text-xs text-muted-foreground">{analytics.conversationLength > 0 ? 'Per session average' : 'No data yet'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Repeat Users</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.repeatUsers > 0 ? analytics.repeatUsers : '—'}</div>
                <p className="text-xs text-muted-foreground">{analytics.repeatUsers > 0 ? 'From database' : 'No data yet'}</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Response Time Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={newRealTimeStats.responseTimeChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="responseTime" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emotional State Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={newRealTimeStats.emotionalStateDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ emotion, percentage }: any) => `${emotion} ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {(newRealTimeStats.emotionalStateDistribution || []).map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>

          {/* Conversation Quality Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation Quality Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Avg Messages/Session</span>
                    <span className="text-sm">{newRealTimeStats.sessionQualityMetrics.averageMessagesPerSession.toFixed(1)}</span>
                  </div>
                  <Progress value={Math.min(100, newRealTimeStats.sessionQualityMetrics.averageMessagesPerSession * 5)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Avg Session Length</span>
                    <span className="text-sm">{newRealTimeStats.sessionQualityMetrics.averageSessionLength.toFixed(1)}m</span>
                  </div>
                  <Progress value={Math.min(100, newRealTimeStats.sessionQualityMetrics.averageSessionLength * 3)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Retention Rate</span>
                    <span className="text-sm">{newRealTimeStats.sessionQualityMetrics.retentionRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={newRealTimeStats.sessionQualityMetrics.retentionRate} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Avg AI response time</span>
                    <span className="text-sm">{analytics.aiResponseTime > 0 ? `${analytics.aiResponseTime}ms` : '—'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.aiResponseTime > 0 ? 'Measured from recorded chat requests' : 'No measured responses yet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monetization" className="space-y-5">

          {/* ── Top bar: status + date range ── */}
          <div className="flex flex-col gap-3">
            {/* Status + meta info */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className={`flex-1 flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${adsterraStats.configured ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'}`}>
                <div className="flex flex-col gap-0.5">
                  <span className={`font-medium ${adsterraStats.configured ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {adsterraStats.loading
                      ? '🔄 Fetching live data from Adsterra…'
                      : adsterraStats.configured
                        ? '✅ Adsterra Publisher API — live data'
                        : '⚠️ Set ADSTERRA_API_KEY to see revenue data'}
                  </span>
                  {adsterraStats.configured && !adsterraStats.loading && (
                    <span className="text-xs text-muted-foreground">
                      {adsterraStats.dbLastUpdateTime && (
                        <span>Adsterra last synced: <strong>{adsterraStats.dbLastUpdateTime}</strong> · </span>
                      )}
                      {adsterraStats.fetchedAt && (
                        <span>Fetched: {new Date(adsterraStats.fetchedAt).toLocaleTimeString()}</span>
                      )}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { fetchAdsterraStats(adsterraPreset); fetchAdsterraCountries(adsterraPreset); }}
                  disabled={adsterraStats.loading || countryStats.loading}
                  className="h-8 px-3 ml-2 shrink-0"
                  title="Refresh — fetches directly from Adsterra, bypassing all caches"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${adsterraStats.loading ? 'animate-spin' : ''}`} />
                  <span className="text-xs">Refresh</span>
                </Button>
              </div>

              {/* Date preset pills */}
              <div className="flex flex-wrap gap-1 shrink-0">
                {(['1d', '7d', '14d', '30d'] as const).map(p => (
                  <Button key={p} size="sm"
                    variant={adsterraPreset === p ? 'default' : 'outline'}
                    className="h-8 px-3 text-xs"
                    onClick={() => handleAdsterraPreset(p)}
                    disabled={adsterraStats.loading}
                  >
                    {p === '1d' ? 'Today' : p === '7d' ? '7 days' : p === '14d' ? '14 days' : '30 days'}
                  </Button>
                ))}
                <Button size="sm"
                  variant={adsterraPreset === 'custom' ? 'default' : 'outline'}
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowCustomPicker(v => !v)}
                  disabled={adsterraStats.loading}
                >
                  📅 Custom
                </Button>
              </div>
            </div>

            {/* Custom date picker panel */}
            {showCustomPicker && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 bg-muted/40">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">From</label>
                  <input
                    type="date" value={customStart} max={customEnd || today}
                    onChange={e => setCustomStart(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm bg-background"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">To</label>
                  <input
                    type="date" value={customEnd} min={customStart} max={today}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm bg-background"
                  />
                </div>
                <Button size="sm" onClick={handleCustomApply}
                  disabled={!customStart || !customEnd || customStart > customEnd || adsterraStats.loading}
                  className="h-8 px-4 text-xs"
                >
                  Apply
                </Button>
                {adsterraPreset === 'custom' && (
                  <span className="text-xs text-muted-foreground">Showing: {customStart} → {customEnd}</span>
                )}
              </div>
            )}

            {adsterraStats.error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
                <span className="shrink-0">⚠️</span>
                <span>{adsterraStats.error}</span>
              </div>
            )}
          </div>

          {/* ── 5 KPI cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Impressions */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide">Impressions</span>
                  <Eye className="h-3.5 w-3.5 text-violet-500" />
                </div>
                <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                  {adsterraStats.loading ? <span className="text-muted-foreground text-lg">—</span> : formatNumber(adsterraStats.totals.impression)}
                </div>
                <p className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-0.5">
                  {adsterraStats.configured ? `${adsterraPreset === '1d' ? 'Today' : adsterraPreset === 'custom' ? 'Custom range' : adsterraPreset}` : 'awaiting API key'}
                </p>
              </CardContent>
            </Card>

            {/* Clicks */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Clicks</span>
                  <MousePointer className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {adsterraStats.loading ? <span className="text-muted-foreground text-lg">—</span> : formatNumber(adsterraStats.totals.clicks)}
                </div>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                  {adsterraStats.configured && adsterraStats.totals.impression > 0 ? `CTR: ${adsterraStats.totals.ctr.toFixed(4)}%` : '—'}
                </p>
              </CardContent>
            </Card>

            {/* Revenue */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Revenue</span>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {adsterraStats.loading ? <span className="text-muted-foreground text-lg">—</span> : `${adsterraStats.totals.revenue.toFixed(4)}`}
                </div>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Total earned</p>
              </CardContent>
            </Card>

            {/* eCPM */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">eCPM</span>
                  <Globe className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {adsterraStats.loading ? <span className="text-muted-foreground text-lg">—</span>
                    : adsterraStats.configured && adsterraStats.totals.impression > 0
                      ? `${adsterraStats.totals.cpm.toFixed(4)}`
                      : '—'}
                </div>
                <p className={`text-xs mt-0.5 ${adsterraStats.totals.cpm > 2 ? 'text-emerald-600' : adsterraStats.totals.cpm > 1 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {adsterraStats.totals.cpm > 2 ? '🔥 Excellent' : adsterraStats.totals.cpm > 1 ? '✅ Good' : adsterraStats.configured ? 'Building traffic' : 'API key needed'}
                </p>
              </CardContent>
            </Card>

            {/* CTR */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-rose-900/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-rose-700 dark:text-rose-300 uppercase tracking-wide">CTR</span>
                  <Zap className="h-3.5 w-3.5 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-rose-900 dark:text-rose-100">
                  {adsterraStats.loading ? <span className="text-muted-foreground text-lg">—</span>
                    : adsterraStats.configured && adsterraStats.totals.impression > 0
                      ? `${adsterraStats.totals.ctr.toFixed(4)}%`
                      : '—'}
                </div>
                <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-0.5">Click-through rate</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Impressions + Clicks area chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Impressions &amp; Clicks Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Loading chart…</div>}>
                  {adsterraStats.items.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={adsterraStats.items.map((item: any) => ({
                        name: (item.date || item.day || '').slice(5),
                        impressions: item.impression || 0,
                        clicks: item.clicks || 0,
                      }))}>
                        <defs>
                          <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="clkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any, n: any) => [Number(v).toLocaleString(), n === 'impressions' ? 'Impressions' : 'Clicks']} />
                        <Area type="monotone" dataKey="impressions" stroke="#7c3aed" fill="url(#impGrad)" strokeWidth={2} name="impressions" />
                        <Area type="monotone" dataKey="clicks" stroke="#2563eb" fill="url(#clkGrad)" strokeWidth={2} name="clicks" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                      {adsterraStats.loading ? 'Loading…' : adsterraStats.configured ? 'No data for this period' : 'Add ADSTERRA_API_KEY to see chart'}
                    </div>
                  )}
                </ClientOnly>
              </CardContent>
            </Card>

            {/* Revenue + eCPM combo chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue &amp; eCPM Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Loading chart…</div>}>
                  {adsterraStats.items.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={adsterraStats.items.map((item: any) => ({
                        name: (item.date || item.day || '').slice(5),
                        revenue: parseFloat((item.revenue || 0).toFixed(4)),
                        cpm: item.cpm || (item.impression > 0 ? parseFloat(((item.revenue / item.impression) * 1000).toFixed(4)) : 0),
                      }))}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#059669" stopOpacity={0.6}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v: any) => `${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v: any) => `${v}`} />
                        <Tooltip formatter={(v: any, n: any) => [`${Number(v).toFixed(4)}`, n === 'revenue' ? 'Revenue' : 'eCPM']} />
                        <Bar yAxisId="left" dataKey="revenue" fill="url(#revGrad)" name="revenue" radius={[3,3,0,0]} />
                        <Line yAxisId="right" type="monotone" dataKey="cpm" stroke="#f59e0b" strokeWidth={2} dot={false} name="cpm" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                      {adsterraStats.loading ? 'Loading…' : adsterraStats.configured ? 'No data for this period' : 'Add ADSTERRA_API_KEY to see chart'}
                    </div>
                  )}
                </ClientOnly>
              </CardContent>
            </Card>
          </div>

          {/* ── CTR over time ── */}
          {adsterraStats.items.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">CTR Trend (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientOnly fallback={<div className="h-[160px]" />}>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={adsterraStats.items.map((item: any) => ({
                      name: (item.date || item.day || '').slice(5),
                      ctr: item.ctr || (item.impression > 0 ? parseFloat(((item.clicks / item.impression) * 100).toFixed(4)) : 0),
                    }))}>
                      <defs>
                        <linearGradient id="ctrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any) => [`${Number(v).toFixed(4)}%`, 'CTR']} />
                      <Area type="monotone" dataKey="ctr" stroke="#e11d48" fill="url(#ctrGrad)" strokeWidth={2} name="ctr" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          )}

          {/* ── Daily breakdown table ── */}
          {adsterraStats.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Daily Breakdown
                  <Badge variant="outline" className="text-xs font-normal">{adsterraStats.items.length} {adsterraStats.items.length === 1 ? 'day' : 'days'}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground text-xs">
                      <th className="text-left py-2.5 px-4 font-medium">Date</th>
                      <th className="text-right py-2.5 px-3 font-medium">Impressions</th>
                      <th className="text-right py-2.5 px-3 font-medium">Clicks</th>
                      <th className="text-right py-2.5 px-3 font-medium">CTR</th>
                      <th className="text-right py-2.5 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2.5 px-4 font-medium">eCPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsterraStats.items.map((item: any, i: number) => {
                      const imp = item.impression || 0;
                      const clk = item.clicks || 0;
                      const rev = parseFloat(item.revenue || 0);
                      const ctr = item.ctr ?? (imp > 0 ? ((clk / imp) * 100) : 0);
                      const cpm = item.cpm ?? (imp > 0 ? ((rev / imp) * 1000) : 0);
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-4 font-medium">{item.date || item.day || '—'}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{imp.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{clk.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{ctr.toFixed(4)}%</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">${rev.toFixed(4)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums">${cpm.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold text-xs bg-muted/30">
                      <td className="py-2.5 px-4">Totals</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{adsterraStats.totals.impression.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{adsterraStats.totals.clicks.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{adsterraStats.totals.ctr.toFixed(4)}%</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">${adsterraStats.totals.revenue.toFixed(4)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">${adsterraStats.totals.cpm.toFixed(4)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}

          {/* ── Country breakdown ── */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Traffic by Country</CardTitle>
                {countryStats.items.length > 0 && (
                  <Badge variant="outline" className="text-xs font-normal">{countryStats.items.length} countries</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {countryStats.loading ? (
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading country data…</div>
              ) : countryStats.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground text-xs">
                        <th className="text-left py-2.5 px-4 font-medium">#</th>
                        <th className="text-left py-2.5 px-3 font-medium">Country</th>
                        <th className="text-right py-2.5 px-3 font-medium">Impressions</th>
                        <th className="text-right py-2.5 px-3 font-medium">Clicks</th>
                        <th className="text-right py-2.5 px-3 font-medium">CTR</th>
                        <th className="text-right py-2.5 px-3 font-medium">Revenue</th>
                        <th className="text-right py-2.5 px-4 font-medium">eCPM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {countryStats.items.map((item, i) => {
                        const totalImp = adsterraStats.totals.impression;
                        const share = totalImp > 0 ? ((item.impression / totalImp) * 100).toFixed(1) : '0';
                        return (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-4 text-muted-foreground text-xs">{i + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium">{item.country_name || item.country}</div>
                              <div className="text-xs text-muted-foreground">{item.country} · {share}% of traffic</div>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">{item.impression.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums">{item.clicks.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums">{item.ctr.toFixed(4)}%</td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">${item.revenue.toFixed(4)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums">${(item.cpm || 0).toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                  {adsterraStats.configured ? 'No country data for this period' : 'Set ADSTERRA_API_KEY to see country breakdown'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Summary metrics ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue / Click (CPC)</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">
                  {adsterraStats.totals.clicks > 0
                    ? `${(adsterraStats.totals.revenue / adsterraStats.totals.clicks).toFixed(4)}`
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Avg revenue per click</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Country Revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">
                  {countryStats.items.length > 0
                    ? `${countryStats.items[0].revenue.toFixed(4)}`
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {countryStats.items.length > 0 ? `${countryStats.items[0].country_name || countryStats.items[0].country}` : 'No data'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Cost vs Ad Revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">
                  {newRealTimeStats.apiCostMetrics.totalCost > 0
                    ? `${((adsterraStats.totals.revenue / newRealTimeStats.apiCostMetrics.totalCost) * 100).toFixed(0)}%`
                    : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Revenue covers this % of AI cost</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="technical" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cookie Consent Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.values(analytics.cookieConsent).some(v => v > 0) ? (
                  <div className="space-y-4">
                    {Object.entries(analytics.cookieConsent).map(([category, percentage]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium capitalize">{category.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="text-sm">{percentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={percentage} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    No cookie consent data yet — tracked as users accept/decline
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
              </CardHeader>
              <CardContent>
                {realTimeMetrics.topPages.length > 0 ? (
                  <div className="space-y-3">
                    {realTimeMetrics.topPages.map((page) => (
                      <div key={page.page} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{page.page}</span>
                        <Badge variant="outline">{formatNumber(page.views)} views</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    No page view data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* System info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Response Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg AI Response Time</span>
                    <Badge variant={analytics.aiResponseTime > 0 && analytics.aiResponseTime < 1000 ? 'default' : 'secondary'}>
                      {analytics.aiResponseTime > 0 ? `${analytics.aiResponseTime}ms` : '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Conversation Length</span>
                    <Badge variant="secondary">
                      {analytics.conversationLength > 0 ? `${analytics.conversationLength.toFixed(1)} msgs` : '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Session Duration</span>
                    <Badge variant="secondary">
                      {analytics.avgSessionTime > 0 ? `${analytics.avgSessionTime.toFixed(1)}m` : '—'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Analytics DB</span>
                    <Badge variant={dataSource === 'database' ? 'default' : 'secondary'}>
                      {dataSource === 'database' ? '✅ Live' : dataSource === 'fallback' ? '⚠️ Fallback' : '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Adsterra API</span>
                    <Badge variant={adsterraStats.configured ? 'default' : 'secondary'}>
                      {adsterraStats.configured ? '✅ Connected' : '⚠️ No API Key'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Refresh</span>
                    <Badge variant="outline">
                      {lastRefresh ? lastRefresh.toLocaleTimeString() : '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total DB Users</span>
                    <Badge variant="secondary">
                      {analytics.dailyUsers > 0 ? formatNumber(analytics.dailyUsers) : '—'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </CmsWorkspaceShell>
  );
});

export default AnalyticsDashboard;
