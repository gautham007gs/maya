"use client";


import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import ProfileEditor from '@/components/chat/ProfileEditor';
import type { AIProfile, AdminStatusDisplay, ManagedContactStatus, AdSettings, AIMediaAssetsConfig, AIMediaAsset } from '@/types';
import { AD_SETTINGS_CONFIG_KEY, ADMIN_OWN_STATUS_CONFIG_KEY, MANAGED_DEMO_CONTACTS_CONFIG_KEY, AI_MEDIA_ASSETS_CONFIG_KEY } from '@/types';
import { defaultAIProfile, defaultAdminStatusDisplay, defaultManagedContactStatuses, defaultAdSettings, defaultAIMediaAssetsConfig } from '@/config/ai';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import { BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Bar } from '@/components/charts/AdminCharts';
import type { ChartConfig } from "@/components/ui/chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Settings, Palette, Info, CircleUser, Globe, ImagePlus, Music2, Trash2, CirclePlus, PenLine, ChartBarBig, SquarePen, FileText, RefreshCcw, RotateCcw, TrendingUp, KeyRound, Bell, Mic, ExternalLink, LayoutPanelLeft, Database, Terminal, MessageSquare, Users, EyeOff } from "lucide-react"
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';
import { isDatabaseConfigured, db } from '@/lib/dbClient';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIProfile } from '@/contexts/AIProfileContext';
import { useGlobalStatus } from '@/contexts/GlobalStatusContext';
import { useAIMediaAssets } from '@/contexts/AIMediaAssetsContext';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import Image from 'next/image';

// These administrative tools are only needed after their tab is selected.
// Keeping them in separate chunks shortens the first dashboard load.
const AIKeysTab = dynamic(() => import('@/components/admin/AIKeysTab'), { ssr: false });
const NotificationsTab = dynamic(() => import('@/components/admin/NotificationsTab'), { ssr: false });
const VoiceSettingsTab = dynamic(() => import('@/components/admin/VoiceSettingsTab'), { ssr: false });
const AIIgnoreControlTab = dynamic(() => import('@/components/admin/AIIgnoreControlTab'), { ssr: false });


const messagesChartConfig = { messages: { label: "Messages Sent", color: "hsl(var(--chart-2))" } } satisfies ChartConfig;
const dauChartConfig = { active_users: { label: "Active Users", color: "hsl(var(--chart-1))" } } satisfies ChartConfig;

interface DailyCount {
  date: string;
  count: number;
}

const AdminProfilePage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const { aiProfile: contextAIProfile, fetchAIProfile, updateAIProfile, isLoadingAIProfile } = useAIProfile();
  const { adminOwnStatus: contextAdminStatus, managedDemoContacts: contextManagedContacts, fetchGlobalStatuses } = useGlobalStatus();
  const { mediaAssetsConfig: contextMediaAssets, fetchMediaAssets } = useAIMediaAssets();
  const { fetchAdSettings: refreshAdSettingsContext } = useAdSettings();

  const [currentGlobalAIProfile, setCurrentGlobalAIProfile] = useState<AIProfile>(defaultAIProfile);
  const [adminStatus, setAdminStatus] = useState<AdminStatusDisplay>(defaultAdminStatusDisplay);
  const [managedContactStatuses, setManagedContactStatuses] = useState<ManagedContactStatus[]>(defaultManagedContactStatuses);
  const [adSettings, setAdSettings] = useState<AdSettings>(defaultAdSettings);
  const [aiMediaAssets, setAiMediaAssets] = useState<AIMediaAssetsConfig>(defaultAIMediaAssetsConfig);

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newAudioPath, setNewAudioPath] = useState('');
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);

  const [realTotalUserMessages, setRealTotalUserMessages] = useState<number | null>(null);
  const [realTotalAiMessages, setRealTotalAiMessages] = useState<number | null>(null);
  const [realMessagesSentLast7Days, setRealMessagesSentLast7Days] = useState<DailyCount[]>([]);

  const [dailyActiveUsersData, setDailyActiveUsersData] = useState<DailyCount[]>([]);
  const [currentDAU, setCurrentDAU] = useState<number | null>(null);

  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [dbError, setSupabaseError] = useState<string | null>(null);

  // NOTE: combinedIsLoadingDbData is intentionally NOT used to gate the dashboard.
  // Using context loading states as a gate caused the dashboard to flicker:
  // fetchAllNonAnalyticsConfigs calls context fetch functions non-silently,
  // which reset their isLoading flags to true, hiding the dashboard and
  // unmounting/remounting all child components on every config refresh.
  // Instead we gate only on isAuthenticated and track initial load separately.
  // NOTE: combinedIsLoadingDbData intentionally not gating the dashboard (see git history for rationale)
  // Local guard for initial admin data load — shown only on first page open.
  const [isInitialAdminLoad, setIsInitialAdminLoad] = useState(true);

  // Active tab — controlled so we can trigger lazy fetches on tab switch
  const [activeTab, setActiveTab] = useState('kruthika');

  // Listen to ?tab= query parameter on mount and browser navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const readTab = () => {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p) setActiveTab(p);
    };
    readTab();
    window.addEventListener('popstate', readTab);
    return () => window.removeEventListener('popstate', readTab);
  }, []);

  // "View Full Dashboard" navigates to a separate route (/admin/analytics).
  // In dev, Next.js compiles routes on first visit (several seconds) — this
  // flag drives a spinner on the button so that wait doesn't look like a
  // frozen page. See handleViewFullDashboard below.
  const [isNavigatingToDashboard, setIsNavigatingToDashboard] = useState(false);

  // Run-once guards — prevent re-triggering when context function refs change
  const hasFetchedConfigsRef = useRef(false);
  const hasFetchedAdSettingsRef = useRef(false);
  // Guard: analytics should only run once per page session, regardless of re-renders
  const hasFetchedAnalyticsRef = useRef(false);

  // Stable refs for context functions so useCallback deps don't need them
  // (avoids the infinite-loop: fetchFn changes → useCallback changes → useEffect re-runs → fetchFn called → state update → loop)
  const fetchAIProfileRef = useRef<(silent?: boolean) => Promise<void>>(fetchAIProfile);
  const fetchGlobalStatusesRef = useRef<(silent?: boolean) => Promise<void>>(fetchGlobalStatuses);
  const fetchMediaAssetsRef = useRef<(silent?: boolean) => Promise<void>>(fetchMediaAssets);
  const refreshAdSettingsContextRef = useRef<() => Promise<void>>(refreshAdSettingsContext);
  useEffect(() => { fetchAIProfileRef.current = fetchAIProfile; }, [fetchAIProfile]);
  useEffect(() => { fetchGlobalStatusesRef.current = fetchGlobalStatuses; }, [fetchGlobalStatuses]);
  useEffect(() => { fetchMediaAssetsRef.current = fetchMediaAssets; }, [fetchMediaAssets]);
  useEffect(() => { refreshAdSettingsContextRef.current = refreshAdSettingsContext; }, [refreshAdSettingsContext]);

  useEffect(() => {
    fetch('/api/admin/session')
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          router.replace('/admin/login?returnUrl=/admin/profile');
        }
      })
      .catch(() => router.replace('/admin/login?returnUrl=/admin/profile'));
  }, [router]);

  useEffect(() => {
    if (contextAIProfile) {
      setCurrentGlobalAIProfile(contextAIProfile);
    } else if (!isLoadingAIProfile) {
      setCurrentGlobalAIProfile(defaultAIProfile);
    }
  }, [contextAIProfile, isLoadingAIProfile]);

  useEffect(() => {
    if (contextAdminStatus) setAdminStatus(contextAdminStatus);
  }, [contextAdminStatus]);

  useEffect(() => {
    if (contextManagedContacts) setManagedContactStatuses(contextManagedContacts);
  }, [contextManagedContacts]);

  useEffect(() => {
    if (contextMediaAssets) setAiMediaAssets(contextMediaAssets);
  }, [contextMediaAssets]);


  // Fetches profile, statuses, and media assets on login.
  // Ad settings are intentionally excluded — they load lazily when the Ads tab is opened.
  // Uses refs for context functions so this callback's identity is stable
  // (no context functions in deps → no re-creation on context re-render → no loop).
  const fetchAllNonAnalyticsConfigs = useCallback(async () => {
    if (!db) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available.", variant: "destructive" });
      setCurrentGlobalAIProfile(defaultAIProfile);
      setIsInitialAdminLoad(false);
      return;
    }
    try {
      // IMPORTANT: Pass silent=true to all context fetches so they do NOT reset
      // their isLoading flags to true. Resetting those flags made combinedIsLoadingDbData
      // toggle true→false, which unmounted/remounted the entire dashboard on every
      // config refresh and triggered infinite child-component re-fetches.
      await fetchAIProfileRef.current(true);   // fetchAIProfile supports silent param directly
      // fetchGlobalStatuses / fetchMediaAssets public wrappers don't accept silent;
      // call the inner function refs which were captured from the context internals.
      await fetchGlobalStatusesRef.current(true);
      await fetchMediaAssetsRef.current(true);
    } catch (error: any) {
      const errMsg = error instanceof Error
        ? (error.message || error.name || 'Error')
        : (typeof error === 'string' ? error : (error?.message || error?.code || (Object.keys(error ?? {}).length > 0 ? JSON.stringify(error) : 'Unknown DB error')));
      console.error("Failed to load global configurations:", errMsg);
      toast({ title: "Error Loading Configs", description: `Could not load some settings. Using defaults. ${errMsg}`, variant: "destructive" });
      setCurrentGlobalAIProfile(defaultAIProfile);
      setAdminStatus(defaultAdminStatusDisplay);
      setManagedContactStatuses(defaultManagedContactStatuses);
      setAiMediaAssets(defaultAIMediaAssetsConfig);
    } finally {
      setIsInitialAdminLoad(false);
    }
  }, [toast]); // stable — context functions accessed via refs, not closures

  // Fetches ad settings from DB. Called lazily on first "Ads" tab activation
  // (and can be forced by passing forceRefresh=true from a manual refresh button).
  const fetchAdSettingsForTab = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && hasFetchedAdSettingsRef.current) return;
    hasFetchedAdSettingsRef.current = true;

    if (!db) {
      setAdSettings(defaultAdSettings);
      return;
    }
    try {
      const { data: adConfigData, error: adConfigError } = await db
        .from('app_configurations')
        .select('settings')
        .eq('id', AD_SETTINGS_CONFIG_KEY)
        .single();

      if (adConfigError && (adConfigError as any).code !== 'PGRST116') throw adConfigError;
      let adSettingsData: any = adConfigData?.settings;
      while (typeof adSettingsData === 'string') {
        try { adSettingsData = JSON.parse(adSettingsData); } catch { break; }
      }

      const mergedAdSettings: AdSettings = {
        ...defaultAdSettings,
        ...(adSettingsData as Partial<AdSettings>),
        adsterraDirectLink: (adSettingsData as AdSettings)?.adsterraDirectLink ?? defaultAdSettings.adsterraDirectLink,
        adsterraDirectLinkEnabled: (adSettingsData as AdSettings)?.adsterraDirectLinkEnabled ?? defaultAdSettings.adsterraDirectLinkEnabled,
        adsterraSocialBarCode: (adSettingsData as AdSettings)?.adsterraSocialBarCode ?? defaultAdSettings.adsterraSocialBarCode,
        adsterraSocialBarEnabled: (adSettingsData as AdSettings)?.adsterraSocialBarEnabled ?? defaultAdSettings.adsterraSocialBarEnabled,
        maxDirectLinkAdsPerDay: Number((adSettingsData as AdSettings)?.maxDirectLinkAdsPerDay) || defaultAdSettings.maxDirectLinkAdsPerDay,
        maxDirectLinkAdsPerSession: Number((adSettingsData as AdSettings)?.maxDirectLinkAdsPerSession) || defaultAdSettings.maxDirectLinkAdsPerSession,
        directLinkMessageInterval: Number((adSettingsData as AdSettings)?.directLinkMessageInterval) || defaultAdSettings.directLinkMessageInterval,
        directLinkInactivityMinutes: Number((adSettingsData as AdSettings)?.directLinkInactivityMinutes) || defaultAdSettings.directLinkInactivityMinutes,
        instagramDetectionEnabled: (adSettingsData as AdSettings)?.instagramDetectionEnabled ?? defaultAdSettings.instagramDetectionEnabled,
      };
      setAdSettings(mergedAdSettings);
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : (error?.message || 'Unknown error');
      console.error("Failed to load ad settings:", errMsg);
      toast({ title: "Error Loading Ad Settings", description: errMsg, variant: "destructive" });
      setAdSettings(defaultAdSettings);
    }
  }, [toast]);

  // Run once after login — fetches profile/statuses/media. Ad settings are lazy.
  useEffect(() => {
    if (!isAuthenticated || hasFetchedConfigsRef.current) return;
    hasFetchedConfigsRef.current = true;
    fetchAllNonAnalyticsConfigs();
  }, [isAuthenticated, fetchAllNonAnalyticsConfigs]);

  // Lazy-load ad settings the first time the Ads tab is opened.
  useEffect(() => {
    if (activeTab !== 'ads' || !isAuthenticated) return;
    fetchAdSettingsForTab();
  }, [activeTab, isAuthenticated, fetchAdSettingsForTab]);

  // NOTE: we intentionally do NOT auto-warm /admin/analytics in the
  // background when this tab opens. Next.js's dev server (Turbopack)
  // compiles on-demand routes with a lock that stalls the whole dev server —
  // an eager background fetch here was found to freeze totally unrelated
  // requests (including the admin login/session check) for the ~10s the
  // compile takes, which is worse than the original bug. In production this
  // route is precompiled at build time, so there's no such delay to warm up.
  // The click handler below is the only trigger, with a spinner so the
  // one-time dev compile cost is visible instead of looking like a freeze.

  // Navigates to the full analytics dashboard with visible loading feedback,
  // instead of a bare <a href> that gave no indication anything was happening
  // during route compilation. Includes a safety timeout so the button never
  // stays stuck in a "Loading…" state if navigation is interrupted or fails
  // (e.g. blocked by the browser, or a transient routing error) and the page
  // never actually unmounts.
  const handleViewFullDashboard = useCallback(() => {
    setIsNavigatingToDashboard(true);
    router.push('/admin/analytics');
    setTimeout(() => setIsNavigatingToDashboard(false), 15000);
  }, [router]);

  // IMPORTANT: `toast` is intentionally NOT in the dependency array.
  // Even though `toast` from useToast is a stable module-level function, having it
  // in deps was a latent risk. More importantly, `hasFetchedAnalyticsRef` ensures
  // this effect runs exactly once per page session regardless of any re-renders,
  // preventing the "toast call → re-render → effect re-runs → more toast calls" loop.
  useEffect(() => {
    if (!isAuthenticated || hasFetchedAnalyticsRef.current) return;
    hasFetchedAnalyticsRef.current = true;

    // Tracks whether this effect is still mounted — prevents post-unmount
    // state updates from either the timeout or the async fetch.
    let cancelled = false;
    // True once the 8-second safety timer fires, so the async fetch can
    // clear the stale timeout error if it subsequently succeeds.
    let timedOut = false;

    // Safety net: never keep the analytics tab frozen forever.
    // If MySQL is slow / unreachable the sequential queries can block for
    // up to 4 × connectTimeout (10 s each) = 40 s before throwing.
    // This timeout fires after 8 s and clears the spinner so the tab is
    // usable even when the database is unavailable.
    const analyticsTimeoutId = setTimeout(() => {
      if (cancelled) return;
      timedOut = true;
      setSupabaseError('Analytics timed out — database may be slow or unreachable.');
      setRealTotalUserMessages(0);
      setRealTotalAiMessages(0);
      setRealMessagesSentLast7Days([]);
      setDailyActiveUsersData([]);
      setCurrentDAU(0);
      setAnalyticsLoading(false);
    }, 8000);

    async function fetchRealAnalytics() {
      if (cancelled) return;
      if (!db || typeof db.from !== 'function' || !isDatabaseConfigured) {
        if (!cancelled) {
          setSupabaseError("Hostinger DB client is not configured or environment variables are missing. Real analytics will be unavailable. Please check environment variables and HOSTINGER_MYSQL_SETUP.sql.");
          setAnalyticsLoading(false);
          setRealTotalUserMessages(0);
          setRealTotalAiMessages(0);
          setRealMessagesSentLast7Days([]);
          setDailyActiveUsersData([]);
          setCurrentDAU(0);
        }
        return;
      }
      try {
        setAnalyticsLoading(true);
        setSupabaseError(null);

        const { data: userMsgs, error: userMsgError } = await db
          .from('messages_log')
          .select('message_id')
          .eq('sender_type', 'user');
        if (userMsgError) throw userMsgError;
        setRealTotalUserMessages(userMsgs?.length ?? 0);

        const { data: aiMsgs, error: aiMsgError } = await db
          .from('messages_log')
          .select('message_id')
          .eq('sender_type', 'ai');
        if (aiMsgError) throw aiMsgError;
        setRealTotalAiMessages(aiMsgs?.length ?? 0);

        const businessTimezone = 'Asia/Kolkata';
        const dateKeyInBusinessTimezone = (date: Date) => {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: businessTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).formatToParts(date);
          const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
          return `${values.year}-${values.month}-${values.day}`;
        };
        const databaseDateKey = (value: unknown) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
          const parsed = value instanceof Date ? value : new Date(value as string | number);
          return Number.isNaN(parsed.getTime()) ? null : dateKeyInBusinessTimezone(parsed);
        };
        const todayKey = dateKeyInBusinessTimezone(new Date());
        const [year, month, dayOfMonth] = todayKey.split('-').map(Number);
        const businessDays = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(Date.UTC(year, month - 1, dayOfMonth - 6 + index, 12));
          const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
          return {
            key,
            label: new Intl.DateTimeFormat('en', { timeZone: businessTimezone, weekday: 'short' }).format(date),
          };
        });
        const sevenDaysAgo = businessDays[0].key;

        // RPC calls may not be available — handle gracefully with fallback empty arrays
        const { data: dailyMsgCountsData } = await db
          .rpc('get_daily_message_counts', { start_date: sevenDaysAgo });

        const { data: dailyDAUData } = await db
          .rpc('get_daily_active_user_counts', { start_date: sevenDaysAgo });

        const formattedDailyMsgCounts: DailyCount[] = businessDays.map(day => {
          const found = Array.isArray(dailyMsgCountsData)
            ? dailyMsgCountsData.find((d: any) => databaseDateKey(d.date) === day.key)
            : null;
          return { date: day.label, count: found ? Number(found.messages) : 0 };
        });
        setRealMessagesSentLast7Days(formattedDailyMsgCounts);

        const formattedDAUCounts: DailyCount[] = businessDays.map(day => {
          const found = Array.isArray(dailyDAUData)
            ? dailyDAUData.find((d: any) => databaseDateKey(d.date) === day.key)
            : null;
          return { date: day.label, count: found ? Number(found.active_users) : 0 };
        });
        setDailyActiveUsersData(formattedDAUCounts);

        const todayDAU = Array.isArray(dailyDAUData)
          ? dailyDAUData.find((d: any) => databaseDateKey(d.date) === todayKey)
          : null;
        setCurrentDAU(todayDAU ? Number(todayDAU.active_users) : 0);

        // If the safety timer already fired and set an error, clear it now
        // that we have real data — prevents stale timeout errors.
        if (timedOut && !cancelled) setSupabaseError(null);

      } catch (err: any) {
        if (cancelled) return;
        console.error("Error fetching real analytics from Hostinger DB:", err);
        const errorMessage = err.message || "Could not fetch real analytics from Hostinger DB.";
        setSupabaseError(errorMessage);
        // Use toast directly (stable module-level fn) — not the hook's destructured value
        toast({ title: "Analytics Error", description: `${errorMessage} Check HOSTINGER_MYSQL_SETUP.sql and ensure SQL functions exist.`, variant: "destructive" });
        setRealTotalUserMessages(0);
        setRealTotalAiMessages(0);
        setRealMessagesSentLast7Days([]);
        setDailyActiveUsersData([]);
        setCurrentDAU(0);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }

    fetchRealAnalytics().finally(() => clearTimeout(analyticsTimeoutId));

    return () => {
      cancelled = true;
      clearTimeout(analyticsTimeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // toast intentionally omitted — stable fn; hasFetchedAnalyticsRef guards single-run


  const handleSaveKruthikaCoreProfile = async (updatedCoreProfileData: Partial<AIProfile>) => {
    // Construct the data to update, ensuring empty avatarUrl is treated as undefined
    const profileDataToUpdate: Partial<AIProfile> = {
      name: updatedCoreProfileData.name,
      status: updatedCoreProfileData.status,
      avatarUrl: updatedCoreProfileData.avatarUrl?.trim() === '' ? undefined : updatedCoreProfileData.avatarUrl,
    };
    console.log("[AdminProfilePage] handleSaveKruthikaCoreProfile - profileDataToUpdate before calling context update:", JSON.stringify(profileDataToUpdate, null, 2));
    await updateAIProfile(profileDataToUpdate);
    setIsProfileEditorOpen(false);
  };

  const handleSaveKruthikaStory = async () => {
    const storyDataToUpdate: Partial<AIProfile> = {
        statusStoryText: currentGlobalAIProfile.statusStoryText,
        statusStoryImageUrl: currentGlobalAIProfile.statusStoryImageUrl?.trim() === '' ? undefined : currentGlobalAIProfile.statusStoryImageUrl,
        statusStoryMediaUrl: currentGlobalAIProfile.statusStoryMediaUrl?.trim() === '' ? undefined : currentGlobalAIProfile.statusStoryMediaUrl,
        statusStoryMediaType: currentGlobalAIProfile.statusStoryMediaType,
        statusStoryHasUpdate: currentGlobalAIProfile.statusStoryHasUpdate,
    };
    console.log("[AdminProfilePage] handleSaveKruthikaStory - storyDataToUpdate before calling context update:", JSON.stringify(storyDataToUpdate, null, 2));
    await updateAIProfile(storyDataToUpdate);
  };

  const handleClearKruthikaStoryField = (field: 'statusStoryText' | 'statusStoryImageUrl') => {
    setCurrentGlobalAIProfile(p => ({
      ...p,
      [field]: field === 'statusStoryText' ? "" : undefined,
    }));
  };


  const handleSaveAdminStatus = async () => {
    if (!db) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available.", variant: "destructive" });
      return;
    }
    const statusToSave = {
        ...adminStatus,
        statusImageUrl: adminStatus.statusImageUrl?.trim() === '' ? undefined : adminStatus.statusImageUrl,
    };
    try {
      const { error } = await db
        .from('app_configurations')
        .upsert(
          { id: ADMIN_OWN_STATUS_CONFIG_KEY, settings: statusToSave, updated_at: new Date().toISOString() }
        );
      if (error) throw error;
      await fetchGlobalStatuses();
      toast({ title: "Global 'My Status' Saved!", description: "Your status for the Status Page has been updated universally." });
    } catch (error: any)
      {
      console.error("Failed to save 'My Status' to Hostinger DB:", error);
      toast({ title: "Error Saving 'My Status'", description: `Could not save your status globally. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleClearAdminStatusField = (field: 'statusText' | 'statusImageUrl') => {
    setAdminStatus(s => ({
        ...s,
        [field]: field === 'statusText' ? "" : undefined,
    }));
  };


  const handleManagedContactChange = (id: string, field: keyof ManagedContactStatus, value: string | boolean) => {
    setManagedContactStatuses(prev =>
      prev.map(contact => {
        if (contact.id === id) {
          if (field === 'statusImageUrl') {
            return { ...contact, [field]: typeof value === 'string' && value.trim() === '' ? undefined : (value as string) };
          }
          return { ...contact, [field]: value };
        }
        return contact;
      })
    );
  };

  const handleClearManagedContactField = (id: string, field: 'statusText' | 'statusImageUrl') => {
    setManagedContactStatuses(prev =>
      prev.map(contact =>
        contact.id === id
          ? { ...contact, [field]: field === 'statusText' ? "" : undefined }
          : contact
      )
    );
  };

  const handleSaveManagedContactStatuses = async () => {
    if (!db) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await db
        .from('app_configurations')
        .upsert(
          { id: MANAGED_DEMO_CONTACTS_CONFIG_KEY, settings: managedContactStatuses, updated_at: new Date().toISOString() }
        );
      if (error) throw error;
      await fetchGlobalStatuses();
      toast({ title: "Global Demo Contacts Saved!", description: "Status details for demo contacts have been updated universally." });
    } catch (error: any) {
      console.error("Failed to save managed contact statuses to Hostinger DB:", error);
      toast({ title: "Error Saving Demo Contacts", description: `Could not save demo contact statuses globally. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleAdSettingChange = (field: keyof AdSettings, value: string | boolean | number | undefined) => {
    const numericFields: (keyof AdSettings)[] = [
      'maxDirectLinkAdsPerDay', 'maxDirectLinkAdsPerSession',
      'directLinkMessageInterval', 'directLinkInactivityMinutes',
    ];
    if (numericFields.includes(field)) {
        const numValue = Number(value);
        setAdSettings(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
    } else {
        setAdSettings(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleToggleInstagramDetection = async (checked: boolean) => {
    handleAdSettingChange('instagramDetectionEnabled', checked);
    if (!db) return;
    try {
      const updated: AdSettings = { ...adSettings, instagramDetectionEnabled: checked };
      const { error } = await db.from('app_configurations').upsert({
        id: AD_SETTINGS_CONFIG_KEY,
        settings: updated,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      try { await refreshAdSettingsContextRef.current(); } catch (_) {}
      toast({
        title: checked ? "📸 Instagram Detection Enabled" : "📸 Instagram Detection Disabled",
        description: checked
          ? "External browser escape payload (Android intent / iOS modal) is active for Instagram visitors."
          : "Site will run normally inside Instagram without redirect or escape prompt.",
      });
    } catch (err: any) {
      console.warn('Could not auto-save instagram setting:', err);
    }
  };

  const handleResetDirectLink = () => {
    setAdSettings(prev => ({ ...prev, adsterraDirectLink: '' }));
    toast({ title: "Direct Link Cleared", description: "Direct link URL cleared. Paste your own Adsterra link and click 'Save Ad Settings'." });
  };

  const handleSaveAdSettings = async () => {
    if (!db) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available. Cannot save ad settings.", variant: "destructive" });
      return;
    }
    const settingsToSave: AdSettings = {
      ...adSettings,
      // Never fall back to a hardcoded URL — if admin left it empty, save it as empty.
      adsterraDirectLink: adSettings.adsterraDirectLink?.trim() ?? '',
      maxDirectLinkAdsPerDay: Number(adSettings.maxDirectLinkAdsPerDay) || 0,
      maxDirectLinkAdsPerSession: Number(adSettings.maxDirectLinkAdsPerSession) || 0,
      directLinkMessageInterval: Number(adSettings.directLinkMessageInterval) || 10,
      directLinkInactivityMinutes: Number(adSettings.directLinkInactivityMinutes) || 2,
    };
    try {
      const { error } = await db
        .from('app_configurations')
        .upsert(
          { id: AD_SETTINGS_CONFIG_KEY, settings: settingsToSave, updated_at: new Date().toISOString() }
        );
      if (error) throw error;
      // Refresh the global AdSettings context so all pages pick up the new values instantly
      try { await refreshAdSettingsContextRef.current(); } catch (_) {}
      // Re-fetch admin panel's own adSettings state from DB to confirm what was written
      await fetchAdSettingsForTab(true);
      toast({ title: "Global Ad Settings Saved!", description: "Ad configurations have been saved to Hostinger DB and will apply universally." });
    } catch (error: any) {
      console.error("Failed to save ad settings to Hostinger DB:", error);
      toast({ title: "Error Saving Ad Settings", description: `Could not save global ad settings to Hostinger DB. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleAddMediaAsset = (type: 'image' | 'audio') => {
    let urlToAdd = '';
    if (type === 'image') {
      if (!newImageUrl.trim() || !newImageUrl.startsWith('http')) {
        toast({ title: "Invalid Image URL", description: "Please enter a valid, full public URL for the image (starting with http/https).", variant: "destructive" });
        return;
      }
      urlToAdd = newImageUrl.trim();
    } else {
      if (!newAudioPath.trim() || !newAudioPath.startsWith('/media/')) {
        toast({ title: "Invalid Audio Path", description: "Audio path must start with /media/ (e.g., /media/sound.mp3). Ensure file is in public/media/.", variant: "destructive" });
        return;
      }
      urlToAdd = newAudioPath.trim();
    }

    const newAsset: AIMediaAsset = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      url: urlToAdd,
    };
    setAiMediaAssets(prev => ({ assets: [...prev.assets, newAsset] }));
    if (type === 'image') setNewImageUrl('');
    else setNewAudioPath('');
  };

  const handleDeleteMediaAsset = async (assetId: string) => {
    const asset = aiMediaAssets.assets.find(a => a.id === assetId);

    if (!asset) {
      toast({ title: "Error", description: "Asset not found", variant: "destructive" });
      return;
    }

    // Confirm deletion
    if (!confirm(`Delete ${asset.description || 'this media file'}? This action cannot be undone.`)) {
      return;
    }

    // If asset has storage metadata, delete from Hostinger DB Storage first
    if (asset.storagePath && asset.storageBucket) {
      try {
        if (!db) {
          toast({ title: "Error", description: "Hostinger DB client not available", variant: "destructive" });
          return;
        }

        const response = await fetch(`/api/upload?path=${encodeURIComponent(asset.storagePath)}&bucket=${encodeURIComponent(asset.storageBucket)}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const error = await response.json();
          toast({ title: "Storage Delete Error", description: `Failed to delete file from storage: ${error.error || 'Unknown error'}`, variant: "destructive" });
          return;
        }
      } catch (error: any) {
        console.error("Error deleting file from storage:", error);
        toast({ title: "Storage Delete Error", description: `Failed to delete file from storage: ${error.message || 'Unknown error'}`, variant: "destructive" });
        return;
      }
    }

    // Remove from local state and auto-save
    const updatedAssets = { assets: aiMediaAssets.assets.filter(a => a.id !== assetId) };
    setAiMediaAssets(updatedAssets);

    // Auto-save to persist deletion
    if (!db) {
      toast({ title: "Asset Removed", description: "File removed locally. Hostinger DB unavailable - click 'Save' manually.", variant: "destructive" });
      return;
    }

    try {
      const { error: saveError } = await db
        .from('app_configurations')
        .upsert(
          { id: AI_MEDIA_ASSETS_CONFIG_KEY, settings: updatedAssets, updated_at: new Date().toISOString() }
        );

      if (saveError) throw saveError;

      await fetchMediaAssets(); // Refresh from DB
      toast({ title: "Asset Deleted!", description: `${asset.description || 'Media file'} has been permanently deleted.` });
    } catch (saveError: any) {
      console.error("Error auto-saving after deletion:", saveError);
      toast({ title: "Delete OK, Save Failed", description: "File deleted but changes not saved to database. Click 'Save' manually.", variant: "destructive" });
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'audio' | 'video') => {
    if (!file) return;

    setUploadingFile(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      if (!db) {
        throw new Error('Hostinger DB client not available');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      // Create new media asset with storage metadata
      const newAsset: AIMediaAsset = {
        id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        url: result.url,
        storagePath: result.path,
        storageBucket: result.bucket,
        uploadedAt: new Date().toISOString(),
        description: file.name,
      };

      // Update local state
      const updatedAssets = { assets: [...aiMediaAssets.assets, newAsset] };
      setAiMediaAssets(updatedAssets);

      // Auto-save to Hostinger DB to persist immediately
      if (!db) {
        toast({ title: "Warning", description: "File uploaded but Hostinger DB unavailable. Click 'Save' manually.", variant: "destructive" });
        setUploadProgress('');
        setUploadingFile(false);
        return;
      }

      try {
        const { error: saveError } = await db
          .from('app_configurations')
          .upsert(
            { id: AI_MEDIA_ASSETS_CONFIG_KEY, settings: updatedAssets, updated_at: new Date().toISOString() }
          );

        if (saveError) throw saveError;

        await fetchMediaAssets(); // Refresh from DB
        toast({ title: "File Uploaded & Saved!", description: `${file.name} uploaded and saved to database successfully.` });
      } catch (saveError: any) {
        console.error("Error auto-saving uploaded file:", saveError);
        toast({ title: "Upload OK, Save Failed", description: `File uploaded but not saved to database. Click 'Save Global AI Media Assets' manually.`, variant: "destructive" });
      }

      setUploadProgress('');
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload Failed", description: error.message || 'Failed to upload file', variant: "destructive" });
      setUploadProgress('');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveAIMediaAssets = async () => {
    if (!db) {
      toast({ title: "Hostinger DB Error", description: "Hostinger DB client not available.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await db
        .from('app_configurations')
        .upsert(
          { id: AI_MEDIA_ASSETS_CONFIG_KEY, settings: aiMediaAssets, updated_at: new Date().toISOString() }
        );
      if (error) throw error;
      await fetchMediaAssets();
      toast({ title: "Global AI Media Assets Saved!", description: "Kruthika's sharable images and audio have been updated universally." });
    } catch (error: any) {
      console.error("Failed to save AI Media Assets to Hostinger DB:", error);
      toast({ title: "Error Saving AI Media", description: `Could not save AI media assets globally. ${error.message || ''}`, variant: "destructive" });
    }
  };

  const handleForceRefreshGlobalData = async () => {
    toast({ title: "Refreshing...", description: "Manually fetching latest global data from Hostinger DB."});
    await fetchAllNonAnalyticsConfigs();
    toast({ title: "Refreshed!", description: "Global data updated."});
  };


  // Gate: show loading only while we haven't verified the session yet OR during
  // the very first admin data load. We deliberately do NOT gate on combinedIsLoadingDbData
  // (context isLoading flags) because fetchAllNonAnalyticsConfigs triggers context
  // re-fetches that temporarily flip those flags, causing the dashboard to unmount
  // and remount child components in an infinite loop. isInitialAdminLoad is our own
  // controlled flag that is set to false exactly once after the first fetch completes.
  if (!isAuthenticated || isInitialAdminLoad) {
    return <div className="flex justify-center items-center h-screen bg-background text-foreground">Loading admin settings...</div>;
  }

  const scriptPasteInstruction = "Paste the full ad script code provided by the ad network here. Include any <!-- comments --> or <script> tags as provided.";

  let adminPageAvatarUrlToUse = currentGlobalAIProfile.avatarUrl;
  if (!adminPageAvatarUrlToUse || typeof adminPageAvatarUrlToUse !== 'string' || adminPageAvatarUrlToUse.trim() === '' || (!adminPageAvatarUrlToUse.startsWith('http') && !adminPageAvatarUrlToUse.startsWith('data:'))) {
    adminPageAvatarUrlToUse = defaultAIProfile.avatarUrl;
  }
  console.log("[AdminProfilePage] Rendering main avatar. currentGlobalAIProfile.avatarUrl:", currentGlobalAIProfile.avatarUrl, "adminPageAvatarUrlToUse:", adminPageAvatarUrlToUse);


  return (
    <CmsWorkspaceShell
      title="System Settings &amp; Platform Profile"
      eyebrow="Admin Configuration"
      actions={
        <div className="flex items-center gap-2">
          <Button onClick={handleForceRefreshGlobalData} variant="outline" size="sm" className="bg-white hover:bg-slate-50" title="Force refresh all global data from Hostinger DB">
            <RefreshCcw className="mr-1.5 h-4 w-4 text-violet-600" /> Refresh Data
          </Button>
        </div>
      }
    >
      <TooltipProvider>
        <div className="space-y-6">
          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-xs text-violet-900 flex items-start gap-3 shadow-xs">
            <Globe className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900">Global Configuration Notice</p>
              <p className="text-violet-700 mt-0.5 leading-relaxed">
                Settings for Kruthika&apos;s Profile, Ephemeral Story, Sharable Media, Ad Networks, and Managed Contacts are saved globally to your MySQL database and immediately apply to all users across web &amp; mobile clients.
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
              <TabsList className="flex w-max min-w-full h-auto gap-1 bg-transparent p-0">
                <TabsTrigger value="kruthika" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <CircleUser className="mr-1.5 h-4 w-4"/> Persona
                </TabsTrigger>
                <TabsTrigger value="ai_keys" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <KeyRound className="mr-1.5 h-4 w-4"/> AI Models
                </TabsTrigger>
                <TabsTrigger value="voice_keys" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <Mic className="mr-1.5 h-4 w-4"/> Voice Engine
                </TabsTrigger>
                <TabsTrigger value="ai_ignore" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <EyeOff className="mr-1.5 h-4 w-4"/> AI Replies
                </TabsTrigger>
                <TabsTrigger value="notifications" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <Bell className="mr-1.5 h-4 w-4"/> Push Alerts
                </TabsTrigger>
                <TabsTrigger value="instagram" className="min-w-[136px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-violet-600 data-[state=active]:text-white transition-all shadow-xs">
                  <Globe className="mr-1.5 h-4 w-4 text-pink-300"/> Instagram Escape
                </TabsTrigger>
                <TabsTrigger value="ads" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <Settings className="mr-1.5 h-4 w-4"/> Ad Networks
                </TabsTrigger>
                <TabsTrigger value="status_content" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <FileText className="mr-1.5 h-4 w-4"/> Status Page
                </TabsTrigger>
                <TabsTrigger value="analytics" className="min-w-[116px] py-2.5 text-xs font-bold rounded-xl data-[state=active]:bg-violet-600 data-[state=active]:text-white transition-all">
                  <ChartBarBig className="mr-1.5 h-4 w-4"/> Analytics &amp; DB
                </TabsTrigger>
              </TabsList>
            </div>

        <TabsContent value="kruthika">
          <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><PenLine className="mr-2 h-5 w-5 text-violet-600"/> Manage Kruthika's Global Profile</CardTitle>
              <CardDescription className="text-sm">
                Modify Kruthika's main identity (name, avatar, status line). These settings are fetched by all users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-secondary/20 rounded-md">
                <div
                  className={cn(
                    "relative rounded-full shrink-0",
                    currentGlobalAIProfile.name === "Kruthika" && "border-2 border-violet-600 p-0.5"
                  )}
                  key={`admin-page-avatar-wrapper-${adminPageAvatarUrlToUse || 'default_wrapper_key_admin'}`}
                >
                  <Avatar
                    className="h-24 w-24 shadow-md"
                    key={`admin-page-avatar-comp-${adminPageAvatarUrlToUse || 'default_avatar_comp_key_admin'}`}
                  >
                      <AvatarImage
                        src={adminPageAvatarUrlToUse || undefined}
                        alt={currentGlobalAIProfile.name}
                        data-ai-hint="profile woman"
                        key={`admin-page-avatar-img-${adminPageAvatarUrlToUse || 'default_img_key_admin_final'}`}
                        onError={(e) => console.error(`Admin Page - AvatarImage load error for ${currentGlobalAIProfile.name}. URL: ${adminPageAvatarUrlToUse}`, e)}
                      />
                      <AvatarFallback>{(currentGlobalAIProfile.name || 'K').charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-2xl font-semibold">{currentGlobalAIProfile.name}</h3>
                  <p className="text-md text-muted-foreground italic">&quot;{currentGlobalAIProfile.status}&quot;</p>
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-md shadow-sm bg-secondary/20">
                <Label className="font-medium text-sm">Kruthika's Avatar</Label>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Upload Avatar File</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadingFile(true);
                          setUploadProgress(`Uploading ${file.name}...`);

                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('type', 'image');

                            const response = await fetch('/api/upload', { method: 'POST', body: formData });
                            if (!response.ok) throw new Error((await response.json()).error || 'Upload failed');

                            const result = await response.json();
                            setCurrentGlobalAIProfile(p => ({ ...p, avatarUrl: result.url }));

                            toast({ title: "Avatar Uploaded!", description: `${file.name} uploaded successfully.` });
                          } catch (error: any) {
                            toast({ title: "Upload Failed", description: error.message || 'Failed to upload file', variant: "destructive" });
                          } finally {
                            setUploadingFile(false);
                            setUploadProgress('');
                          }
                        }
                      }}
                      className="text-sm"
                      disabled={uploadingFile}
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground">Or add URL</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Avatar URL</Label>
                    <Input
                      type="url"
                      value={currentGlobalAIProfile.avatarUrl || ""}
                      onChange={(e) => setCurrentGlobalAIProfile(p => ({ ...p, avatarUrl: e.target.value }))}
                      placeholder="https://example.com/avatar.jpg"
                      className="text-sm"
                    />
                  </div>
                </div>
                {uploadingFile && uploadProgress && (
                  <div className="text-xs text-muted-foreground animate-pulse">{uploadProgress}</div>
                )}
              </div>

               <Button onClick={() => setIsProfileEditorOpen(true)} className="mt-3 w-full sm:w-auto"><SquarePen className="mr-2 h-4 w-4" />Edit Kruthika's Core Profile (Global)</Button>
               <p className="text-xs text-muted-foreground flex items-center mt-1"><Info size={13} className="mr-1 shrink-0"/>Kruthika's name is primarily defined by her AI persona logic. Editing it here might have limited effect if the AI's core prompt overrides it.</p>
            </CardContent>
            {isProfileEditorOpen && (
              <ProfileEditor
                currentProfile={currentGlobalAIProfile}
                onSave={handleSaveKruthikaCoreProfile}
                onClose={() => setIsProfileEditorOpen(false)}
                isAdminEditor={true}
                isOpen={isProfileEditorOpen}
                onOpenChange={setIsProfileEditorOpen}
              />
            )}
          </Card>

          <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
               <CardTitle className="flex items-center text-xl font-semibold"><Palette className="mr-2 h-5 w-5 text-violet-600"/>Kruthika's Status Story (Global)</CardTitle>
               <CardDescription className="text-sm">Set the ephemeral story (text and media) that appears for Kruthika on the Status page for all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="kruthikaStoryText" className="font-medium text-sm">Story Text</Label>
                  <Textarea
                    id="kruthikaStoryText"
                    value={currentGlobalAIProfile.statusStoryText || ""}
                    onChange={(e) => setCurrentGlobalAIProfile(p => ({ ...p, statusStoryText: e.target.value }))}
                    placeholder="What's Kruthika up to for her story?"
                    className="min-h-[70px]"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="font-medium text-sm">Story Media (Image, Video, or Audio)</Label>

                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Upload Media File</Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*,video/*,audio/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              let type: 'image' | 'audio' | 'video' = 'image';
                              if (file.type.startsWith('video/')) type = 'video';
                              else if (file.type.startsWith('audio/')) type = 'audio';

                              setUploadingFile(true);
                              setUploadProgress(`Uploading ${file.name}...`);

                              try {
                                if (!db) {
                                  throw new Error('DB client not available');
                                }

                                const formData = new FormData();
                                formData.append('file', file);
                                formData.append('type', type);

                                const response = await fetch('/api/upload', {
                                  method: 'POST',
                                  body: formData,
                                  credentials: 'include',
                                });
                                if (!response.ok) throw new Error((await response.json()).error || 'Upload failed');

                                const result = await response.json();
                                setCurrentGlobalAIProfile(p => ({
                                  ...p,
                                  statusStoryMediaUrl: result.url,
                                  statusStoryMediaType: type,
                                  statusStoryImageUrl: type === 'image' ? result.url : p.statusStoryImageUrl
                                }));

                                toast({ title: "File Uploaded!", description: `${file.name} uploaded successfully for story.` });
                              } catch (error: any) {
                                toast({ title: "Upload Failed", description: error.message || 'Failed to upload file', variant: "destructive" });
                              } finally {
                                setUploadingFile(false);
                                setUploadProgress('');
                              }
                            }
                          }}
                          className="flex-grow text-sm"
                          disabled={uploadingFile}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or add URL</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="kruthikaStoryMediaUrl" className="font-medium text-sm">Media URL (Image/Video/Audio)</Label>
                      <Input
                        id="kruthikaStoryMediaUrl"
                        type="url"
                        value={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl || ""}
                        onChange={(e) => setCurrentGlobalAIProfile(p => ({
                          ...p,
                          statusStoryMediaUrl: e.target.value,
                          statusStoryImageUrl: e.target.value
                        }))}
                        placeholder="https://example.com/media.jpg or .mp4 or .mp3"
                      />
                    </div>
                  </div>

                  {(currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl) && (
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
                      {currentGlobalAIProfile.statusStoryMediaType === 'video' ? (
                        <video src={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl} controls className="w-40 h-56 border rounded-md shadow object-cover" />
                      ) : currentGlobalAIProfile.statusStoryMediaType === 'audio' ? (
                        <audio src={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl} controls className="w-full mt-1" />
                      ) : (
                        <Avatar className="w-24 h-40 border rounded-md shadow">
                          <AvatarImage
                            src={currentGlobalAIProfile.statusStoryMediaUrl || currentGlobalAIProfile.statusStoryImageUrl}
                            alt="Story preview"
                            className="object-contain"
                          />
                          <AvatarFallback>Preview</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <Switch
                    id="kruthikaStoryHasUpdate"
                    checked={currentGlobalAIProfile.statusStoryHasUpdate || false}
                    onCheckedChange={(checked) => setCurrentGlobalAIProfile(p => ({ ...p, statusStoryHasUpdate: checked }))}
                  />
                  <Label htmlFor="kruthikaStoryHasUpdate" className="text-sm font-medium">Show as new/unread update (ring on Status Page)</Label>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                    <Button onClick={() => handleClearKruthikaStoryField('statusStoryText')} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Story Text</Button>
                    <Button onClick={() => setCurrentGlobalAIProfile(p => ({ ...p, statusStoryMediaUrl: undefined, statusStoryImageUrl: undefined, statusStoryMediaType: undefined }))} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Story Media</Button>
                </div>
            </CardContent>
            <CardFooter className="mt-2">
                <Button onClick={handleSaveKruthikaStory} className="w-full sm:w-auto"><Palette className="mr-2 h-4 w-4" /> Save Kruthika's Story (Global)</Button>
            </CardFooter>
          </Card>

          <Card className="bg-card text-card-foreground mb-6 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><ImagePlus className="mr-2 h-5 w-5 text-violet-600"/>Kruthika's Sharable Media (Global)</CardTitle>
              <CardDescription className="text-sm">Add or remove images and audio clips Kruthika can proactively share during chats. These are fetched by all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-secondary/20">
                <h4 className="text-lg font-semibold text-violet-600 flex items-center"><ImagePlus className="mr-2 h-4 w-4"/>Images</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Upload Image File</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'image');
                        }}
                        className="flex-grow text-sm"
                        disabled={uploadingFile}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground">Or add URL</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newImageUrl" className="text-sm font-medium">Image URL (Publicly Accessible)</Label>
                    <div className="flex gap-2">
                      <Input id="newImageUrl" type="url" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://example.com/image.png" className="flex-grow text-sm"/>
                      <Button onClick={() => handleAddMediaAsset('image')} variant="outline" size="icon"><CirclePlus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
                {uploadingFile && uploadProgress && (
                  <div className="text-xs text-muted-foreground animate-pulse">{uploadProgress}</div>
                )}
                {aiMediaAssets.assets.filter(asset => asset.type === 'image').length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-2 bg-background rounded border">
                    {aiMediaAssets.assets.filter(asset => asset.type === 'image').map(asset => (
                      <div key={asset.id} className="flex items-center justify-between p-2 bg-card border rounded-md hover:bg-secondary/30">
                        <div className="flex items-center gap-3 overflow-hidden">
                           <Avatar className="h-10 w-10 rounded border" key={`${asset.id}-thumb-${asset.url}`}><AvatarImage src={asset.url} alt="Thumbnail" data-ai-hint="thumbnail image" onError={(e) => console.error(`Admin Page - AI Media Image thumb load error. URL: ${asset.url}`, e)} /><AvatarFallback><ImagePlus size={16}/></AvatarFallback></Avatar>
                           <span className="text-xs truncate text-muted-foreground">{asset.url}</span>
                        </div>
                        <Button onClick={() => handleDeleteMediaAsset(asset.id)} variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground p-2">No images added yet. Add public image URLs for Kruthika to share.</p>}
              </div>
              <div className="space-y-4 p-4 border rounded-md shadow-sm bg-secondary/20">
                <h4 className="text-lg font-semibold text-violet-600 flex items-center"><Music2 className="mr-2 h-4 w-4"/>Audio Clips</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Upload Audio File</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'audio');
                        }}
                        className="flex-grow text-sm"
                        disabled={uploadingFile}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-secondary/20 px-2 text-muted-foreground">Or add path</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newAudioPath" className="text-sm font-medium">Audio File Path (from `public/media/`)</Label>
                    <div className="flex gap-2">
                      <Input id="newAudioPath" type="text" value={newAudioPath} onChange={(e) => setNewAudioPath(e.target.value)} placeholder="/media/sound.mp3" className="flex-grow text-sm"/>
                      <Button onClick={() => handleAddMediaAsset('audio')} variant="outline" size="icon"><CirclePlus className="h-4 w-4" /></Button>
                    </div>
                    <Alert variant="default" className="mt-2 py-2 px-3 text-xs bg-background/70 border-border">
                      <Info size={14} className="mr-1 !text-muted-foreground" />
                      <AlertDescription className="!text-muted-foreground">Audio files must be placed in the `public/media/` folder of your project first. Then, add the path here (e.g., `/media/your_clip.mp3`).</AlertDescription>
                    </Alert>
                  </div>
                </div>
                {uploadingFile && uploadProgress && (
                  <div className="text-xs text-muted-foreground animate-pulse">{uploadProgress}</div>
                )}
                 {aiMediaAssets.assets.filter(asset => asset.type === 'audio').length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-2 bg-background rounded border">
                    {aiMediaAssets.assets.filter(asset => asset.type === 'audio').map(asset => (
                      <div key={asset.id} className="flex items-center justify-between p-2 bg-card border rounded-md hover:bg-secondary/30">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Music2 className="h-5 w-5 text-muted-foreground shrink-0"/>
                            <span className="text-xs truncate text-muted-foreground">{asset.url}</span>
                        </div>
                        <Button onClick={() => handleDeleteMediaAsset(asset.id)} variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground p-2">No audio clips added yet. Upload files to `public/media/` and add their paths.</p>}
              </div>
            </CardContent>
            <CardFooter className="mt-2">
              <Button onClick={handleSaveAIMediaAssets} className="w-full sm:w-auto"><ImagePlus className="mr-2 h-4 w-4"/>Save AI Media Assets (Global)</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="instagram">
          <Card className="bg-card text-card-foreground mb-8 shadow-lg border-violet-100">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center text-xl font-bold">
                    <Globe className="mr-2 h-5 w-5 text-pink-600"/> 📸 Instagram Browser Detection &amp; Auto-Escape
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Control how the site behaves when visitors click your site link from Instagram, Threads, or other in-app web views.
                  </CardDescription>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
                  (adSettings.instagramDetectionEnabled ?? true)
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {(adSettings.instagramDetectionEnabled ?? true) ? '● ACTIVE (Auto-Escape ON)' : '○ DISABLED (In-App Browsing)'}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Primary Toggle Switch */}
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-violet-50/80 via-pink-50/50 to-amber-50/40 rounded-2xl border border-violet-200/80 shadow-xs">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="instagramDetectionEnabledDedicated" className="text-base font-bold text-slate-900 cursor-pointer flex items-center gap-2">
                    Enable Instagram In-App Browser Auto-Escape
                  </Label>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    When ON: any user clicking your link on Instagram is immediately escaped to an external browser (Google Chrome on Android via intent payload, and guided to open Safari on iOS). This prevents cookie wipes, blocked logins, sound playback restrictions, and guarantees all ads and chats function normally.
                  </p>
                </div>
                <Switch
                  id="instagramDetectionEnabledDedicated"
                  checked={adSettings.instagramDetectionEnabled ?? true}
                  onCheckedChange={handleToggleInstagramDetection}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-pink-500 data-[state=checked]:to-violet-600 ml-4 shrink-0"
                />
              </div>

              {/* Breakdown cards */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">1</span>
                    Android Automatic Escape (Chrome Intent)
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Immediately fires a native Android intent (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">intent://...#Intent;scheme=https;package=com.android.chrome;end;</code>) that breaks the restricted WebView and launches Google Chrome automatically without requiring manual user tapping.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">2</span>
                    iOS Guide Overlay (Safari Escape)
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Displays an intuitive, high-converting banner with an arrow showing users how to tap the top-right <strong className="text-slate-700">••• menu</strong> and choose <strong className="text-slate-700">&quot;Open in external browser / Safari&quot;</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <p className="font-semibold mb-0.5">Instant Global Sync</p>
                  Changes made to this switch are automatically saved to your MySQL database (<code className="font-mono text-[11px] bg-white px-1 rounded border border-blue-200">app_configurations</code>) and take effect immediately across all visitors without restarting the server.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads">
           <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><Settings className="mr-2 h-5 w-5 text-violet-600"/>Manage Global Ad Settings</CardTitle>
              <CardDescription className="text-sm">
                Control global ad visibility, direct links, and various ad types. These settings are fetched by all users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="flex items-center space-x-3 p-4 bg-secondary/30 rounded-md shadow-inner">
                <Switch id="adsEnabledGlobally" checked={adSettings.adsEnabledGlobally} onCheckedChange={(checked) => handleAdSettingChange('adsEnabledGlobally', checked)}/>
                <Label htmlFor="adsEnabledGlobally" className="text-md font-semibold">Enable All Ads Globally</Label>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-md border border-border">
                <div className="space-y-0.5">
                  <Label htmlFor="instagramDetectionEnabled" className="text-sm font-semibold flex items-center gap-2">
                    📸 Instagram Browser Detection
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When ON: users opening the site inside Instagram are prompted to open in Safari/Chrome for best experience.
                    When OFF: site runs normally inside Instagram browser.
                  </p>
                </div>
                <Switch
                  id="instagramDetectionEnabled"
                  checked={adSettings.instagramDetectionEnabled ?? true}
                  onCheckedChange={handleToggleInstagramDetection}
                  className="ml-4 shrink-0"
                />
              </div>

              {/* ── Live Ad Preview Panel ──────────────────────────────────────── */}
              <Card className="bg-secondary/10 border-border shadow-sm">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-lg font-semibold text-violet-600 flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5"/>Live Ad Preview
                  </CardTitle>
                  <CardDescription className="text-sm">
                    See every active ad unit and open a sandboxed preview in a new tab. Ads only render fully on your live domain (kruthika.fun) due to browser same-origin policies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                      {(() => {
                        const adSlots: { label: string; size: string; network: string; code: string; enabled: boolean; mobile?: boolean }[] = [
                      { label: 'Popunder',              size: 'tab',       network: 'Adsterra', code: adSettings.adsterraPopunderCode || '',         enabled: adSettings.adsterraPopunderEnabled },
                      { label: 'Native Banner',         size: 'fluid',     network: 'Adsterra', code: adSettings.adsterraNativeBannerCode || '',     enabled: adSettings.adsterraNativeBannerEnabled },
                      { label: 'Social Bar',            size: 'sticky',    network: 'Adsterra', code: adSettings.adsterraSocialBarCode || '',        enabled: adSettings.adsterraSocialBarEnabled },
                      { label: '468×60 Banner',         size: '468×60',    network: 'Adsterra', code: adSettings.adsterraBanner468x60Code || '',    enabled: adSettings.adsterraBanner468x60Enabled ?? false },
                      { label: '160×300 Banner',        size: '160×300',   network: 'Adsterra', code: adSettings.adsterraBanner160x300Code || '',   enabled: adSettings.adsterraBanner160x300Enabled ?? false },
                      { label: '320×50 Mobile Banner',  size: '320×50',    network: 'Adsterra', code: adSettings.adsterraBanner320x50Code || '',    enabled: adSettings.adsterraBanner320x50Enabled, mobile: true },
                      { label: '300×250 Rectangle',     size: '300×250',   network: 'Adsterra', code: adSettings.adsterraBanner300x250Code || '',   enabled: adSettings.adsterraBanner300x250Enabled },
                      { label: '160×600 Skyscraper',    size: '160×600',   network: 'Adsterra', code: adSettings.adsterraBanner160x600Code || '',   enabled: adSettings.adsterraBanner160x600Enabled },
                      { label: '728×90 Leaderboard',    size: '728×90',    network: 'Adsterra', code: adSettings.adsterraBanner728x90Code || '',    enabled: adSettings.adsterraBanner728x90Enabled },
                    ];
                    const active = adSlots.filter(s => s.enabled && s.code && !s.code.includes('Placeholder') && s.code.trim().length > 10);
                    const openPreview = (code: string, label: string, network: string) => {
                      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ad Preview: ${label} (${network})</title><style>body{margin:0;padding:16px;background:#f5f5f5;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}.info{font-size:13px;color:#666;margin-bottom:12px;text-align:center}.ad-wrap{background:#fff;padding:8px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);min-width:320px;display:flex;justify-content:center;align-items:center}</style></head><body><div class="info"><b>${network}</b> — ${label} (${new Date().toLocaleTimeString()})<br><small>Preview may differ on live domain due to ad targeting</small></div><div class="ad-wrap">${code}</div></body></html>`;
                      const blob = new Blob([html], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                    };
                    if (active.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <p className="font-medium mb-1">No active ad codes yet</p>
                          <p className="text-xs">Enable ad types and paste your ad codes below — they'll appear here for preview.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {active.map((slot, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border/60 gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${slot.network === 'Adsterra' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{slot.network}</span>
                                {slot.mobile && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">📱 Mobile</span>}
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{slot.size}</span>
                              </div>
                              <p className="text-sm font-medium mt-0.5 truncate">{slot.label}</p>
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0 text-xs h-8" onClick={() => openPreview(slot.code, slot.label, slot.network)}>
                              <ExternalLink size={12} className="mr-1"/> Preview
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="bg-secondary/10 border-border shadow-sm">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-lg font-semibold text-violet-600 flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>Direct Link Ad Frequency</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="maxDirectLinkAdsPerDay" className="font-medium text-sm">Max Direct Link Ads Per User Per Day</Label>
                    <Input
                      id="maxDirectLinkAdsPerDay"
                      type="number"
                      value={adSettings.maxDirectLinkAdsPerDay}
                      onChange={(e) => handleAdSettingChange('maxDirectLinkAdsPerDay', e.target.value)}
                      placeholder="e.g., 6"
                      className="text-sm"
                      disabled={!adSettings.adsEnabledGlobally}
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">Total direct link pop-ups a user might see in 24 hours.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxDirectLinkAdsPerSession" className="font-medium text-sm">Max Direct Link Ads Per User Per Session</Label>
                    <Input
                      id="maxDirectLinkAdsPerSession"
                      type="number"
                      value={adSettings.maxDirectLinkAdsPerSession}
                      onChange={(e) => handleAdSettingChange('maxDirectLinkAdsPerSession', e.target.value)}
                      placeholder="e.g., 3"
                      className="text-sm"
                      disabled={!adSettings.adsEnabledGlobally}
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">Max direct link pop-ups in a single browser session.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="directLinkMessageInterval" className="font-medium text-sm">Messages Between Direct Link Triggers</Label>
                    <Input
                      id="directLinkMessageInterval"
                      type="number"
                      value={adSettings.directLinkMessageInterval ?? 10}
                      onChange={(e) => handleAdSettingChange('directLinkMessageInterval', e.target.value)}
                      placeholder="10"
                      className="text-sm"
                      disabled={!adSettings.adsEnabledGlobally}
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">How many chat messages must be exchanged before a direct link ad can trigger again.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="directLinkInactivityMinutes" className="font-medium text-sm">Inactivity Trigger (minutes)</Label>
                    <Input
                      id="directLinkInactivityMinutes"
                      type="number"
                      value={adSettings.directLinkInactivityMinutes ?? 2}
                      onChange={(e) => handleAdSettingChange('directLinkInactivityMinutes', e.target.value)}
                      placeholder="2"
                      className="text-sm"
                      disabled={!adSettings.adsEnabledGlobally}
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">Minutes of user inactivity before a direct link ad may also trigger. Helps catch re-opening users.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Adsterra Settings Group */}
              <Card className="bg-secondary/10 border-border shadow-sm">
                <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-lg font-semibold text-violet-600 flex items-center"><ExternalLink className="mr-2 h-5 w-5"/>Adsterra Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 px-4 pb-4">
                    {/* Adsterra Direct Link */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="adsterraDirectLink" className="font-medium text-sm">Direct Link URL</Label>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleResetDirectLink()} disabled={!adSettings.adsEnabledGlobally} className="h-7 w-7 text-muted-foreground hover:text-violet-600"><RotateCcw size={16}/></Button></TooltipTrigger><TooltipContent side="top"><p>Clear Direct Link URL</p></TooltipContent></Tooltip>
                      </div>
                      <Input id="adsterraDirectLink" type="url" value={adSettings.adsterraDirectLink} onChange={(e) => handleAdSettingChange('adsterraDirectLink', e.target.value)} placeholder="https://www.profitablecpmrate.com/your-link?key=..." className="text-sm" disabled={!adSettings.adsEnabledGlobally}/>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraDirectLinkEnabled" checked={adSettings.adsterraDirectLinkEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraDirectLinkEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraDirectLinkEnabled" className="text-sm font-medium">Enable Adsterra Direct Link</Label></div>
                    </div>
                    {/* Adsterra Banner Sizes — info box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                      <p className="font-semibold">📐 Banner Size Guide (Adsterra)</p>
                      <p>• <b>468×60</b> — Classic Leaderboard (general purpose, desktop)</p>
                      <p>• <b>160×300</b> — Half-Page Small (sidebar, desktop)</p>
                      <p>• <b>320×50</b> — Mobile Banner (phone footer/chat input, thin bar) 📱</p>
                      <p>• <b>300×250</b> — Medium Rectangle (best eCPM, works everywhere) ⭐</p>
                      <p>• <b>160×600</b> — Wide Skyscraper (desktop sidebar) 💻</p>
                      <p>• <b>728×90</b> — Leaderboard (desktop header/footer) 💻</p>
                    </div>

                    {/* Adsterra Pop-under */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraPopunderCode" className="font-medium text-sm flex items-center gap-2">Popunder Script Code <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">⭐ Best</span></Label>
                      <Textarea id="adsterraPopunderCode" value={adSettings.adsterraPopunderCode} onChange={(e) => handleAdSettingChange('adsterraPopunderCode', e.target.value)} placeholder="<!-- Adsterra Popunder Script -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <p className="text-xs text-amber-600 mt-1">⚠️ Blocked on Instagram browser (iOS + Android). Auto-skipped.</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraPopunderEnabled" checked={adSettings.adsterraPopunderEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraPopunderEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraPopunderEnabled" className="text-sm font-medium">Enable Adsterra Popunder</Label></div>
                    </div>

                    {/* Adsterra Native Banner */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraNativeBannerCode" className="font-medium text-sm">Native Banner Code (Blog Pages)</Label>
                      <Textarea id="adsterraNativeBannerCode" value={adSettings.adsterraNativeBannerCode} onChange={(e) => handleAdSettingChange('adsterraNativeBannerCode', e.target.value)} placeholder="<!-- Adsterra Native Banner Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraNativeBannerEnabled" checked={adSettings.adsterraNativeBannerEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraNativeBannerEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraNativeBannerEnabled" className="text-sm font-medium">Enable Adsterra Native Banner</Label></div>
                    </div>

                    {/* Adsterra Social Bar */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraSocialBarCode" className="font-medium text-sm">Social Bar Code</Label>
                      <Textarea id="adsterraSocialBarCode" value={adSettings.adsterraSocialBarCode} onChange={(e) => handleAdSettingChange('adsterraSocialBarCode', e.target.value)} placeholder="<!-- Adsterra Social Bar Code -->" className="min-h-[100px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center"><Info size={13} className="mr-1 shrink-0"/>{scriptPasteInstruction}</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraSocialBarEnabled" checked={adSettings.adsterraSocialBarEnabled} onCheckedChange={(checked) => handleAdSettingChange('adsterraSocialBarEnabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraSocialBarEnabled" className="text-sm font-medium">Enable Adsterra Social Bar</Label></div>
                    </div>

                    {/* 468×60 Classic Leaderboard */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraBanner468x60Code" className="font-medium text-sm flex items-center gap-2">468×60 Classic Leaderboard</Label>
                      <Textarea id="adsterraBanner468x60Code" value={adSettings.adsterraBanner468x60Code ?? ''} onChange={(e) => handleAdSettingChange('adsterraBanner468x60Code', e.target.value)} placeholder="<!-- Adsterra 468x60 Banner Code -->" className="min-h-[80px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-muted-foreground mt-1">General purpose leaderboard — desktop and tablet.</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraBanner468x60Enabled" checked={adSettings.adsterraBanner468x60Enabled ?? false} onCheckedChange={(checked) => handleAdSettingChange('adsterraBanner468x60Enabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraBanner468x60Enabled" className="text-sm font-medium">Enable 468×60 Leaderboard</Label></div>
                    </div>

                    {/* 160×300 Half-Page Small */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraBanner160x300Code" className="font-medium text-sm flex items-center gap-2">160×300 Half-Page Small <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">💻 Sidebar</span></Label>
                      <Textarea id="adsterraBanner160x300Code" value={adSettings.adsterraBanner160x300Code ?? ''} onChange={(e) => handleAdSettingChange('adsterraBanner160x300Code', e.target.value)} placeholder="<!-- Adsterra 160x300 Banner Code -->" className="min-h-[80px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-indigo-700 mt-1">💻 Desktop sidebar half-page small format.</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraBanner160x300Enabled" checked={adSettings.adsterraBanner160x300Enabled ?? false} onCheckedChange={(checked) => handleAdSettingChange('adsterraBanner160x300Enabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraBanner160x300Enabled" className="text-sm font-medium">Enable 160×300 Half-Page Small</Label></div>
                    </div>

                    {/* 320×50 Mobile Banner */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraBanner320x50Code" className="font-medium text-sm flex items-center gap-2">320×50 Mobile Banner <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">📱 Mobile</span></Label>
                      <Textarea id="adsterraBanner320x50Code" value={adSettings.adsterraBanner320x50Code ?? ''} onChange={(e) => handleAdSettingChange('adsterraBanner320x50Code', e.target.value)} placeholder="<!-- Adsterra 320x50 Mobile Banner Code -->" className="min-h-[80px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-purple-700 mt-1">📱 Shown on mobile devices in chat input slot &amp; homepage footer. Thin 320×50 bar.</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraBanner320x50Enabled" checked={adSettings.adsterraBanner320x50Enabled ?? false} onCheckedChange={(checked) => handleAdSettingChange('adsterraBanner320x50Enabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraBanner320x50Enabled" className="text-sm font-medium">Enable 320×50 Mobile Banner</Label></div>
                    </div>

                    {/* 300×250 Medium Rectangle */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraBanner300x250Code" className="font-medium text-sm flex items-center gap-2">300×250 Medium Rectangle <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">⭐ Best eCPM</span></Label>
                      <Textarea id="adsterraBanner300x250Code" value={adSettings.adsterraBanner300x250Code ?? ''} onChange={(e) => handleAdSettingChange('adsterraBanner300x250Code', e.target.value)} placeholder="<!-- Adsterra 300x250 Medium Rectangle Code -->" className="min-h-[80px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-blue-700 mt-1">⭐ Highest eCPM banner — works on all devices. Used in chat, status, between-chats slots.</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraBanner300x250Enabled" checked={adSettings.adsterraBanner300x250Enabled ?? false} onCheckedChange={(checked) => handleAdSettingChange('adsterraBanner300x250Enabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraBanner300x250Enabled" className="text-sm font-medium">Enable 300×250 Medium Rectangle</Label></div>
                    </div>

                    {/* 160×600 Wide Skyscraper */}
                    <div className="border-b border-border/50 pb-4 space-y-2">
                      <Label htmlFor="adsterraBanner160x600Code" className="font-medium text-sm flex items-center gap-2">160×600 Wide Skyscraper <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">💻 Desktop</span></Label>
                      <Textarea id="adsterraBanner160x600Code" value={adSettings.adsterraBanner160x600Code ?? ''} onChange={(e) => handleAdSettingChange('adsterraBanner160x600Code', e.target.value)} placeholder="<!-- Adsterra 160x600 Skyscraper Code -->" className="min-h-[80px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-indigo-700 mt-1">💻 Tall vertical desktop sidebar banner — for blog pages with sidebar layout.</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraBanner160x600Enabled" checked={adSettings.adsterraBanner160x600Enabled ?? false} onCheckedChange={(checked) => handleAdSettingChange('adsterraBanner160x600Enabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraBanner160x600Enabled" className="text-sm font-medium">Enable 160×600 Skyscraper</Label></div>
                    </div>

                    {/* 728×90 Leaderboard */}
                    <div className="space-y-2">
                      <Label htmlFor="adsterraBanner728x90Code" className="font-medium text-sm flex items-center gap-2">728×90 Leaderboard <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">💻 Desktop</span></Label>
                      <Textarea id="adsterraBanner728x90Code" value={adSettings.adsterraBanner728x90Code ?? ''} onChange={(e) => handleAdSettingChange('adsterraBanner728x90Code', e.target.value)} placeholder="<!-- Adsterra 728x90 Leaderboard Code -->" className="min-h-[80px] font-mono text-xs" disabled={!adSettings.adsEnabledGlobally}/>
                      <p className="text-xs text-indigo-700 mt-1">💻 Shown on desktop in homepage footer and blog header — wide horizontal bar.</p>
                      <div className="flex items-center space-x-2 pt-1"><Switch id="adsterraBanner728x90Enabled" checked={adSettings.adsterraBanner728x90Enabled ?? false} onCheckedChange={(checked) => handleAdSettingChange('adsterraBanner728x90Enabled', checked)} disabled={!adSettings.adsEnabledGlobally}/><Label htmlFor="adsterraBanner728x90Enabled" className="text-sm font-medium">Enable 728×90 Leaderboard</Label></div>
                    </div>
                </CardContent>
              </Card>

              {/* Per-Placement Toggles */}
              <Card className="bg-secondary/10 border-border shadow-sm mt-6">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-lg font-semibold text-violet-600 flex items-center"><LayoutPanelLeft className="mr-2 h-5 w-5"/>Per-Placement Controls</CardTitle>
                  <CardDescription className="text-sm">Enable or disable individual ad slots across each page. These override ad code settings per placement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Homepage — Footer Banner</p>
                        <p className="text-xs text-muted-foreground">Fixed bottom bar on home screen</p>
                      </div>
                      <Switch checked={adSettings.placementHomepageFooterEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementHomepageFooterEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Homepage — Between Chats</p>
                        <p className="text-xs text-muted-foreground">Banner in the welcome section</p>
                      </div>
                      <Switch checked={adSettings.placementHomepageBetweenChatsEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementHomepageBetweenChatsEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Chat — Top Banner</p>
                        <p className="text-xs text-muted-foreground">Just below the chat header</p>
                      </div>
                      <Switch checked={adSettings.placementChatTopBannerEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementChatTopBannerEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Chat — Above Input</p>
                        <p className="text-xs text-muted-foreground">Banner above the message input</p>
                      </div>
                      <Switch checked={adSettings.placementChatInputBannerEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementChatInputBannerEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Status Page — Footer</p>
                        <p className="text-xs text-muted-foreground">Banner at the bottom of status list</p>
                      </div>
                      <Switch checked={adSettings.placementStatusBannerEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementStatusBannerEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Blog — All Placements</p>
                        <p className="text-xs text-muted-foreground">Header, mid, footer banners on blog</p>
                      </div>
                      <Switch checked={adSettings.placementBlogEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementBlogEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Bar — one instance per page (never more than one live at once) */}
              <Card className="bg-secondary/10 border-border shadow-sm mt-6">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-lg font-semibold text-violet-600 flex items-center"><LayoutPanelLeft className="mr-2 h-5 w-5"/>Social Bar — Per-Page Controls</CardTitle>
                  <CardDescription className="text-sm">Interstitial-only Social Bar (configured with your Adsterra account manager). Each page mounts and tears down its own single instance — never more than one live at a time. Automatically skipped inside Instagram/Facebook/TikTok in-app browsers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Homepage</p>
                        <p className="text-xs text-muted-foreground">Chat list screen</p>
                      </div>
                      <Switch checked={adSettings.placementHomepageSocialBarEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementHomepageSocialBarEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Chat Page</p>
                        <p className="text-xs text-muted-foreground">Highest time-on-page in the app</p>
                      </div>
                      <Switch checked={adSettings.placementChatSocialBarEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementChatSocialBarEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Status Page</p>
                        <p className="text-xs text-muted-foreground">Contact/status list</p>
                      </div>
                      <Switch checked={adSettings.placementStatusSocialBarEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementStatusSocialBarEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Blog</p>
                        <p className="text-xs text-muted-foreground">Index + individual posts</p>
                      </div>
                      <Switch checked={adSettings.placementBlogSocialBarEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementBlogSocialBarEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Desktop Skyscraper Rail — uses the 160x600/160x300 zones, wide viewports only */}
              <Card className="bg-secondary/10 border-border shadow-sm mt-6">
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-lg font-semibold text-violet-600 flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>Desktop Skyscraper Rail</CardTitle>
                  <CardDescription className="text-sm">Fixed-position 160×600 (falls back to 160×300) docked to the right edge, shown only on viewports ≥1200px so it never competes with the centered app shell. Uses the sizes configured above — no separate code field needed.</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50">
                    <div>
                      <p className="text-sm font-medium">Enable on Homepage, Chat &amp; Status</p>
                      <p className="text-xs text-muted-foreground">Requires the 160×600 or 160×300 code above to be filled in and enabled</p>
                    </div>
                    <Switch checked={adSettings.placementDesktopRailEnabled ?? true} onCheckedChange={(c) => handleAdSettingChange('placementDesktopRailEnabled', c)} disabled={!adSettings.adsEnabledGlobally}/>
                  </div>
                </CardContent>
              </Card>

            </CardContent>

            <CardFooter className="mt-4">
              <Button onClick={handleSaveAdSettings} className="w-full sm:w-auto text-base py-3 px-6"><Settings className="mr-2 h-5 w-5" /> Save Global Ad Settings</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="status_content">
          <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><CircleUser className="mr-2 h-5 w-5 text-violet-600"/>Admin: Your Display on Status Page (Global)</CardTitle>
              <CardDescription className="text-sm">Set your own entry that appears under "My Status" on the Status page. This is visible to all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusName" className="font-medium text-sm">Display Name for "My Status"</Label>
                <Input id="adminStatusName" value={adminStatus.name} onChange={(e) => setAdminStatus(s => ({ ...s, name: e.target.value }))} placeholder="e.g., My Status, John Doe" className="text-sm"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusAvatarUrl" className="font-medium text-sm">Your Avatar URL (Publicly Accessible)</Label>
                <Input id="adminStatusAvatarUrl" type="url" value={adminStatus.avatarUrl} onChange={(e) => setAdminStatus(s => ({ ...s, avatarUrl: e.target.value }))} placeholder="https://placehold.co/100x100.png" className="text-sm"/>
                 {adminStatus.avatarUrl && adminStatus.avatarUrl.trim() !== '' && (<Avatar className="w-20 h-20 mt-2 border rounded-full shadow" key={`admin-status-avatar-${adminStatus.avatarUrl}`}><AvatarImage src={adminStatus.avatarUrl} alt="Your avatar preview" data-ai-hint="profile self admin" onError={(e) => console.error(`Admin Page - Admin Status Avatar load error. URL: ${adminStatus.avatarUrl}`, e)} /><AvatarFallback>{(adminStatus.name || 'A').charAt(0)}</AvatarFallback></Avatar>)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusText" className="font-medium text-sm">Your Status Text</Label>
                <Textarea id="adminStatusText" value={adminStatus.statusText} onChange={(e) => setAdminStatus(s => ({ ...s, statusText: e.target.value }))} placeholder="What's your current status story?" className="min-h-[70px]"/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminStatusImageUrl" className="font-medium text-sm">Your Story Image URL (Optional, Publicly Accessible)</Label>
                <Input id="adminStatusImageUrl" type="url" value={adminStatus.statusImageUrl || ""} onChange={(e) => setAdminStatus(s => ({ ...s, statusImageUrl: e.target.value }))} placeholder="https://placehold.co/300x500.png" className="text-sm"/>
                 {adminStatus.statusImageUrl && adminStatus.statusImageUrl.trim() !== '' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                      <Image
                        src={adminStatus.statusImageUrl}
                        alt="Status preview"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/300x500/CCCCCC/FFFFFF?text=Error';
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground break-all">
                      <a href={adminStatus.statusImageUrl} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                        {adminStatus.statusImageUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <Switch id="adminStatusHasUpdate" checked={adminStatus.hasUpdate} onCheckedChange={(checked) => setAdminStatus(s => ({ ...s, hasUpdate: checked }))}/>
                <Label htmlFor="adminStatusHasUpdate" className="text-sm font-medium">Show as new/unread update</Label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => handleClearAdminStatusField('statusText')} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Status Text</Button>
                <Button onClick={() => handleClearAdminStatusField('statusImageUrl')} variant="outline" size="sm"><Trash2 className="mr-1 h-3 w-3"/>Clear Story Image</Button>
              </div>
            </CardContent>
            <CardFooter className="mt-2">
              <Button onClick={handleSaveAdminStatus} className="w-full sm:w-auto"><CircleUser className="mr-2 h-4 w-4"/>Save "My Status" Details (Global)</Button>
            </CardFooter>
          </Card>

          <Card className="bg-card text-card-foreground mb-6 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold"><Users className="mr-2 h-5 w-5 text-violet-600"/>Manage Demo Contact Statuses (Global)</CardTitle>
              <CardDescription className="text-sm">Set the ephemeral stories for the demo contacts that appear on the Status page. Visible to all users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              {managedContactStatuses.map((contact) => (
                <div key={contact.id} className="border p-4 rounded-md space-y-3 bg-secondary/20 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border" key={`${contact.id}-admin-avatar-${contact.avatarUrl}`}><AvatarImage src={contact.avatarUrl} alt={contact.name} data-img-desc={contact.dataImageDescription || "profile person"} onError={(e) => console.error(`Admin Page - Demo Contact Avatar load error. URL: ${contact.avatarUrl}`, e)} /><AvatarFallback>{contact.name.charAt(0)}</AvatarFallback></Avatar>
                    <h4 className="font-medium text-md text-secondary-foreground">{contact.name} (Demo)</h4>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contactStoryText-${contact.id}`} className="font-medium text-xs">Status Text</Label>
                    <Input id={`contactStoryText-${contact.id}`} value={contact.statusText} onChange={(e) => handleManagedContactChange(contact.id, 'statusText', e.target.value)} placeholder="e.g., At the movies!" className="text-sm"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contactStoryImageUrl-${contact.id}`} className="font-medium text-xs">Story Image URL (Optional)</Label>
                    <Input id={`contactStoryImageUrl-${contact.id}`} type="url" value={contact.statusImageUrl || ""} onChange={(e) => handleManagedContactChange(contact.id, 'statusImageUrl', e.target.value)} placeholder="https://placehold.co/300x500.png" className="text-sm"/>
                    {contact.statusImageUrl && contact.statusImageUrl.trim() !== '' && (<Avatar className="w-20 h-32 mt-2 border rounded shadow" key={`${contact.id}-admin-story-image-${contact.statusImageUrl}`}><AvatarImage src={contact.statusImageUrl} alt={`${contact.name} story preview`} data-ai-hint="story image content" className="object-contain" onError={(e) => console.error(`Admin Page - Demo Contact Story Image load error. URL: ${contact.statusImageUrl}`, e)} /><AvatarFallback>Preview</AvatarFallback></Avatar>)}
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <Switch id={`contactHasUpdate-${contact.id}`} checked={contact.hasUpdate} onCheckedChange={(checked) => handleManagedContactChange(contact.id, 'hasUpdate', checked)}/>
                    <Label htmlFor={`contactHasUpdate-${contact.id}`} className="text-xs font-medium">Show as new/unread update</Label>
                  </div>
                   <div className="flex flex-wrap gap-2 pt-1">
                    <Button onClick={() => handleClearManagedContactField(contact.id, 'statusText')} variant="outline" size="sm" className="text-xs px-2 py-1 h-auto"><Trash2 className="mr-1 h-3 w-3"/>Clear Text</Button>
                    <Button onClick={() => handleClearManagedContactField(contact.id, 'statusImageUrl')} variant="outline" size="sm" className="text-xs px-2 py-1 h-auto"><Trash2 className="mr-1 h-3 w-3"/>Clear Image</Button>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="mt-2">
              <Button onClick={handleSaveManagedContactStatuses} className="w-full sm:w-auto"><Users className="mr-2 h-4 w-4"/>Save Demo Contact Statuses (Global)</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="bg-card text-card-foreground shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold">
                <Database className="mr-2 h-5 w-5 text-violet-600"/>
                Usage Analytics Dashboard
                <button
                  type="button"
                  onClick={handleViewFullDashboard}
                  disabled={isNavigatingToDashboard}
                  className="ml-auto text-sm bg-violet-600 text-white px-3 py-1 rounded-md hover:bg-violet-700 transition-colors disabled:opacity-70 disabled:cursor-wait inline-flex items-center gap-2"
                  aria-label="View full analytics dashboard with detailed metrics and insights"
                >
                  {isNavigatingToDashboard ? (
                    <>
                      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      Loading dashboard…
                    </>
                  ) : (
                    <>View Full Dashboard →</>
                  )}
                </button>
              </CardTitle>
              <Alert variant={dbError ? "destructive" : "default"} className={`mt-4 ${dbError ? "" : "bg-violet-50 border-violet-200"}`}>
                {dbError ? <Terminal className="h-4 w-4 !text-destructive" /> : <Database className="h-4 w-4 !text-violet-600" />}
                <AlertTitle className={dbError ? "text-destructive font-semibold" : "text-violet-600 font-semibold"}>
                  {dbError ? "Hostinger DB Connection Issue" : "Analytics Data Source"}
                </AlertTitle>
                <AlertDescription className={`${dbError ? "text-destructive/80" : "text-violet-700/80"} text-sm`}>
                  {dbError
                    ? `Error: ${dbError}. Realtime analytics might be unavailable or incorrect. Ensure Hostinger DB is configured correctly as per HOSTINGER_MYSQL_SETUP.sql, including all SQL functions and tables.`
                    : "Analytics are fetched from Hostinger DB. Daily active users are a calendar-day estimate based on distinct signed browser sessions with analytics consent; they are not a rolling 24-hour count or a count of verified people."}
                </AlertDescription>
              </Alert>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="shadow-sm p-4">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0"><CardTitle className="text-sm font-medium">Total User Messages</CardTitle><MessageSquare className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent className="p-0 pt-1">{analyticsLoading ? <p className="text-2xl font-bold">Loading...</p> : <p className="text-2xl font-bold">{realTotalUserMessages ?? 'N/A'}</p>}<p className="text-xs text-muted-foreground">From Hostinger DB (real data)</p></CardContent>
                </Card>
                 <Card className="shadow-sm p-4">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0"><CardTitle className="text-sm font-medium">Total AI Messages</CardTitle><MessageSquare className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent className="p-0 pt-1">{analyticsLoading ? <p className="text-2xl font-bold">Loading...</p> : <p className="text-2xl font-bold">{realTotalAiMessages ?? 'N/A'}</p>}<p className="text-xs text-muted-foreground">From Hostinger DB (real data)</p></CardContent>
                </Card>
                <Card className="shadow-sm p-4">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0"><CardTitle className="text-sm font-medium">Daily Active Sessions</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent className="p-0 pt-1">{analyticsLoading ? <p className="text-2xl font-bold">Loading...</p> : <p className="text-2xl font-bold">{currentDAU ?? 'N/A'}</p>}<p className="text-xs text-muted-foreground">Business calendar day; signed sessions with analytics consent.</p></CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 pt-4"><CardTitle className="text-lg font-medium">Messages Sent (Last 7 Days)</CardTitle><CardDescription className="text-sm">Total user and AI messages per day. From Hostinger MySQL.</CardDescription></CardHeader>
                  <CardContent className="h-[300px] w-full pt-2">
                    {analyticsLoading && !realMessagesSentLast7Days.length ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">Loading chart data...</div>
                    ) : dbError && !realMessagesSentLast7Days.some(d => d.count > 0) ? (
                         <div className="flex items-center justify-center h-full text-destructive text-center p-4 text-sm">Database unavailable — run the GRANT FIX in HOSTINGER_MYSQL_SETUP.sql to resolve remote MySQL access.</div>
                    ) : (
                    <ChartContainer config={messagesChartConfig} className="w-full h-full">
                      <RechartsBarChart accessibilityLayer data={realMessagesSentLast7Days} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis dataKey="count" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={10} />
                        <ChartTooltip content={<ChartTooltipContent indicator="dot" hideLabel />} />
                        <Bar dataKey="count" name="messages" fill="var(--color-messages)" radius={4} />
                      </RechartsBarChart>
                    </ChartContainer>
                    )}
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 pt-4"><CardTitle className="text-lg font-medium">Daily Active Sessions (Last 7 Days)</CardTitle><CardDescription className="text-sm">Distinct signed sessions by business calendar day; analytics consent required.</CardDescription></CardHeader>
                  <CardContent className="h-[300px] w-full pt-2">
                    {analyticsLoading && !dailyActiveUsersData.length ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">Loading chart data...</div>
                    ) : dbError && !dailyActiveUsersData.some(d => d.count > 0) ? (
                         <div className="flex items-center justify-center h-full text-destructive text-center p-4 text-sm">Error loading chart data. Ensure Hostinger DB is correctly set up.</div>
                    ) : (
                    <ChartContainer config={dauChartConfig} className="w-full h-full">
                       <RechartsBarChart accessibilityLayer data={dailyActiveUsersData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis dataKey="count" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={10} />
                        <ChartTooltip content={<ChartTooltipContent indicator="dot" hideLabel />} />
                        <Bar dataKey="count" name="active_users" fill="var(--color-active_users)" radius={4} />
                      </RechartsBarChart>
                    </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-4">
                Analytics data is fetched from Hostinger DB. Ensure your Hostinger DB is correctly configured and the necessary SQL functions are in place.
              </p>
            </CardContent>
             <CardFooter className="border-t pt-6 flex-wrap gap-3">
                <Button onClick={() => router.push('/maya-chat')} variant="outline">
                    <MessageSquare className="mr-2 h-4 w-4"/>View Kruthika's Chat
                </Button>
                <Button onClick={() => router.push('/')} variant="outline">
                    <Users className="mr-2 h-4 w-4"/>Back to Chat List
                </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="ai_keys">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-violet-600"/>AI Provider Keys</CardTitle>
              <CardDescription>
                Manage API keys for Gemini, DeepSeek, and OpenAI. The AI engine automatically falls back to the next available key when one is exhausted. Keys marked ⚠️ Exhausted or ❌ Error need attention.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIKeysTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice_keys">
          <Card className="bg-card text-card-foreground mb-8 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl font-semibold">
                <Mic className="mr-2 h-5 w-5 text-violet-600" /> Voice Settings
              </CardTitle>
              <CardDescription className="text-sm">
                Manage voice providers for Kruthika's voice messages. ElevenLabs (primary — emotional quality)
                falls back to Sarvam AI (native Indian pronunciation) automatically when ElevenLabs keys are exhausted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VoiceSettingsTab />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ai_ignore">
          <AIIgnoreControlTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

      </Tabs>
        </div>
      </TooltipProvider>
    </CmsWorkspaceShell>
  );
};

export default AdminProfilePage;
