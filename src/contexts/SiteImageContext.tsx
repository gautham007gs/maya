'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { defaultSiteImageConfig } from '@/config/ai';
import { SITE_IMAGE_CONFIG_KEY, type SiteImageConfig } from '@/types';
import { fetchPublicConfig, parseStoredConfig } from '@/lib/public-config';

const SiteImageContext = createContext<SiteImageConfig>(defaultSiteImageConfig);

export function SiteImageProvider({ children }: { children: React.ReactNode }) {
  const [images, setImages] = useState(defaultSiteImageConfig);
  const refresh = useCallback(async () => {
    const { data, ok } = await fetchPublicConfig();
    const saved = ok ? parseStoredConfig<Partial<SiteImageConfig>>(data[SITE_IMAGE_CONFIG_KEY]) : null;
    if (saved) setImages(current => ({ ...current, ...saved }));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <SiteImageContext.Provider value={images}>{children}</SiteImageContext.Provider>;
}

export const useSiteImages = () => useContext(SiteImageContext);
