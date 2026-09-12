"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { AdminStatusDisplay, ManagedContactStatus } from '@/types';
import { ADMIN_OWN_STATUS_CONFIG_KEY, MANAGED_DEMO_CONTACTS_CONFIG_KEY } from '@/types';
import { defaultAdminStatusDisplay, defaultManagedContactStatuses } from '@/config/ai';
import { fetchPublicConfig, parseStoredConfig } from '@/lib/public-config';
import { localCache } from '@/lib/local-cache';

const CACHE_KEY_STATUS   = 'global_admin_status';
const CACHE_KEY_CONTACTS = 'global_demo_contacts';
const CACHE_TTL_MINUTES  = 15;

interface GlobalStatusContextType {
  adminOwnStatus: AdminStatusDisplay | null;
  managedDemoContacts: ManagedContactStatus[] | null;
  isLoadingGlobalStatuses: boolean;
  fetchGlobalStatuses: (silent?: boolean) => Promise<void>;
}

const GlobalStatusContext = createContext<GlobalStatusContextType | undefined>(undefined);

export const GlobalStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Start with null/true to match SSR — localStorage seeded in useEffect after hydration.
  const [adminOwnStatus, setAdminOwnStatus] = useState<AdminStatusDisplay | null>(null);
  const [managedDemoContacts, setManagedDemoContacts] = useState<ManagedContactStatus[] | null>(null);
  const [isLoadingGlobalStatuses, setIsLoadingGlobalStatuses] = useState(true);
  const isFetchingRef = useRef(false);

  const fetchGlobalStatuses = useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setIsLoadingGlobalStatuses(true);

    try {
      const { data, ok } = await fetchPublicConfig();

      // ── Admin own status ──
      const statusSettings = ok ? parseStoredConfig<AdminStatusDisplay>(data?.[ADMIN_OWN_STATUS_CONFIG_KEY]) : null;
      if (!ok) {
        console.warn('[GlobalStatus] Public config fetch failed, using cache/defaults');
        setAdminOwnStatus(prev => prev ?? localCache.get<AdminStatusDisplay>(CACHE_KEY_STATUS) ?? defaultAdminStatusDisplay);
      } else if (statusSettings) {
        const merged = { ...defaultAdminStatusDisplay, ...statusSettings };
        setAdminOwnStatus(merged);
        localCache.set(CACHE_KEY_STATUS, merged, CACHE_TTL_MINUTES);
      } else {
        setAdminOwnStatus(prev => prev ?? defaultAdminStatusDisplay);
      }

      // ── Managed demo contacts ──
      const contactsSettings = ok ? parseStoredConfig<ManagedContactStatus[]>(data?.[MANAGED_DEMO_CONTACTS_CONFIG_KEY]) : null;
      if (!ok) {
        setManagedDemoContacts(prev => prev ?? localCache.get<ManagedContactStatus[]>(CACHE_KEY_CONTACTS) ?? defaultManagedContactStatuses);
      } else if (contactsSettings) {
        const list = Array.isArray(contactsSettings) ? contactsSettings : defaultManagedContactStatuses;
        setManagedDemoContacts(list);
        localCache.set(CACHE_KEY_CONTACTS, list, CACHE_TTL_MINUTES);
      } else {
        setManagedDemoContacts(prev => prev ?? defaultManagedContactStatuses);
      }
    } catch {
      console.warn('[GlobalStatus] Unexpected error, using cache/defaults');
      setAdminOwnStatus(prev => prev ?? localCache.get<AdminStatusDisplay>(CACHE_KEY_STATUS) ?? defaultAdminStatusDisplay);
      setManagedDemoContacts(prev => prev ?? localCache.get<ManagedContactStatus[]>(CACHE_KEY_CONTACTS) ?? defaultManagedContactStatuses);
    } finally {
      if (!silent) setIsLoadingGlobalStatuses(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const cachedStatus   = localCache.get<AdminStatusDisplay>(CACHE_KEY_STATUS);
    const cachedContacts = localCache.get<ManagedContactStatus[]>(CACHE_KEY_CONTACTS);
    if (cachedStatus && cachedContacts) {
      setAdminOwnStatus(cachedStatus);
      setManagedDemoContacts(cachedContacts);
      setIsLoadingGlobalStatuses(false);
      fetchGlobalStatuses(true); // silent background refresh
    } else {
      fetchGlobalStatuses(false);
    }
  }, [fetchGlobalStatuses]);

  // Stable public wrapper — must not be an inline arrow in the JSX or it
  // creates a new function reference on every render, which breaks any
  // useCallback that lists it as a dependency (infinite-loop risk).
  // Accepts an optional silent flag so callers (e.g. admin page) can refresh
  // in the background without setting isLoadingGlobalStatuses=true and causing
  // the dashboard to flicker / child components to unmount-remount.
  const fetchGlobalStatusesPublic = useCallback((silent = false) => fetchGlobalStatuses(silent), [fetchGlobalStatuses]);

  return (
    <GlobalStatusContext.Provider value={{ adminOwnStatus, managedDemoContacts, isLoadingGlobalStatuses, fetchGlobalStatuses: fetchGlobalStatusesPublic }}>
      {children}
    </GlobalStatusContext.Provider>
  );
};

export const useGlobalStatus = (): GlobalStatusContextType => {
  const ctx = useContext(GlobalStatusContext);
  if (!ctx) throw new Error('useGlobalStatus must be used within a GlobalStatusProvider');
  return ctx;
};
