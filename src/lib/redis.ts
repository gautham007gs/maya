import 'server-only';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis Client with Zero-Downtime Circuit Breaker & Graceful Fallback
 *
 * Upstash Free tier (current): 500,000 commands/month, 256 MB data,
 * 10 GB monthly bandwidth, 1 database. Redis here is used ONLY as an
 * L2 performance cache (public-config, blog list/post). It is never the
 * authoritative rate limiter — that lives in MySQL (shared-rate-limiter.ts)
 * so a Redis outage can never take the site down or blow the command budget.
 *
 * - Fast HTTP-based REST connection (works seamlessly in Serverless, Edge, and Node.js)
 * - Circuit breaker prevents cascading failures if Redis is unreachable or rate-limited
 * - Short timeout (1 s cache / 3 s health) — a cache must never make a request slower
 *   than just hitting the DB. If Redis is genuinely 4-6 s away, that is a region/network
 *   problem to fix in the Upstash console, not something to paper over with a bigger timeout.
 * - Every operation safely falls back to null/false so the app continues naturally via DB/memory
 */

let redisInstance: Redis | null = null;
let redisInitialized = false;

// ── Circuit Breaker State ──────────────────────────────────────────────────
let failureCount = 0;
const MAX_FAILURES_BEFORE_TRIP = 4;
const CIRCUIT_RESET_TIMEOUT_MS = 30_000;
let circuitOpenUntil = 0;
let lastError: string | null = null;

/** Timeout for a single ordinary cache round-trip. A cache slower than this is worse than no cache. */
const REDIS_TIMEOUT_MS = 1_000;
/** Slightly longer allowance for the explicit health/diagnostics check only. */
const REDIS_HEALTH_TIMEOUT_MS = 3_000;

// ── Command-usage guardrail (soft, in-memory, best-effort) ─────────────────
// Upstash Free = 500K commands/month. We track a rough monthly counter so we
// can log a warning well before the account risks throttling/suspension.
// This is NOT authoritative (resets on redeploy/cold start) — it's a cheap
// early-warning signal, not a billing meter.
const COMMAND_WARN_THRESHOLD = 250_000;
const COMMAND_DANGER_THRESHOLD = 400_000;
let monthlyCommandCount = 0;
let monthlyCommandWindowStart = Date.now();
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function trackCommand(n = 1): void {
  const now = Date.now();
  if (now - monthlyCommandWindowStart > MONTH_MS) {
    monthlyCommandCount = 0;
    monthlyCommandWindowStart = now;
  }
  monthlyCommandCount += n;
  if (monthlyCommandCount === COMMAND_WARN_THRESHOLD || monthlyCommandCount === COMMAND_DANGER_THRESHOLD) {
    console.warn(`[Upstash Redis] Approximate command usage this window: ${monthlyCommandCount} (soft counter, not billing-accurate).`);
  }
}

/** Reject values that are too large to be a sane cache entry (protects the 256 MB free storage cap). */
const MAX_CACHE_VALUE_BYTES = 500 * 1024; // 500 KB soft ceiling per docs/audit recommendation
function isValueTooLarge(value: any): boolean {
  try {
    const bytes = Buffer.byteLength(JSON.stringify(value ?? ''), 'utf8');
    return bytes > MAX_CACHE_VALUE_BYTES;
  } catch {
    return false;
  }
}

function getClient(): Redis | null {
  if (redisInitialized) return redisInstance;
  redisInitialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Upstash Redis] REST URL or Token not set. Operating in memory/DB fallback mode.');
    }
    return null;
  }

  try {
    redisInstance = new Redis({
      url,
      token,
      // Automatic retry configuration for transient network blips
      retry: {
        retries: 2,
        backoff: (retryCount) => Math.min(Math.exp(retryCount) * 100, 500),
      },
    });
    return redisInstance;
  } catch (err) {
    console.warn('[Upstash Redis] Failed to initialize client:', (err as Error).message);
    return null;
  }
}

/** Check if the circuit breaker is currently open (cooling down after errors) */
export function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

/** Record a successful Redis operation (resets error counter) */
function recordSuccess(): void {
  failureCount = 0;
  circuitOpenUntil = 0;
  lastError = null;
}

/** Record a failed Redis operation (trips circuit breaker if threshold reached) */
function recordFailure(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Dynamic server usage') || msg.includes('DYNAMIC_SERVER_USAGE')) {
    // Next.js build-time prerendering marker — safe to ignore during build
    return;
  }
  failureCount += 1;
  lastError = msg;

  if (failureCount >= MAX_FAILURES_BEFORE_TRIP) {
    circuitOpenUntil = Date.now() + CIRCUIT_RESET_TIMEOUT_MS;
    console.warn(
      `[Upstash Redis] Circuit breaker tripped for 30s due to ${failureCount} consecutive errors: ${msg}`
    );
  }
}

/** Execute a Redis command wrapped in a timeout promise */
async function withTimeout<T>(promise: Promise<T>, timeoutMs = REDIS_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis operation timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

// ── Safe Public API Helpers ────────────────────────────────────────────────

/**
 * Safely retrieve a cached item from Redis.
 * Returns `null` if missing, circuit is open, or any error occurs.
 */
export async function redisGet<T = any>(key: string): Promise<T | null> {
  if (isCircuitOpen()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const data = await withTimeout(client.get<T>(key));
    trackCommand();
    recordSuccess();
    return data ?? null;
  } catch (err) {
    recordFailure(err);
    return null;
  }
}

/**
 * Safely set an item in Redis with an optional TTL in seconds.
 * Returns `true` if saved, `false` otherwise.
 */
export async function redisSet(
  key: string,
  value: any,
  options?: { ex?: number }
): Promise<boolean> {
  if (isCircuitOpen()) return false;
  const client = getClient();
  if (!client) return false;

  if (isValueTooLarge(value)) {
    console.warn(`[Upstash Redis] Refusing to cache "${key}" — value exceeds ${MAX_CACHE_VALUE_BYTES} bytes.`);
    return false;
  }

  try {
    // Every cache entry MUST have a TTL — never let Redis accumulate permanent keys
    // on a 256 MB free plan. Default to 1 hour if a caller forgets to pass one.
    const ex = options?.ex && options.ex > 0 ? options.ex : 3600;
    await withTimeout(client.set(key, value, { ex }));
    trackCommand();
    recordSuccess();
    return true;
  } catch (err) {
    recordFailure(err);
    return false;
  }
}

/**
 * Safely delete one or multiple keys from Redis.
 */
export async function redisDel(keys: string | string[]): Promise<boolean> {
  if (isCircuitOpen()) return false;
  const client = getClient();
  if (!client) return false;

  const keyList = Array.isArray(keys) ? keys : [keys];
  if (keyList.length === 0) return true;

  try {
    await withTimeout(client.del(...keyList));
    trackCommand();
    recordSuccess();
    return true;
  } catch (err) {
    recordFailure(err);
    return false;
  }
}

/**
 * Atomic Increment with TTL (ideal for rate limiting & quotas).
 * Increments the key and sets expiration on first creation in a single round-trip.
 */
export async function redisIncrWithTtl(
  key: string,
  ttlSeconds: number,
  incrementBy = 1
): Promise<{ count: number } | null> {
  if (isCircuitOpen()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    // Pipeline INCRBY + EXPIRE for atomic 1-roundtrip execution
    const pipeline = client.pipeline();
    if (incrementBy > 1) {
      pipeline.incrby(key, incrementBy);
    } else {
      pipeline.incr(key);
    }
    pipeline.expire(key, ttlSeconds);
    const results = await withTimeout(pipeline.exec());
    trackCommand(2); // INCR/INCRBY + EXPIRE = 2 commands, even though pipelined in 1 round-trip
    recordSuccess();

    const count = Number(results[0]) || incrementBy;
    return { count };
  } catch (err) {
    recordFailure(err);
    return null;
  }
}

/**
 * Invalidate multiple cache patterns or keys safely.
 */
export async function invalidateCacheKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redisDel(keys);
}

/**
 * Diagnostics & Health reporting for Admin Panel or health checks.
 */
export async function getRedisHealth(): Promise<{
  configured: boolean;
  status: 'connected' | 'degraded' | 'disabled' | 'error';
  latencyMs?: number;
  circuitOpen: boolean;
  failureCount: number;
  lastError: string | null;
  approxCommandsThisWindow?: number;
}> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const configured = Boolean(url && token);

  if (!configured) {
    return {
      configured: false,
      status: 'disabled',
      circuitOpen: false,
      failureCount: 0,
      lastError: 'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN',
    };
  }

  const client = getClient();
  if (!client) {
    return {
      configured: true,
      status: 'error',
      circuitOpen: isCircuitOpen(),
      failureCount,
      lastError,
    };
  }

  if (isCircuitOpen()) {
    return {
      configured: true,
      status: 'degraded',
      circuitOpen: true,
      failureCount,
      lastError,
    };
  }

  const start = Date.now();
  try {
    await withTimeout(client.ping(), REDIS_HEALTH_TIMEOUT_MS);
    const latencyMs = Date.now() - start;
    recordSuccess();
    return {
      configured: true,
      status: 'connected',
      latencyMs,
      circuitOpen: false,
      failureCount: 0,
      lastError: null,
      approxCommandsThisWindow: monthlyCommandCount,
    };
  } catch (err) {
    recordFailure(err);
    return {
      configured: true,
      status: 'error',
      circuitOpen: isCircuitOpen(),
      failureCount,
      lastError: (err as Error).message,
      approxCommandsThisWindow: monthlyCommandCount,
    };
  }
}

export default {
  redisGet,
  redisSet,
  redisDel,
  redisIncrWithTtl,
  invalidateCacheKeys,
  getRedisHealth,
  isCircuitOpen,
};
