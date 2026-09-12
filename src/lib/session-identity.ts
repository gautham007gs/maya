/**
 * Server-side session identity helpers.
 *
 * The ONLY authoritative client identity in this app is the signed,
 * HttpOnly, SameSite=Strict session cookie issued by the server
 * (MEMORY_COOKIE). Client-supplied identifiers in bodies/query strings
 * (e.g. a localStorage "sessionId") are never trusted as ownership proof.
 *
 * These helpers centralise:
 *   - reading + verifying the signed session cookie
 *   - minting a fresh identity (for GET-style routes that need one)
 *   - resolving a best-effort client IP (handles proxies/CDN chains)
 */

import 'server-only';
import SecureCookieManager, { MEMORY_COOKIE } from './secure-cookies';
import { NextRequest } from 'next/server';

export interface SessionIdentity {
  /** Verified server-issued session id, or null when no valid cookie present. */
  sid: string | null;
  /** Whether this request presented a valid signed cookie. */
  hadValidCookie: boolean;
  /** Best-effort client IP (first entry of X-Forwarded-For chain). */
  ip: string;
}

/** Normalise/truncate a client IP to a stable string suitable for rate-limit keys. */
export function normalizeClientIp(raw: string | null | undefined, maxLen = 64): string {
  let ip = (raw || '').trim();
  if (!ip || ip === 'unknown') return '0.0.0.0';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  // Strip IPv6 zone ids like fe80::1%eth0
  ip = ip.split('%')[0];
  return ip.substring(0, maxLen) || '0.0.0.0';
}

/**
 * Resolve the client IP from a request in a proxy-aware way.
 *
 * X-Forwarded-For / X-Real-IP are only trustworthy when the platform reverse
 * proxy rewrites them (e.g. Hostinger node hosting or a Cloudflare edge).
 * We never accept the raw `x-client-ip` header because it is client-spoofable.
 *
 * Strategy (override with TRUSTED_PROXY env):
 *   - 'cloudflare' → prefer `cf-connecting-ip` (Cloudflare guarantees it and
 *     it is the real client address, before any of your origin servers).
 *   - anything else / unset → use the first entry of `x-forwarded-for` (the
 *     entry the trusted platform proxy appended) with `x-real-ip` fallback.
 *
 * Centralising this here means IP-derived rate limits, admin lockout and
 * session identity all agree on the same address.
 */
export function getClientIp(request: { headers: Headers | Record<string, string | string[] | undefined> | { get(name: string): string | null } }): string {
  const h = toHeaders(request.headers);
  const proxyMode = (process.env.TRUSTED_PROXY || '').toLowerCase();

  if (proxyMode === 'cloudflare') {
    const cf = h.get('cf-connecting-ip');
    if (cf) return normalizeClientIp(cf);
  }

  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return normalizeClientIp(forwarded);

  const realIp = h.get('x-real-ip');
  if (realIp) return normalizeClientIp(realIp);

  return '0.0.0.0';
}

function toHeaders(input: Headers | Record<string, string | string[] | undefined> | { get(name: string): string | null }): { get(name: string): string | null } {
  if (input instanceof Headers) return input;
  if (typeof (input as { get?: unknown }).get === 'function') return input as { get(name: string): string | null };
  return {
    get(name: string): string | null {
      const v = (input as Record<string, string | string[] | undefined>)[name];
      if (Array.isArray(v)) return v[0] ?? null;
      return v ?? null;
    },
  };
}

/**
 * Extract the verified session id from the signed memory cookie.
 * Returns null when absent/malformed/forged — never fabricates identity.
 */
export function getVerifiedSessionId(request: NextRequest): string | null {
  return SecureCookieManager.getVerifiedSessionId(request.cookies.get(MEMORY_COOKIE)?.value);
}

/**
 * Full identity helper for routes that need the cookie AND the IP.
 */
export function resolveSessionIdentity(request: NextRequest): SessionIdentity {
  const sid = getVerifiedSessionId(request);
  return {
    sid,
    hadValidCookie: Boolean(sid),
    ip: getClientIp(request),
  };
}

/**
 * Same as resolveSessionIdentity but guarantees a session id: when the cookie
 * is absent it mints a fresh server-side identity (used by GET-style routes).
 * Callers must set the cookie on the response via `attachSessionCookie`.
 */
export function resolveOrMintSessionIdentity(request: NextRequest): SessionIdentity {
  const id = resolveSessionIdentity(request);
  if (!id.sid) {
    return { ...id, sid: SecureCookieManager.generateSessionId(), hadValidCookie: false };
  }
  return id;
}

/**
 * Attach (or refresh) the signed session cookie on a response when the request
 * had no valid cookie. Safe to call unconditionally — it no-ops when the
 * session already existed.
 */
export function attachSessionCookie(response: { headers: Headers }, identity: SessionIdentity): void {
  if (identity.hadValidCookie || !identity.sid) return;
  const cookieString = SecureCookieManager.buildSignedMemoryCookie(identity.sid);
  response.headers.append('Set-Cookie', cookieString);
}

export default {
  resolveSessionIdentity,
  resolveOrMintSessionIdentity,
  getVerifiedSessionId,
  attachSessionCookie,
  normalizeClientIp,
  getClientIp,
};
