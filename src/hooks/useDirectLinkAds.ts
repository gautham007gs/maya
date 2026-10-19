"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { analyticsTracker } from '@/lib/analytics-tracker';
import { isAdvertisingAllowed } from '@/lib/consent';

interface DirectLinkAdState {
  shouldShow: boolean;
  directLinkUrl: string | null;
}

const STORAGE_KEY_DAILY_COUNT = 'directLinkAds_dailyCount';
const STORAGE_KEY_SESSION_COUNT = 'directLinkAds_sessionCount';
const STORAGE_KEY_LAST_SHOWN = 'directLinkAds_lastShown';
const STORAGE_KEY_LAST_RESET = 'directLinkAds_lastReset';

export function useDirectLinkAds() {
  const { adSettings, isLoadingAdSettings } = useAdSettings();
  const [adState, setAdState] = useState<DirectLinkAdState>({
    shouldShow: false,
    directLinkUrl: null
  });

  const messageCountRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset daily counter at midnight
  const resetDailyCountIfNeeded = useCallback(() => {
    if (typeof window === 'undefined') return;

    const lastReset = localStorage.getItem(STORAGE_KEY_LAST_RESET);
    const today = new Date().toDateString();

    if (lastReset !== today) {
      localStorage.setItem(STORAGE_KEY_DAILY_COUNT, '0');
      localStorage.setItem(STORAGE_KEY_LAST_RESET, today);
    }
  }, []);

  // Server-authoritative cap check (MED-037) with localStorage as UX hint only
  const checkServerCap = useCallback(async (record: boolean): Promise<boolean> => {
    if (!adSettings) return false;
    try {
      const res = await fetch('/api/ads/direct-link', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: record ? 'record' : 'check',
          maxDaily: adSettings.maxDirectLinkAdsPerDay || 3,
          maxSession: adSettings.maxDirectLinkAdsPerSession || 2,
        }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.allowed);
    } catch {
      return false;
    }
  }, [adSettings]);

  // Check if we can show an ad based on caps
  const canShowAd = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    if (!isAdvertisingAllowed()) return false;
    if (!adSettings || !adSettings.adsEnabledGlobally || adSettings.adsKillSwitch) return false;

    const hasDirectLinkEnabled = adSettings.adsterraDirectLinkEnabled && !!adSettings.adsterraDirectLink;
    if (!hasDirectLinkEnabled) return false;

    return true;
  }, [adSettings]);

  // Get the direct link URL based on priority
  const getDirectLinkUrl = useCallback((): string | null => {
    if (!adSettings) return null;

    if (adSettings.adsterraDirectLinkEnabled && adSettings.adsterraDirectLink) {
      return adSettings.adsterraDirectLink;
    }

    return null;
  }, [adSettings]);

  // Trigger the ad display
  const triggerAd = useCallback(async () => {
    if (!canShowAd()) return;

    const allowed = await checkServerCap(true);
    if (!allowed) return;

    const url = getDirectLinkUrl();
    if (!url) return;

    setAdState({
      shouldShow: true,
      directLinkUrl: url
    });

    const dailyCount = parseInt(localStorage.getItem(STORAGE_KEY_DAILY_COUNT) || '0', 10);
    const sessionCount = parseInt(localStorage.getItem(STORAGE_KEY_SESSION_COUNT) || '0', 10);
    localStorage.setItem(STORAGE_KEY_DAILY_COUNT, String(dailyCount + 1));
    localStorage.setItem(STORAGE_KEY_SESSION_COUNT, String(sessionCount + 1));
    localStorage.setItem(STORAGE_KEY_LAST_SHOWN, String(Date.now()));
    analyticsTracker.trackAdInteractionPublic('direct-link', 'view', 'adsterra').catch(() => {});
  }, [canShowAd, checkServerCap, getDirectLinkUrl]);

  // Close the ad
  const closeAd = useCallback(() => {
    setAdState({
      shouldShow: false,
      directLinkUrl: null
    });
  }, []);

  // Track user messages
  const onUserMessage = useCallback(() => {
    if (isLoadingAdSettings || !adSettings) return;

    messageCountRef.current++;
    lastActivityRef.current = Date.now();

    const interval = adSettings.directLinkMessageInterval || 10;

    if (messageCountRef.current % interval === 0) {
      triggerAd();
    }
  }, [adSettings, isLoadingAdSettings, triggerAd]);

  // Track AI responses
  const onAIResponse = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Setup inactivity timer
  useEffect(() => {
    if (isLoadingAdSettings || !adSettings || !adSettings.adsEnabledGlobally) return;

    const inactivityMinutes = adSettings.directLinkInactivityMinutes || 2;
    const inactivityMs = inactivityMinutes * 60 * 1000;

    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      if (timeSinceActivity >= inactivityMs) {
        triggerAd();
        lastActivityRef.current = now; // Reset to prevent rapid re-triggering
      }
    };

    inactivityTimerRef.current = setInterval(checkInactivity, 30000); // Check every 30 seconds

    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [adSettings, isLoadingAdSettings, triggerAd]);

  // Initialize
  useEffect(() => {
    resetDailyCountIfNeeded();
  }, [resetDailyCountIfNeeded]);

  return {
    ...adState,
    onUserMessage,
    onAIResponse,
    closeAd,
    triggerAd,
  };
}
