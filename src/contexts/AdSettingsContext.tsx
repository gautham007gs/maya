"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import type { AdSettings } from '@/types';
import { AD_SETTINGS_CONFIG_KEY } from '@/types';
import { defaultAdSettings } from '@/config/ai';
import { fetchPublicConfig, parseStoredConfig } from '@/lib/public-config';
import { localCache } from '@/lib/local-cache';

const CACHE_KEY = 'ad_settings';
// ── Cache strategy ─────────────────────────────────────────────────────────
// Primary cache: 6 hours. Ad settings almost never change between sessions;
// a 30-minute TTL was too short — returning users whose cache expired while
// the DB was rate-limited fell back to defaultAdSettings (empty codes) and
// saw zero ads until the DB recovered.
const CACHE_TTL_MINUTES = 360; // 6 hours

// Fallback cache: 24 hours, written ONLY after a successful DB fetch that
// returned at least one enabled ad code. Used as a last resort when the
// primary cache is expired AND the DB is temporarily unreachable — so
// returning users always have working ad codes rather than empty defaults.
const FALLBACK_KEY = 'ad_settings_fallback';
const FALLBACK_TTL_MINUTES = 24 * 60; // 24 hours
const KILL_SWITCH_POLL_MS = 5 * 60 * 1000; // 5 min — bypass stale ad cache (MED-036)

interface AdSettingsContextType {
  adSettings: AdSettings | null;
  isLoadingAdSettings: boolean;
  fetchAdSettings: () => Promise<void>;
}

const AdSettingsContext = createContext<AdSettingsContextType | undefined>(undefined);

export const AdSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // IMPORTANT: Start with null/true to match SSR output — no localStorage in useState initializer.
  // We seed from cache in useEffect (after hydration) to avoid hydration mismatches.
  const [adSettings, setAdSettings] = useState<AdSettings | null>(null);
  const [isLoadingAdSettings, setIsLoadingAdSettings] = useState(true);
  const isFetchingRef = useRef(false);

  // Helper: returns the best offline fallback we have, in order of preference:
  // primary cache (6h) → fallback cache (24h) → defaultAdSettings (empty codes).
  const getBestOfflineSettings = useCallback((prev: AdSettings | null): AdSettings => {
    if (prev) return prev;
    return (
      localCache.get<AdSettings>(CACHE_KEY) ??
      localCache.get<AdSettings>(FALLBACK_KEY) ??
      defaultAdSettings
    );
  }, []);

  const fetchAdSettings = useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setIsLoadingAdSettings(true);

    // Inner attempt — extracted so we can retry once on transient DB errors.
    const attempt = async (): Promise<boolean> => {
      const { data, ok } = await fetchPublicConfig();
      if (!ok) {
        console.warn('[AdSettings] Public config fetch failed, using cache/defaults:');
        return false; // signal failure so caller can retry
      }

      const settings = parseStoredConfig<AdSettings>(data?.[AD_SETTINGS_CONFIG_KEY]);

      if (settings) {
        const merged = { ...defaultAdSettings, ...settings };
        if (merged.adsKillSwitch) {
          localCache.remove(CACHE_KEY);
          localCache.remove(FALLBACK_KEY);
          setAdSettings({ ...merged, adsEnabledGlobally: false });
          return true;
        }
        setAdSettings(merged);
        // Write primary cache (6 h)
        localCache.set(CACHE_KEY, merged, CACHE_TTL_MINUTES);
        // Write fallback cache (24 h) — only when real ad codes are present so
        // we never cache the empty-code defaults into the 24 h fallback slot.
        const hasRealCodes = Object.entries(merged).some(
          ([k, v]) => k.endsWith('Code') && typeof v === 'string' && v.trim().length > 0
        );
        if (hasRealCodes) {
          localCache.set(FALLBACK_KEY, merged, FALLBACK_TTL_MINUTES);
        }
        return true;
      }

      // No data (fresh DB, never saved settings yet) — keep prev/cache/defaults.
      setAdSettings(prev => getBestOfflineSettings(prev));
      return true; // not an error, just no data
    };

    try {
      const ok = await attempt();
      if (!ok) {
        // One retry after 2 s — handles transient Hostinger rate-limit spikes.
        await new Promise(r => setTimeout(r, 2000));
        try {
          const okRetry = await attempt();
          if (!okRetry) {
            setAdSettings(prev => getBestOfflineSettings(prev));
          }
        } catch {
          setAdSettings(prev => getBestOfflineSettings(prev));
        }
      }
    } catch {
      console.warn('[AdSettings] Fetch failed, using cache/defaults');
      setAdSettings(prev => getBestOfflineSettings(prev));
    } finally {
      if (!silent) setIsLoadingAdSettings(false);
      isFetchingRef.current = false;
    }
  }, [getBestOfflineSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // After hydration: seed instantly from the best available cache, then
    // conditionally refresh from DB in the background.
    // We check BOTH cache slots so that a returning user whose primary cache
    // (6 h) has expired but whose fallback (24 h) is still valid will
    // immediately see ads rather than waiting for a DB round-trip.
    const cached =
      localCache.get<AdSettings>(CACHE_KEY) ??
      localCache.get<AdSettings>(FALLBACK_KEY);

    if (cached) {
      setAdSettings(cached);
      setIsLoadingAdSettings(false);

      // ── Rate-limit guard ────────────────────────────────────────────────
      // Every page navigation previously triggered a silent background DB
      // fetch regardless of how recently we already fetched. On a site with
      // many pages this saturates Hostinger's free-tier rate limit quickly.
      //
      // Rule: only background-refresh if the primary cache is more than
      // 30 minutes old (i.e. the data could plausibly have changed since the
      // last fetch). If the cache was written in the last 30 min, the settings
      // we just loaded are fresh enough — skip the DB hit entirely.
      const ageMinutes = localCache.getAgeMinutes(CACHE_KEY);
      const needsRefresh = ageMinutes === null || ageMinutes > 30;
      if (needsRefresh) {
        fetchAdSettings(true); // silent background refresh
      }
    } else {
      fetchAdSettings(false);
    }
  }, [fetchAdSettings]);

  // Poll for kill-switch / remote ad config changes (MED-036)
  useEffect(() => {
    const id = setInterval(() => fetchAdSettings(true), KILL_SWITCH_POLL_MS);
    return () => clearInterval(id);
  }, [fetchAdSettings]);

  // Stable public wrapper — inline arrow in JSX creates a new ref every render
  // and breaks any useCallback that depends on this function.
  const fetchAdSettingsPublic = useCallback(() => fetchAdSettings(false), [fetchAdSettings]);

  // Expose a developer-friendly page hook so admins can force the client to
  // re-fetch /api/public-config without waiting for cache TTLs. This is
  // useful immediately after editing ad codes in Admin → Ads.
  useEffect(() => {
    try {
      (window as any).__AD_SETTINGS_REFRESH__ = fetchAdSettingsPublic;
      return () => { delete (window as any).__AD_SETTINGS_REFRESH__; };
    } catch {
      // window may be undefined in some SSR test environments — ignore
      return undefined as any;
    }
  }, [fetchAdSettingsPublic]);

  return (
    <AdSettingsContext.Provider value={{ adSettings, isLoadingAdSettings, fetchAdSettings: fetchAdSettingsPublic }}>
      {children}
    </AdSettingsContext.Provider>
  );
};

export const useAdSettings = (): AdSettingsContextType => {
  const ctx = useContext(AdSettingsContext);
  if (!ctx) throw new Error('useAdSettings must be used within AdSettingsProvider');
  return ctx;
};
