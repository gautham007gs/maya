"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { AIProfile } from '@/types';
import { AI_PROFILE_CONFIG_KEY } from '@/types';
import { defaultAIProfile } from '@/config/ai';
import { db } from '@/lib/dbClient';
import { fetchPublicConfig, parseStoredConfig } from '@/lib/public-config';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';

interface AIProfileContextType {
  aiProfile: AIProfile | null;
  isLoadingAIProfile: boolean;
  fetchAIProfile: () => Promise<void>; 
  updateAIProfile: (newProfileData: Partial<AIProfile>) => Promise<void>; 
}

// Removed global setter - components should use the context's isLoadingAIProfile state directly


const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function readProfileFromStorage(): AIProfile | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ai_profile_backup') : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed._ts && Date.now() - parsed._ts > PROFILE_CACHE_TTL_MS) return null;
    const { _ts: _ignored, ...profile } = parsed;
    return { ...defaultAIProfile, ...profile } as AIProfile;
  } catch { return null; }
}

const AIProfileContext = createContext<AIProfileContextType | undefined>(undefined);

export const AIProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // IMPORTANT: Start null/true to match SSR — localStorage seeded in useEffect after hydration.
  const [aiProfile, setAIProfile] = useState<AIProfile | null>(null);
  const [isLoadingAIProfile, setIsLoadingAIProfile] = useState(true);
  const isFetchingRef = React.useRef(false);
  // Ref to current aiProfile so updateAIProfile doesn't need aiProfile in its deps
  // (avoids: aiProfile changes → updateAIProfile changes → context value changes → all consumers re-render → loop)
  const { toast } = useToast();


  const fetchAIProfile = useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setIsLoadingAIProfile(true);
    logger.dev("[AIProfileContext] fetchAIProfile: Starting to fetch AI profile...");

    try {
      const { data, ok } = await fetchPublicConfig();
      const profileSettings = ok ? parseStoredConfig<AIProfile>(data?.[AI_PROFILE_CONFIG_KEY]) : null;

      logger.dev("[AIProfileContext] fetchAIProfile: Fetched from Hostinger DB - raw data:", JSON.stringify(profileSettings, null, 2));

      if (!ok) {
        const errMsg = 'Public config unavailable';
        console.error('[AIProfileContext] fetchAIProfile: Error fetching AI profile from Hostinger DB:', errMsg);
        if (!silent) {
          toast({ title: "Error Loading AI Profile", description: `Could not load AI profile. Using defaults. ${errMsg}`, variant: "destructive" });
        }

        // Try to get profile from localStorage as fallback
        try {
          const localProfile = localStorage.getItem('ai_profile_backup');
          if (localProfile) {
            const parsedProfile = JSON.parse(localProfile);
            setAIProfile(parsedProfile);
            logger.dev('[AIProfileContext] Using local backup profile');
            return;
          }
        } catch (localError) {
          console.warn('[AIProfileContext] Local backup also failed:', localError);
        }

        setAIProfile(defaultAIProfile);
        logger.dev("[AIProfileContext] fetchAIProfile: Set AI profile to default (DB error):", JSON.stringify(defaultAIProfile, null, 2));
      } else if (profileSettings) {
        // Use 'any' — TypeScript's typed variables suppress the typeof='string' check at runtime.
        const raw: any = profileSettings;
        logger.dev("[AIProfileContext] fetchAIProfile: Parsed settings from DB:", JSON.stringify(raw, null, 2));

        // Build fresh merged profile — never mutate the DB result object
        const mergedProfile: AIProfile = {
          ...defaultAIProfile,
          ...raw,
          avatarUrl: (raw.avatarUrl && typeof raw.avatarUrl === 'string' && raw.avatarUrl.trim())
            ? raw.avatarUrl
            : defaultAIProfile.avatarUrl,
        };

        setAIProfile(mergedProfile);
        logger.dev("[AIProfileContext] fetchAIProfile: Set AI profile from Hostinger DB (merged with defaults):", JSON.stringify(mergedProfile, null, 2));
        // Backup to local storage after successful fetch
        try {
          localStorage.setItem('ai_profile_backup', JSON.stringify({ ...mergedProfile, _ts: Date.now() }));
          logger.dev('[AIProfileContext] AI profile backed up to local storage');
        } catch (backupError) {
          console.warn('[AIProfileContext] Failed to back up AI profile to local storage:', backupError);
        }
      } else {
        logger.dev("[AIProfileContext] fetchAIProfile: No AI profile found in Hostinger DB (error code PGRST116 or no data.settings). Using default values.");
        setAIProfile(defaultAIProfile);
        logger.dev("[AIProfileContext] fetchAIProfile: Set AI profile to default (no data in Hostinger DB):", JSON.stringify(defaultAIProfile, null, 2));
      }
    } catch (e: any) {
      console.error('[AIProfileContext] fetchAIProfile: Unexpected error fetching AI profile:', e);
      if (!silent) {
        toast({ title: "Error Loading AI Profile", description: `Unexpected error. Using defaults. ${e.message}`, variant: "destructive" });
      }

      // Try to get profile from localStorage as fallback
      try {
        const localProfile = localStorage.getItem('ai_profile_backup');
        if (localProfile) {
          const parsedProfile = JSON.parse(localProfile);
          setAIProfile(parsedProfile);
          logger.dev('[AIProfileContext] Using local backup profile after unexpected error');
          return;
        }
      } catch (localError) {
        console.warn('[AIProfileContext] Local backup also failed after unexpected error:', localError);
      }

      setAIProfile(defaultAIProfile);
      logger.dev("[AIProfileContext] fetchAIProfile: Set AI profile to default (catch block error):", JSON.stringify(defaultAIProfile, null, 2));
    } finally {
      if (!silent) setIsLoadingAIProfile(false);
      isFetchingRef.current = false;
      logger.dev("[AIProfileContext] fetchAIProfile: Finished fetching AI profile. Loading state:", false);
    }
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateAIProfile = useCallback(async (newProfileData: Partial<AIProfile>) => {
    if (!db) {
      toast({ title: "DB Error", description: "DB client not available. Cannot save AI profile.", variant: "destructive" });
      return;
    }

    logger.dev("[AIProfileContext] updateAIProfile: Received newProfileData:", JSON.stringify(newProfileData, null, 2));

    const currentProfileForUpdate = aiProfile || defaultAIProfile;

    // Prepare avatarUrl: if explicitly cleared (empty string) make it undefined,
    // otherwise use the new value or keep the current one.
    let processedAvatarUrl = newProfileData.hasOwnProperty('avatarUrl') 
        ? (newProfileData.avatarUrl?.trim() === '' ? undefined : newProfileData.avatarUrl) 
        : currentProfileForUpdate.avatarUrl;

    // Validate and fallback to default if the processed URL is still invalid or undefined
    if (!processedAvatarUrl || typeof processedAvatarUrl !== 'string' || processedAvatarUrl.trim() === '') {
        console.warn(`[AIProfileContext updateAIProfile] Processed avatarUrl ('${processedAvatarUrl}') is invalid. Falling back to default: ${defaultAIProfile.avatarUrl}`);
        processedAvatarUrl = defaultAIProfile.avatarUrl;
    }
    logger.dev("[AIProfileContext] updateAIProfile: Processed avatarUrl for optimistic update:", processedAvatarUrl);

    const optimisticProfile: AIProfile = {
      ...currentProfileForUpdate,
      ...newProfileData, 
      avatarUrl: processedAvatarUrl, 
    };

    console.log("[AIProfileContext] updateAIProfile: Optimistic profile for UI update:", JSON.stringify(optimisticProfile, null, 2));
    setAIProfile(optimisticProfile); // Optimistic UI update

    try {
      const { error: upsertError } = await db
        .from('app_configurations')
        .upsert(
          { id: AI_PROFILE_CONFIG_KEY, settings: optimisticProfile }
        );

      if (upsertError) {
        console.error("[AIProfileContext] updateAIProfile: Failed to save AI profile to Hostinger DB:", upsertError);
        toast({ title: "Error Saving AI Profile", description: `Could not save AI profile to Hostinger DB. ${upsertError.message || ''}. Reverting optimistic update.`, variant: "destructive" });
        setAIProfile(currentProfileForUpdate); // Revert optimistic update on error
        await fetchAIProfile(); // Re-fetch from DB to ensure consistency
        return; 
      }

      console.log("[AIProfileContext] updateAIProfile: AI Profile successfully saved to Hostinger DB.");
      toast({ title: "AI Profile Saved!", description: "Kruthika's profile has been saved globally to Hostinger DB." });

      // Backup to local storage after successful save
      try {
        localStorage.setItem('ai_profile_backup', JSON.stringify({ ...optimisticProfile, _ts: Date.now() }));
        console.log('[AIProfileContext] AI profile backed up to local storage after update');
      } catch (backupError) {
        console.warn('[AIProfileContext] Failed to back up AI profile to local storage after update:', backupError);
      }

      // Re-fetch after successful save to ensure UI reflects DB state, though optimistic update helps.
      await fetchAIProfile();

    } catch (error: any) {
      console.error("[AIProfileContext] updateAIProfile: Unexpected error during Supabase save:", error);
      toast({ title: "Error Saving AI Profile", description: `Unexpected error. ${error.message || ''}. Reverting optimistic update.`, variant: "destructive" });
      setAIProfile(currentProfileForUpdate); // Revert optimistic update
      await fetchAIProfile(); // Re-fetch from DB
    }
  }, [toast, aiProfile, fetchAIProfile]); 

  useEffect(() => {
    // After hydration: seed from localStorage cache instantly, then background-refresh from DB.
    const cached = readProfileFromStorage();
    if (cached) {
      setAIProfile(cached);
      setIsLoadingAIProfile(false);
      // Slight delay so the page renders with cached data before going to DB
      const timer = setTimeout(() => fetchAIProfile(true), 300);
      return () => clearTimeout(timer);
    } else {
      fetchAIProfile(false);
      return undefined;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AIProfileContext.Provider value={{ aiProfile, isLoadingAIProfile, fetchAIProfile, updateAIProfile }}>
      {children}
    </AIProfileContext.Provider>
  );
};

export const useAIProfile = (): AIProfileContextType => {
  const context = useContext(AIProfileContext);
  if (context === undefined) {
    throw new Error('useAIProfile must be used within an AIProfileProvider');
  }
  return context;
};

// This function is intended for AdminProfilePage to manually set this context's loading state.
// This might be an anti-pattern; consider if AdminProfilePage can manage a combined loading state itself.
export const setExternalIsLoadingAIProfile = (_isLoading: boolean) => {
  // This external setter mechanism is tricky. If AIProfileContext is still loading itself,
  // AdminProfilePage setting this to false prematurely could be problematic.
  // This function should ideally not be needed if contexts manage their own loading states well.
  // if (setIsLoadingContextAIProfileExternal) {
  //   setIsLoadingContextAIProfileExternal(isLoading);
  // }
};