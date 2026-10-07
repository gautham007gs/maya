import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import MaximumSecurity from './lib/enhanced-security'
import { COUNTRY_HREFLANG_MAP } from './lib/hreflang'
import {
  COUNTRY_COOKIE,
  detectCountryFromRequest,
  detectLanguageFromRequest,
} from './lib/locales'
import { SESSION_COOKIE, verifyAdminSessionFromCookie } from './lib/admin-auth'
import { isTrustedHost, resolveTrustedHost, normalizeForwardedProto } from './lib/trusted-hosts'
import { getClientIp as resolveClientIp } from './lib/session-identity'

// ---------------------------------------------------------------------------
// Nonce-based Content Security Policy (Plan 3)
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== 'production'

/** Generate a cryptographically random 16-byte base64 nonce (Web Crypto — Edge-safe). */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

// ── Ad network hosts (Adsterra + common ad/CDN vendors) ─────────────────────
// The ad ecosystem loads code and creatives from a rotating set of domains. To
// allow those scripts to run while preserving nonce protection for app bootstrap
// scripts, explicitly allow the known ad/CDN hosts and broaden script-src-elem
// to permit https: origins. The proxy also stamps x-nonce on requests so
// client-side script injection can set matching nonce attributes.
const ADSTERRA_HOSTS = [
  'https://adsterra.com',
  'https://*.adsterra.com',
  'https://adterra.com',
  'https://*.adterra.com',
  'https://exdynsrv.com',
  'https://*.exdynsrv.com',
  'https://www.highperformanceformat.com',
  'https://*.highperformanceformat.com',
  // Additional Adsterra delivery / tracking domains observed in production
  'https://*.adsterratools.com',
  'https://*.profitabledisplaynetwork.com',
  'https://*.syndication.exdynsrv.com',
  'https://*.storageimagedisplay.com',
  'https://storageimagedisplay.com',
  // Current publisher delivery host used by the saved ad snippets.
  'https://appointedbewitchbrakes.com',
  'https://*.appointedbewitchbrakes.com',
].join(' ');

// Common helper hosts (OneSignal, common trackers used by ad SDKs)
const COMMON_AD_HOSTS = [
  'https://onesignal.com',
  'https://*.onesignal.com',
  'https://cdn.onesignal.com',
  'https://api.onesignal.com',
  'https://push.onesignal.com',
  'https://onesignal.pagecdn.com',
].join(' ');

// Google Fonts — Adsterra native-banner creatives load webfonts from here.
const GOOGLE_FONTS_HOSTS = 'https://fonts.googleapis.com https://fonts.gstatic.com';

function buildCSP(nonce: string): string {
  const scriptSrcExtra = " 'unsafe-eval'";
  const extraScriptHosts = process.env.CSP_SCRIPT_HOSTS ? ` ${process.env.CSP_SCRIPT_HOSTS}` : '';
  const extraConnectHosts = process.env.CSP_CONNECT_HOSTS ? ` ${process.env.CSP_CONNECT_HOSTS}` : '';

  // Opt-in flags (set these in production ONLY for short debugging windows):
  // - ALLOW_AD_INLINE=true      -> adds 'unsafe-inline' to script-src and script-src-elem
  // - ALLOW_ADS_INSECURE=true   -> allows http: in script/img/connect sources and removes block-all-mixed-content
  // These are intentionally opt-in via env to avoid accidental permanent weakening.
  const allowAdInline = process.env.ALLOW_AD_INLINE === 'true';
  const allowAdsInsecure = process.env.ALLOW_ADS_INSECURE === 'true';
  const inlineFlag = allowAdInline ? " 'unsafe-inline'" : '';

  // When allowing insecure ad hosts, explicitly permit the http: scheme for script/img/connect
  const insecureScriptScheme = allowAdsInsecure ? ' http:' : '';
  const insecureImgScheme = allowAdsInsecure ? ' http:' : '';
  const insecureConnectScheme = allowAdsInsecure ? ' http:' : '';

  // 'strict-dynamic' is critical for Adsterra: invoke.js is a trusted (nonced)
  // script that dynamically creates further <script> elements for the ad iframe,
  // tracking pixels, etc. Without 'strict-dynamic', those child scripts are
  // blocked because they don't carry the nonce themselves. With 'strict-dynamic'
  // the trust propagates from the parent script to everything it spawns.
  const strictDynamic = " 'strict-dynamic'";
  const scriptSrc = `script-src 'self' 'nonce-${nonce}'${strictDynamic} blob: ${ADSTERRA_HOSTS} ${COMMON_AD_HOSTS}${inlineFlag}${scriptSrcExtra}${extraScriptHosts}${insecureScriptScheme}`;
  const scriptSrcElem = `script-src-elem 'self' 'nonce-${nonce}'${strictDynamic} ${ADSTERRA_HOSTS} ${COMMON_AD_HOSTS} https:${allowAdsInsecure ? ' http:' : ''}${inlineFlag}${extraScriptHosts}`;

  return [
    "default-src 'self'",
    scriptSrc,
    scriptSrcElem,
    // Tailwind utility classes require unsafe-inline for styles.
    "style-src 'self' 'unsafe-inline'",
    // Allow images from https origins and any additional configured hosts.
    `img-src 'self' data: blob: https:${process.env.CSP_IMAGE_HOSTS ? ' ' + process.env.CSP_IMAGE_HOSTS : ''}${insecureImgScheme}`,
    // Google Fonts is needed both in dev and prod — Adsterra native-banner
    // creatives load webfonts from fonts.gstatic.com. CSP_FONT_HOSTS lets
    // operators add extra hosts via env without touching this file.
    `font-src 'self' data: ${GOOGLE_FONTS_HOSTS}${process.env.CSP_FONT_HOSTS ? ' ' + process.env.CSP_FONT_HOSTS : ''}`,
    `connect-src 'self' https: wss: blob:${extraConnectHosts}${insecureConnectScheme}`,
    // Adsterra iframe creatives + SDK documents load from https origins.
    "frame-src 'self' blob: https:",
    "media-src 'self' data: blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Browser-native mixed-content upgrade: any http:// subresource request
    // (including URLs hard-coded inside third-party ad scripts like Adsterra's
    // invoke.js, which our JS-level upgrade cannot reach) is automatically
    // re-requested over https://. Fixes Lighthouse is-on-https without breaking
    // vendors — their endpoints serve valid TLS certificates.
    "upgrade-insecure-requests",
    isDev ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    // NOTE: block-all-mixed-content was removed intentionally.
    // BannerAdDisplay.tsx and SocialBarAdDisplay.tsx already upgrade every
    // http:// URL to https:// in JS before touching the DOM. The CSP
    // block-all-mixed-content directive fired *before* that upgrade code ran,
    // silently blocking Adsterra creatives that load any resource over http.
    // Removing it lets the JS-level upgrade do its job. Mixed-content upgrades
    // are also enforced natively by modern browsers on HTTPS pages.
  ].join('; ')
}

/**
 * Cryptographically verify the admin session cookie (`__Host-admin_session`) using Web Crypto (HMAC-SHA256).
 * Matches the signing algorithm in src/lib/admin-auth.ts — changes there must
 * be kept in sync here.
 *
 * Returns true only when:
 *  1. The ADMIN_SESSION_SECRET env var is set
 *  2. The cookie is a valid base64url-encoded `payload.hexSig` pair
 *  3. The HMAC signature verifies against the payload
 *  4. The session has not expired
 */
async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  try {
    // base64url decode → "jsonPayload.hexSignature"
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot < 1) return false;
    const payload = decoded.substring(0, lastDot);
    const suppliedHex = decoded.substring(lastDot + 1);
    if (!payload || !suppliedHex) return false;

    // Check expiry before the expensive crypto work
    const parsed = JSON.parse(payload) as { email?: string; exp?: number };
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return false;

    // Recompute HMAC using Web Crypto (available in both Edge and Node ≥18)
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBuf = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expectedHex = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison to prevent timing attacks
    if (expectedHex.length !== suppliedHex.length) return false;
    let diff = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      diff |= expectedHex.charCodeAt(i) ^ suppliedHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// Advanced rate limiting for high traffic protection (keeping existing for backward compatibility)
const rateLimitMap = new Map<string, { count: number; lastReset: number; penalties: number }>();

// Prevent memory leak by cleaning up old IPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.lastReset > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 1000);

// const slowClientsMap = new Map<string, number>(); // reserved for slow-client tracking
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 200; // Generous limit for legitimate browsing
const MAX_REQUESTS_BURST = 60;       // Allow bursts (page loads fire many parallel /api/db calls)
// const SLOW_CLIENT_THRESHOLD = 5000;  // 5 seconds for slow responses (reserved)
const PENALTY_MULTIPLIER = 0.5;      // Reduce limits for repeat offenders
const MIN_REQUESTS_PER_WINDOW = 30;  // Baseline — one active page is ~10-15 calls

// Private / loopback / unroutable IPs that should never be rate-limited.
// These only appear in: (a) proxy forwarding from local dev or internal services,
// (b) server-to-server internal calls, or (c) cloud load balancers that strip
// the real client IP before forwarding. Rate-limiting them blocks all traffic
// indiscriminately because every user request ends up bucketed under the same
// address, which makes the limiter useless while breaking legitimate users.
const EXEMPT_IP_PREFIXES = ['127.', '::1', '10.', '172.16.', '172.17.', '172.18.',
  '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
  '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'];

function isPrivateIp(ip: string): boolean {
  return ip === 'unknown' || EXEMPT_IP_PREFIXES.some(p => ip.startsWith(p));
}

function isRateLimited(ip: string): boolean {
  // Private / internal / unknown IPs are never rate-limited — they represent
  // dev proxies or internal services, not real end-user traffic.
  if (isPrivateIp(ip)) return false;

  const now = Date.now();
  const userRate = rateLimitMap.get(ip);

  if (!userRate) {
    rateLimitMap.set(ip, { count: 1, lastReset: now, penalties: 0 });
    return false;
  }

  // Reset window — penalties do NOT carry over; carrying them across windows
  // caused the effective limit to collapse to MIN_REQUESTS_PER_WINDOW
  // permanently after just 2 busy minutes, breaking legitimate users.
  if (now - userRate.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastReset: now, penalties: 0 });
    return false;
  }

  // Effective limit: reduce for repeat offenders within the same window
  const effectiveLimit = Math.max(
    MIN_REQUESTS_PER_WINDOW,
    Math.floor(MAX_REQUESTS_PER_WINDOW * (1 - (userRate.penalties * PENALTY_MULTIPLIER)))
  );

  // Burst protection — more than MAX_REQUESTS_BURST in the first 10 seconds
  const recentWindow = 10 * 1000;
  if (userRate.count > MAX_REQUESTS_BURST && (now - userRate.lastReset) < recentWindow) {
    userRate.penalties++;
    console.warn(`[RATE-LIMIT] Burst protection triggered for IP ${ip} - Count: ${userRate.count}`);
    return true;
  }

  // Per-minute cap
  if (userRate.count >= effectiveLimit) {
    userRate.penalties++;
    console.warn(`[RATE-LIMIT] Limit exceeded for IP ${ip} - Count: ${userRate.count}, Limit: ${effectiveLimit}`);
    return true;
  }

  userRate.count++;

  if (userRate.count >= effectiveLimit * 0.8) {
    console.info(`[RATE-LIMIT] IP ${ip} approaching limit - Count: ${userRate.count}/${effectiveLimit}`);
  }

  return false;
}

function getClientIp(request: NextRequest): string {
  return resolveClientIp(request);
}

export async function proxy(request: NextRequest) {
  const middlewareStart = Date.now();
  const { pathname } = request.nextUrl;
  const adminSession = request.cookies.get(SESSION_COOKIE)?.value;

  // ── Canonical-host redirect (SEO audit #11, env-driven 2026-08-21) ──────────
  // Whichever host NEXT_PUBLIC_BASE_URL declares IS the canonical host; any
  // other host gets a hard 301 to it (same path + query). A <link rel="canonical">
  // alone is a weaker signal than a real redirect, and two crawlable hostnames
  // split link equity and crawl budget.
  //
  //   NEXT_PUBLIC_BASE_URL=https://kruthika.fun      -> www.* 301s to apex
  //   NEXT_PUBLIC_BASE_URL=https://www.kruthika.fun  -> apex 301s to www.*
  //
  // This replaces the old hardcoded www->apex redirect so the site can be
  // launched on EITHER host without a code change — just set the env var to
  // match, and every canonical/sitemap/hreflang/OG URL follows automatically
  // (they all read the same variable).
  //
  // Guards: skipped outside production, and never applied to localhost,
  // loopback IPs, or preview-tunnel hosts even if NODE_ENV is misconfigured.
  const rawHost = (request.headers.get('host') || '').trim().toLowerCase();
  const hostNoPort = rawHost.replace(/:\d+$/, '');
  let canonicalHost = '';
  try {
    canonicalHost = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun').hostname.toLowerCase();
  } catch { /* unparseable env — skip redirect below */ }

  const isLoopbackOrPreview =
    rawHost.startsWith('localhost') ||
    hostNoPort === '127.0.0.1' ||
    hostNoPort === '[::1]' ||
    hostNoPort === '::1' ||
    /^127\./.test(hostNoPort) ||
    hostNoPort.endsWith('.monkeycode-ai.live');

  if (!isDev && canonicalHost && hostNoPort && hostNoPort !== canonicalHost && !isLoopbackOrPreview) {
    // Always land on HTTPS — the production host terminates TLS (HSTS is set
    // further down), and an http->https+canonical redirect chain collapses to
    // this single hop instead of two.
    const redirectUrl = new URL(`https://${canonicalHost}${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl, 301);
  }

  // Generate a per-request nonce for the Content-Security-Policy.
  // Next.js 13.4+ reads the x-nonce request header and automatically
  // attaches it to all inline bootstrap scripts it generates.
  const nonce = generateNonce();
  const csp = buildCSP(nonce);
  const normalizedPathname = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const country = detectCountryFromRequest(
    request.cookies.get(COUNTRY_COOKIE)?.value,
    pathname,
    request.headers.get('accept-language'),
  );
  const uiLang = detectLanguageFromRequest(
    request.cookies.get('kruthika_ui_lang')?.value,
    request.headers.get('accept-language'),
  );
  const geoHreflang = COUNTRY_HREFLANG_MAP[normalizedPathname] || COUNTRY_HREFLANG_MAP[pathname];
  const htmlLang = geoHreflang
    ? geoHreflang.split('-')[0].toLowerCase()
    : (pathname === '/' ? (uiLang || 'en') : 'en');

  // Apply enhanced maximum security ONLY to API routes (not pages/assets)
  if (pathname.startsWith('/api/')) {
    // Admin routes (/api/admin/*) skip MaximumSecurity (IP-reputation / DDoS
    // checks) because they implement their own HMAC-signed session auth, and
    // the login endpoint must always be reachable so an admin can create a
    // session in the first place.  However, they still go through the legacy
    // rate limiter to guard against brute-force on /api/admin/login.
    const isAdminRoute = pathname.startsWith('/api/admin/');
    const ip = getClientIp(request);

    if (!isAdminRoute) {
      // For non-admin API routes: cryptographically verify the admin session.
      const isVerifiedAdmin = await verifyAdminSessionToken(adminSession);

      if (!isVerifiedAdmin) {
        // Full security check (DDoS protection, IP reputation, etc.) for
        // every unauthenticated request to public API routes.
        const securityCheck = await MaximumSecurity.secureRequest(request);
        if (securityCheck) return securityCheck;

        // Legacy rate limiter for anonymous/unauthenticated traffic only.
        // Verified admin sessions are exempt: they are cryptographically
        // authenticated and the admin panel legitimately fires 100+ parallel
        // DB queries on load — far more than what the limiter allows.
        if (isRateLimited(ip)) {
          console.warn(`[RATE-LIMIT] IP ${ip} exceeded rate limit on ${pathname}`);
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429, headers: {
              'X-Security-Block': 'legacy-rate-limit',
              'Retry-After': '60',
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '0'
            } }
          );
        }
      }
      // Verified admin sessions on non-admin routes: no rate limiting.
      // MaximumSecurity (IP reputation / DDoS) is also skipped above.
    }
    // Admin routes (/api/admin/*): no rate limiting, no IP reputation.
    // Each handler independently verifies the HMAC-signed session cookie.
  }

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const session = await verifyAdminSessionFromCookie(adminSession);
    if (!session.isValid) {
      const loginUrl = new URL('/admin/login', request.nextUrl.origin);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // For Server Actions and API routes, fix headers and continue
  if (pathname.startsWith('/api/') || request.method === 'POST') {
    // Trusted-host resolution: the client-supplied X-Forwarded-Host is ONLY
    // honoured when it matches the trusted allowlist (kruthika.fun,
    // www.kruthika.fun, dev hosts, *.monkeycode-ai.live preview tunnels).
    // An attacker-supplied `x-forwarded-host: evil.com` is never reflected
    // into Host / Origin / CORS — otherwise the server would issue ACAO for
    // arbitrary origins and enable credential-bearing cross-origin reads.
    const rawForwardedHost = request.headers.get('x-forwarded-host');
    const rawProto = request.headers.get('x-forwarded-proto');
    const trustedHost = resolveTrustedHost(request.headers.get('host'), rawForwardedHost);
    const proto = normalizeForwardedProto(rawProto);
    // Origin header: used only to decide whether to emit CORS headers for a
    // trusted cross-origin request. Never reflected for untrusted origins.
    const rawOrigin = request.headers.get('origin') || '';
    const originIsTrusted = isTrustedHost(rawOrigin.replace(/^https?:\/\//, ''));

    let response: ReturnType<typeof NextResponse.next>;

    // Only mutate Host/Origin/X-Forwarded-Host when the forwarded host is
    // actually one of ours. This keeps Server Action origin validation working
    // behind the Hostinger reverse proxy without trusting attacker input.
    const reqHeaders = new Headers(request.headers);
    if (trustedHost) {
      reqHeaders.set('x-forwarded-host', trustedHost);
      reqHeaders.set('host', trustedHost);
    }
    if (trustedHost && request.method === 'POST') {
      reqHeaders.set('origin', `${proto}://${trustedHost}`);
    }
    reqHeaders.set('x-nonce', nonce);
    reqHeaders.set('x-html-lang', htmlLang);
    reqHeaders.set('x-ui-lang', uiLang);
    reqHeaders.set('x-country', country);
    reqHeaders.set('x-pathname', request.nextUrl.pathname);
    response = NextResponse.next({ request: { headers: reqHeaders } });

    // CORS — emit Access-Control-Allow-Origin ONLY for trusted origins.
    // Untrusted Origin → no ACAO at all (browser blocks the cross-origin read).
    // Never `*` (this site relies on SameSite cookies).
    const corsOrigin = originIsTrusted && rawOrigin
      ? rawOrigin
      : (trustedHost && isTrustedHost(trustedHost) ? `${proto}://${trustedHost}` : null);
    if (corsOrigin) {
      response.headers.set('Access-Control-Allow-Origin', corsOrigin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, x-requested-with');
      response.headers.set('Vary', 'Origin');
    }

    // Enhanced security headers
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    if (!isDev) response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if ((request.headers.get('x-forwarded-proto') || request.nextUrl.protocol) === 'https:') {
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // Add caching headers for static assets
    if (request.nextUrl.pathname === '/sw.js') {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (request.nextUrl.pathname.startsWith('/_next/static/') || 
        request.nextUrl.pathname.includes('.')) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // No cache for dynamic content (prevents stale data attacks)
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      response.headers.set('Pragma', 'no-cache');
    }

    // Content-Security-Policy (nonce-based — replaces static header in next.config.js)
    response.headers.set('Content-Security-Policy', csp);

    // Add performance timing headers
    response.headers.set('Server-Timing', `middleware;dur=${Date.now() - middlewareStart}`);

    return response;
  }

  // Apply performance headers to all other requests (page routes, static assets)
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set('x-nonce', nonce);
  reqHeaders.set('x-html-lang', htmlLang);
  reqHeaders.set('x-ui-lang', uiLang);
  reqHeaders.set('x-country', country);
  // x-pathname drives the root layout's footer exclusion (admin, homepage,
  // maya-chat, status) and SiteFooter's country fallback — without it the
  // footer was rendered on every page including the app surfaces.
  reqHeaders.set('x-pathname', request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: reqHeaders } });

  // Add comprehensive Helmet.js-style security headers (SEO-friendly)
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  if (!isDev) response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');

  // Additional Helmet.js style headers
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // Only add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (!isDev) response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Allow indexing in production for SEO
  // Only block in development if explicitly needed
  if (process.env.NODE_ENV !== 'production' && process.env.BLOCK_INDEXING === 'true') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  // Add caching headers for static assets
  if (request.nextUrl.pathname === '/sw.js') {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (request.nextUrl.pathname.startsWith('/_next/static/') || 
      request.nextUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)$/i)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (!pathname.startsWith('/api') && !pathname.startsWith('/admin')) {
    // HTML varies by country/language cookies — use private max-age=0 to allow 304 revalidation
    response.headers.set('Cache-Control', 'private, max-age=0, must-revalidate');
    response.headers.set('Vary', 'Cookie, Accept-Language');
  }

  // Content-Security-Policy (nonce-based — replaces static header in next.config.js)
  response.headers.set('Content-Security-Policy', csp);

  // Add performance timing headers
  response.headers.set('Server-Timing', `middleware;dur=${Date.now() - middlewareStart}`);

  return response;
}

// Configure the matcher to run on page routes and API routes for header fixes
export const config = {
  matcher: [
    /*
     * Match ALL request paths except purely static assets:
     * - _next/static  (immutable webpack/CSS/font chunks)
     * - _next/image   (image optimisation)
     * - favicon.ico, robots.txt
     *
     * /api/* IS intentionally included so that rate-limiting and
     * MaximumSecurity checks run for every API request.
     */
    '/((?!_next/static|_next/image|favicon\.ico|robots\.txt).*)',
  ],
};
