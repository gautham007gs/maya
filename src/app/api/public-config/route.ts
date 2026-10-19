/**
 * GET /api/public-config
 *
 * Row-level-allowlisted public configuration reader.
 *
 * This is the ONLY public read surface for `app_configurations`. The generic
 * `/api/db` proxy no longer exposes that table to unauthenticated callers;
 * this endpoint returns just the specific config rows the public UI needs
 * (ad settings, AI profile, global status, demo contacts, media assets) and
 * nothing else. It runs against the DB directly via dbServer — never through
 * the browser client proxy.
 *
 * Security:
 *  - Fixed allowlist of config keys; unknown keys are never returned.
 *  - Server-side DB access only (dbServer), no HTTP round-trip to /api/db.
 *  - Rate-limited; fails open to {} so a DB outage never bricks the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/dbServer';
import MaximumSecurity from '@/lib/enhanced-security';
import { APISecurityManager } from '@/lib/api-security';
import { checkRateLimit } from '@/lib/shared-rate-limiter';
import { getClientIp } from '@/lib/session-identity';
import { redisGet, redisSet } from '@/lib/redis';
import { getPublicConfigCacheGeneration } from '@/lib/public-config-cache';
import {
  AD_SETTINGS_CONFIG_KEY,
  AI_PROFILE_CONFIG_KEY,
  ADMIN_OWN_STATUS_CONFIG_KEY,
  MANAGED_DEMO_CONTACTS_CONFIG_KEY,
  AI_MEDIA_ASSETS_CONFIG_KEY,
  SITE_IMAGE_CONFIG_KEY,
} from '@/types';

const BANNER_KEY = 'notification_banner_config_v1';
const REDIS_PUBLIC_CONFIG_KEY = 'public_config:v1';
const REDIS_CONFIG_TTL_SECONDS = 600; // 10 minutes in Redis
const MEMORY_CACHE_TTL_MS = 30_000;   // 30 seconds in-memory (absorbs concurrent micro-bursts)
const REDIS_L2_TIMEOUT_MS   = 1_000;  // Max 1 s to wait for Redis before falling through to DB — redis.ts itself already caps at 1 s internally, this is a belt-and-suspenders outer bound

// Row-level allowlist — only these config keys are ever served to the public.
const PUBLIC_CONFIG_KEYS = new Set<string>([
  AD_SETTINGS_CONFIG_KEY,
  AI_PROFILE_CONFIG_KEY,
  ADMIN_OWN_STATUS_CONFIG_KEY,
  MANAGED_DEMO_CONTACTS_CONFIG_KEY,
  AI_MEDIA_ASSETS_CONFIG_KEY,
  SITE_IMAGE_CONFIG_KEY,
  BANNER_KEY,
]);

// L1 In-Memory Cache (zero network latency, zero Redis command cost)
let memCachedData: Record<string, any> | null = null;
let memCachedAt = 0;
let memCachedGeneration = 0;

export async function GET(request: NextRequest) {
  const enhancedSecurityCheck = await MaximumSecurity.secureRequest(request);
  if (enhancedSecurityCheck) return enhancedSecurityCheck;

  const securityCheck = await APISecurityManager.secureAPIRoute(request, {
    allowedMethods: ['GET'],
    rateLimit: { requests: 60, window: 60000 },
  });
  if (securityCheck) return securityCheck;

  const ip = getClientIp(request);
  const rl = await checkRateLimit('public_config', ip, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const now = Date.now();
  const cacheGeneration = getPublicConfigCacheGeneration();
  const url = new URL(request.url);
  const includeDebug = url.searchParams.get('debug') === '1';

  // ── L1: In-Memory Cache Hit ──────────────────────────────────────────────
  if (memCachedData && memCachedGeneration === cacheGeneration &&
      (now - memCachedAt < MEMORY_CACHE_TTL_MS) && !includeDebug) {
    return NextResponse.json({ data: memCachedData }, {
      headers: { 'X-Cache-Tier': 'L1-memory' },
    });
  }

  // ── L2: Upstash Redis Cache Hit ──────────────────────────────────────────
  // Capped at REDIS_L2_TIMEOUT_MS so cross-region latency never blocks the user response.
  // If Redis is slow or unavailable we fall through to DB immediately.
  if (!includeDebug) {
    try {
      const redisCached = await Promise.race([
        redisGet<Record<string, any>>(REDIS_PUBLIC_CONFIG_KEY),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), REDIS_L2_TIMEOUT_MS)),
      ]);
      if (redisCached && typeof redisCached === 'object' && Object.keys(redisCached).length > 0) {
        memCachedData = redisCached;
        memCachedAt = now;
        memCachedGeneration = cacheGeneration;
        return NextResponse.json({ data: redisCached }, {
          headers: { 'X-Cache-Tier': 'L2-redis' },
        });
      }
    } catch {
      // Non-blocking fallback to L3 DB
    }
  }

  // ── L3: MySQL Database Query (Ground Truth) ──────────────────────────────
  try {
    const { data, error } = await db
      .from('app_configurations')
      .select('id, settings')
      .limit(100);

    if (error) {
      console.warn('[PublicConfig] DB error:', error.message);
      // If we had stale memory cache, serve it instead of failing
      if (memCachedData) {
        return NextResponse.json({ data: memCachedData });
      }
      return NextResponse.json({ data: {} });
    }

    const result: Record<string, any> = {};
    for (const row of Array.isArray(data) ? data : []) {
      if (row && PUBLIC_CONFIG_KEYS.has(row.id)) {
        result[row.id] = row.settings;
      }
    }

    // Populate L1 Memory Cache
    memCachedData = result;
    memCachedAt = now;
    memCachedGeneration = cacheGeneration;

    // Populate L2 Redis Cache (asynchronously with TTL)
    redisSet(REDIS_PUBLIC_CONFIG_KEY, result, { ex: REDIS_CONFIG_TTL_SECONDS }).catch(() => {});

    const responsePayload: any = { data: result };
    if (includeDebug) {
      const adSettings = result[AD_SETTINGS_CONFIG_KEY] ?? null;
      const hasAdSettingsRow = !!adSettings;
      let adCodeCount = 0;
      if (adSettings && typeof adSettings === 'object') {
        for (const k of Object.keys(adSettings)) {
          if (k.endsWith('Code') && typeof adSettings[k] === 'string' && adSettings[k].trim().length > 0) adCodeCount += 1;
        }
      }
      responsePayload.__diagnostics = {
        hasAdSettingsRow,
        adCodeCount,
        cacheTier: 'L3-db',
        note: 'If adCodeCount is 0 the public ad settings contain no ad snippets (admin must populate AD settings in Admin UI).',
      };
      if (process.env.NODE_ENV !== 'production') console.debug('[PublicConfig] diagnostics', responsePayload.__diagnostics);
    }

    return NextResponse.json(responsePayload, {
      headers: { 'X-Cache-Tier': 'L3-db' },
    });
  } catch (err) {
    console.warn('[PublicConfig] Fetch failed, returning fallback config:', (err as Error).message);
    if (memCachedData) {
      return NextResponse.json({ data: memCachedData });
    }
    return NextResponse.json({ data: {} });
  }
}
