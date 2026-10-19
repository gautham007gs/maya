"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { AIMediaAssetsConfig } from '@/types';
import { AI_MEDIA_ASSETS_CONFIG_KEY } from '@/types';
import { defaultAIMediaAssetsConfig } from '@/config/ai';
import { fetchPublicConfig, parseStoredConfig } from '@/lib/public-config';
import { localCache } from '@/lib/local-cache';

const CACHE_KEY = 'ai_media_assets';
const CACHE_TTL_MINUTES = 60;

interface AIMediaAssetsContextType {
  mediaAssetsConfig: AIMediaAssetsConfig | null;
  isLoadingMediaAssets: boolean;
  fetchMediaAssets: (silent?: boolean) => Promise<void>;
}

const AIMediaAssetsContext = createContext<AIMediaAssetsContextType | undefined>(undefined);

export const AIMediaAssetsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Start with null/true to match SSR — localStorage seeded in useEffect after hydration.
  const [mediaAssetsConfig, setMediaAssetsConfig] = useState<AIMediaAssetsConfig | null>(null);
  const [isLoadingMediaAssets, setIsLoadingMediaAssets] = useState(true);
  const isFetchingRef = useRef(false);

  const fetchMediaAssets = useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setIsLoadingMediaAssets(true);

    try {
      const { data, ok } = await fetchPublicConfig();

      if (!ok) {
        console.warn('[AIMediaAssets] Public config fetch failed, using cache/defaults:');
        setMediaAssetsConfig(prev => prev ?? localCache.get<AIMediaAssetsConfig>(CACHE_KEY) ?? defaultAIMediaAssetsConfig);
      } else {
        const parsed = parseStoredConfig<AIMediaAssetsConfig>(data?.[AI_MEDIA_ASSETS_CONFIG_KEY]);
        if (parsed && Array.isArray(parsed.assets)) {
          setMediaAssetsConfig(parsed);
          localCache.set(CACHE_KEY, parsed, CACHE_TTL_MINUTES);
        } else {
          setMediaAssetsConfig(prev => prev ?? defaultAIMediaAssetsConfig);
        }
      }
    } catch {
      console.warn('[AIMediaAssets] Fetch failed, using cache/defaults');
      setMediaAssetsConfig(prev => prev ?? localCache.get<AIMediaAssetsConfig>(CACHE_KEY) ?? defaultAIMediaAssetsConfig);
    } finally {
      if (!silent) setIsLoadingMediaAssets(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const cached = localCache.get<AIMediaAssetsConfig>(CACHE_KEY);
    if (cached) {
      setMediaAssetsConfig(cached);
      setIsLoadingMediaAssets(false);
      fetchMediaAssets(true);
    } else {
      fetchMediaAssets(false);
    }
  }, [fetchMediaAssets]);

  // Stable public wrapper — inline arrow in JSX creates a new ref every render
  // and will break any useCallback that depends on this function.
  // Accepts optional silent flag so the admin page can refresh without toggling
  // isLoadingMediaAssets and causing the dashboard to flicker.
  const fetchMediaAssetsPublic = useCallback((silent = false) => fetchMediaAssets(silent), [fetchMediaAssets]);

  return (
    <AIMediaAssetsContext.Provider value={{ mediaAssetsConfig, isLoadingMediaAssets, fetchMediaAssets: fetchMediaAssetsPublic }}>
      {children}
    </AIMediaAssetsContext.Provider>
  );
};

export const useAIMediaAssets = (): AIMediaAssetsContextType => {
  const ctx = useContext(AIMediaAssetsContext);
  if (!ctx) throw new Error('useAIMediaAssets must be used within AIMediaAssetsProvider');
  return ctx;
};
