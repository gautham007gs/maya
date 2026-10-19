# Security Architecture — Kruthika AI

> **Last updated:** 2026-08-21  
> **Next re-scan trigger:** update this file if `src/proxy.ts`, `src/lib/enhanced-security.ts`, or `src/lib/admin-auth.ts` change.  
> **AI Agent Note:** All security headers, rate limiting, and admin route protection run through the Next.js proxy (`src/proxy.ts`). **Next.js 16 renamed `middleware.ts` → `proxy.ts`** — the file must be named `proxy.ts`, export `proxy`, and declare `config.matcher`. Verify it's active by checking the build output for `ƒ Proxy (Middleware)`.

> NOTE: Client-side cookie helper (`src/lib/cookie-manager.ts`) now enforces the Secure attribute automatically when the page is served over HTTPS or when built in production. Critical auth cookies (e.g., `__Host-admin_session`, `__Host-kruthika_sid`) are still set server-side as HttpOnly and Secure and are not writable from client JS. This reduces the chance of accidentally setting non-Secure cookies for analytics or personalization categories in production.


---

## Security Layers

```
Incoming request
    │
    ▼
[src/proxy.ts]  ← runs on EVERY request (pages + API)
    │
    ├─ Generate per-request nonce (CSP)
    ├─ Stamp x-nonce / x-pathname / x-html-lang / x-ui-lang / x-country request headers
    ├─ Rate limiting (per-IP, 200 req/min, burst protection)
    ├─ DDoS / IP reputation check (MaximumSecurity)
    ├─ Admin route protection (/admin/* redirect to login)
    ├─ Inject security headers (CSP, HSTS, X-Frame-Options, etc.)
    └─ Forward nonce to Next.js bootstrap scripts
```

---

## Proxy (`src/proxy.ts`)

**Critical note:** Next.js 16 requires this file to be named exactly `proxy.ts` at `src/` or project root, with a named export `proxy` and a `config.matcher`. Any other name is silently ignored. (In Next.js ≤15 this file was `middleware.ts`.)

**What it does:**
- Generates a cryptographically random nonce per request for CSP
- Applies rate limiting to all API routes
- Runs DDoS / IP reputation checks for unauthenticated API requests
- Protects `/admin/*` routes — redirects to `/admin/login` if no valid session
- Sets all HTTP security headers on every response
- Stamps `x-pathname` on every request so the root layout can hide the footer on app surfaces (`/`, `/admin`, `/maya-chat`, `/status`)

**Matcher:** All paths except `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`.

---

## Content Security Policy (CSP)

Nonce-based CSP is applied per-request. The Adsterra ad network is explicitly
allowlisted (SDK scripts from `cdn.adsterra.com` / `highperformanceformat.com`,
creative iframes and images from `adsterra.com` / `exdynsrv.com`), and ad
components stamp the per-request nonce onto the `<script>` elements they inject
at runtime (`src/lib/csp-nonce.ts`, exposed to the client via the `csp-nonce`
meta tag in the root layout).

```
default-src 'self'
script-src 'self' 'nonce-{random}' blob: https://adsterra.com https://*.adsterra.com https://exdynsrv.com https://*.exdynsrv.com https://www.highperformanceformat.com https://*.highperformanceformat.com [dev: 'unsafe-eval']
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob: https:
font-src 'self' data: [dev: https://fonts.gstatic.com]
connect-src 'self' https: wss: blob:
frame-src 'self' blob: https:
media-src 'self' data: blob: https:
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none' (dev: 'self')
block-all-mixed-content
```

`img-src`, `frame-src`, `media-src` and `connect-src` accept `https:` because ad
creatives, tracking pixels and bid responses are served from a rotating set of
ad CDNs that cannot be enumerated ahead of time. Script execution remains
locked down: only the app's own nonce-tagged scripts and the allowlisted
Adsterra SDK hosts may run. `'unsafe-eval'` is only added in development
(Turbopack requires it). `CSP_SCRIPT_HOSTS`, `CSP_IMAGE_HOSTS`,
`CSP_CONNECT_HOSTS` and `CSP_FONT_HOSTS` env vars can append additional hosts.

---

## Rate Limiting

Per-IP rate limiting runs in proxy (not a separate service):

| Parameter | Value | Notes |
|---|---|---|
| Window | 60 seconds | Resets per IP per minute |
| Max requests | 200 / window | Generous for legitimate browsing |
| Burst limit | 60 in first 10 seconds | Protects against request floods |
| Min limit | 30 / window | Floor — repeat offenders still get this many |
| Penalty multiplier | 0.5× | Reduces limit for repeat offenders within same window |

Private IPs (`127.x`, `10.x`, `192.168.x`, etc.) are always exempt (dev proxies and internal services).

Verified admin sessions (HMAC-signed cookie) are exempt from rate limiting — admin panel fires 100+ parallel DB queries on load.

---

## Admin Authentication

**Source:** `src/lib/admin-auth.ts`

Admin sessions are HMAC-SHA256 signed JWT-style tokens stored in a `__Host-admin_session` cookie (__Host- prefix enforces secure, path=/ semantics).

**Login flow:**
1. POST `/api/admin/login` with `{ email, password }`
2. Server verifies credentials against `ADMIN_EMAIL` + `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD_SALT`) env vars
3. Signs a session token: `base64url(JSON.stringify({email, exp})) + "." + HMAC_SHA256_hex`
4. Sets `__Host-admin_session` cookie (HttpOnly, Secure in production, SameSite=Strict, Path=/)
5. Cookie is verified by proxy on every `/admin/*` request

**Session verification** uses Web Crypto (`crypto.subtle`) — available in both Edge Runtime and Node 18+. Constant-time comparison prevents timing attacks.

**Required env vars:**
- `ADMIN_EMAIL` — login email
- `ADMIN_PASSWORD` — login password (or `ADMIN_PASSWORD_HASH` + `ADMIN_PASSWORD_SALT`)
- `ADMIN_SESSION_SECRET` — HMAC signing key (32+ chars, random)

**Non-admin API route protection:** `/api/*` routes (except `/api/admin/*`) additionally require a valid admin session cookie before MaximumSecurity is applied — `verifyAdminSessionToken()` runs in `proxy.ts` for every non-admin API request.

## User Memory Session Identity (`/api/memory`, `/api/chat`)

**Source:** `src/lib/secure-cookies.ts` (HMAC signing), `src/app/api/memory/route.ts`, `src/app/api/chat/route.ts`

Anonymous user memory is keyed by a **server-issued signed session cookie** (`kruthika_sid` / `__Host-kruthika_sid` in production). This is the single authoritative identity:

1. First contact: server mints a random 32-byte session ID, HMAC-signs it, and sets it as an HttpOnly, SameSite=Strict cookie.
2. Every subsequent read/write verifies the cookie signature (`SecureCookieManager.getVerifiedSessionId`).
3. Client-supplied identifiers are **never** trusted for identity — the `?sid=` query parameter and the POST body `sid` field were removed in 2026-08 because a client could supply another user's ID and read/modify that user's memory (name, facts, topics, relationship level, emotional patterns, sent images/voices). `/api/chat` likewise loads memory only from the verified cookie; the client `conversationId` remains a UI history label only.

**Critical:** `COOKIE_SECRET` must be set in production — `SecureCookieManager` throws on startup otherwise. In dev it falls back to a hardcoded convenience secret.

---

## DDoS Protection (`src/lib/enhanced-security.ts`)

Runs for all unauthenticated non-admin API requests (invoked from `proxy.ts`).

Checks:
- User-Agent presence and validity
- Request header anomalies (bot signatures)
- IP reputation (basic heuristics)
- Request rate patterns

Returns a 403 response if the request looks automated/malicious. Verified admin sessions bypass this entirely.

> **Note (2026-08):** `/api/ai-keys` is a consolidation shim that re-exports `/api/admin/api-keys` handlers (`export { GET, POST }`) — the historical auth-bypass bug (truthy-object `verifyAdminSession` guard) is fixed. See `AUDIT_REPORT.md` C1 for the original write-up.

> **Note (2026-08):** `/api/health/redis` is locked down — anonymous callers get only `{status}`; full diagnostics and the `?test=1` write/read/delete probe require a verified admin session (see `docs/INTEGRATIONS.md` → Upstash Redis).

---

## Input Sanitization

**Source:** `src/lib/content-security.ts`, `src/lib/security-utils.ts`

- All user-submitted text is sanitized before DB insertion
- Prompt injection attempts are detected by `evaluators.ts` before reaching the AI
- SQL injection is prevented via parameterized queries throughout `src/lib/dbServer.ts`

---

## AI Prompt Injection Protection (`src/lib/brain/evaluators.ts`)

Detects attempts to extract system prompts or bypass AI persona:

- Triggers on: `ignore previous`, `system prompt`, `reveal your`, `your instructions`, etc.
- Safe: zodiac "gemini" (requires AI context words to trigger)
- Response: deflects naturally without acknowledging the attempt

---

## Security Headers (all responses)

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=(), usb=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) |
| `Content-Security-Policy` | Nonce-based (see above) |
| `X-DNS-Prefetch-Control` | `on` |
| `X-Download-Options` | `noopen` |
| `X-Permitted-Cross-Domain-Policies` | `none` |

---

## Cache Security

- API routes: `Cache-Control: no-store, no-cache, must-revalidate, private`
- Static assets: `Cache-Control: public, max-age=31536000, immutable`
- Public pages: `Cache-Control: public, max-age=3600, must-revalidate`

---

## Secrets management

Never hardcode secrets. Always use environment variables:

| Secret | Env var |
|---|---|
| Admin email | `ADMIN_EMAIL` |
| Admin password | `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH` + `ADMIN_PASSWORD_SALT`) |
| Admin session signing key | `ADMIN_SESSION_SECRET` |
| Cookie encryption | `COOKIE_SECRET` |
| API request signing | `REQUEST_SIGNATURE_SECRET` |
| Cron auth token | `CRON_SECRET` |
| AI API keys | `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, etc. |
| DB password | `MYSQL_PASSWORD` |
| OneSignal | `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` |
| Adsterra stats | `ADSTERRA_API_KEY` |

Use your host's secret manager or `.env` for sensitive values in local development.
On Hostinger: use hPanel → Node.js → Environment Variables.
