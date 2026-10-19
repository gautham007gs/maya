import 'server-only';
import { db } from '@/lib/dbServer';
import { defaultSiteImageConfig } from '@/config/ai';
import { SITE_IMAGE_CONFIG_KEY, type SiteImageConfig } from '@/types';
import { redisGet, redisSet } from '@/lib/redis';

const REDIS_KEY = 'site_images:config:v1';
const MEMORY_TTL_MS = 60_000; // 1 minute in-memory cache

let cachedConfig: SiteImageConfig | null = null;
let cachedAt = 0;

export async function getEffectiveSiteImages(): Promise<SiteImageConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < MEMORY_TTL_MS) {
    return cachedConfig;
  }

  // Try Redis cache
  try {
    const redisCached = await redisGet<SiteImageConfig>(REDIS_KEY);
    if (redisCached && typeof redisCached === 'object' && Object.keys(redisCached).length > 0) {
      const config: SiteImageConfig = { ...defaultSiteImageConfig, ...redisCached };
      cachedConfig = config;
      cachedAt = now;
      return config;
    }
  } catch {
    // Non-blocking fallback to DB
  }

  // Ground truth: MySQL query
  try {
    const { data } = await db
      .from('app_configurations')
      .select('settings')
      .eq('id', SITE_IMAGE_CONFIG_KEY)
      .maybeSingle();

    if (data?.settings) {
      const parsed = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
      const config: SiteImageConfig = { ...defaultSiteImageConfig, ...parsed };
      cachedConfig = config;
      cachedAt = now;
      redisSet(REDIS_KEY, config, { ex: 600 }).catch(() => {});
      return config;
    }
  } catch (err) {
    console.warn('[SiteImageServer] DB query failed, using fallback:', err);
  }

  return defaultSiteImageConfig;
}

export function toAbsoluteSiteImageUrl(pathOrUrl: string, baseUrl?: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${cleanBase}${cleanPath}`;
}
