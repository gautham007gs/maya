# Integrations Guide — Kruthika AI

> **Last updated:** 2026-08-21  
> **Next re-scan trigger:** update this file when a new third-party integration is added or an existing one is removed. Check `src/lib/` and `src/app/api/` for integration files.  
> **AI Agent Note:** This file documents all external service integrations. Cross-reference with `.env.example` for required environment variables. Each section lists the source files that implement the integration.

---

## Integration Index

| Service | Purpose | Status | Env Vars Required |
|---|---|---|---|
| [OneSignal](#onesignal) | Push notifications | Optional | `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` |
| [ElevenLabs](#elevenlabs) | Text-to-speech (voice messages) | Optional | `ELEVENLABS_API_KEY_1`…`20` + DB |
| [Sarvam AI](#sarvam-ai) | Multilingual TTS (Indian languages) | Optional | `SARVAM_API_KEY_1`…`N` + DB |
| [Adsterra](#adsterra) | Ad monetization | Optional | `ADSTERRA_API_KEY` (stats) + codes in DB (`app_configurations`) |
| [Google Gemini](#ai-providers) | AI chat (primary) | At least one required | `GEMINI_API_KEY` |
| [Cloudflare Workers AI](#cloudflare-workers-ai) | AI chat (#2, multilingual) | Optional | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (or DB via Admin) |
| [Groq](#ai-providers) | AI chat (fast) | At least one required | `GROQ_API_KEY` |
| [Cerebras](#ai-providers) | AI chat | Optional | `CEREBRAS_API_KEY` |
| [SambaNova](#ai-providers) | AI chat | Optional | `SAMBANOVA_API_KEY` |
| [GitHub Models](#ai-providers) | AI chat | Optional | `GITHUB_TOKEN` |
| [OpenRouter](#ai-providers) | AI chat | Optional | `OPENROUTER_API_KEY` |
| [NVIDIA NIM](#ai-providers) | AI chat | Optional | `NVIDIA_API_KEY` |
| [Mistral](#ai-providers) | AI chat | Optional | `MISTRAL_API_KEY` |
| [Cohere](#ai-providers) | AI chat | Optional | `COHERE_API_KEY` |
| [DeepSeek](#ai-providers) | AI chat (paid, overflow) | Optional | `DEEPSEEK_API_KEY` |
| [IndexNow](#indexnow) | SEO search engine pinging | Enabled | Key hardcoded in `src/lib/indexnow.ts` |
| [Upstash Redis](#upstash-redis) | Cache (public-config, blog) | Optional | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

---

## OneSignal

**Purpose:** Web push notifications — re-engagement messages, proactive AI messages, morning/evening check-ins.

**Source files:**
- `src/lib/onesignal.ts` — client (sends notifications via REST API)
- `src/lib/smart-notifications.ts` — scheduling logic
- `src/app/api/admin/notifications/route.ts` — admin API
- `src/components/OneSignalInit.tsx` — browser SDK init
- `public/push/onesignal/OneSignalSDKWorker.js` — OneSignal worker, dedicated scope `/push/onesignal/` (required — do not remove)
- `public/push/onesignal/OneSignalSDKUpdaterWorker.js` — OneSignal updater worker, same scope (required — do not remove)
- `public/OneSignalSDKWorker.js`, `public/OneSignalSDKUpdaterWorker.js` — legacy root-scope workers kept for existing subscribers (retention until 2027-08-13, do not remove)

**Service worker scoping (important):** The PWA service worker (`public/sw.js`) owns root scope `/`. OneSignal's worker is registered at the dedicated scope `/push/onesignal/` (configured via `serviceWorkerPath`/`serviceWorkerParam` in `src/lib/onesignal.ts`). Each scope can hold only one service worker — keeping them separate prevents the PWA worker from clobbering the push subscription after reloads, deploys, or browser restarts.

**Setup:**

1. Create a free account at [onesignal.com](https://onesignal.com)
2. Create a new app → choose **Web** platform → **Typical Site**
3. Go to **Settings → Keys & IDs** → copy **App ID** and **REST API Key**
4. Go to **Settings → Platforms → Web** → download `OneSignalSDKWorker.js` and `OneSignalSDKUpdaterWorker.js` → place in `public/push/onesignal/`
5. In **Web Settings → Advanced Push Settings**, enable **Customize service worker paths and filenames**: path `/push/onesignal/`, filename `OneSignalSDKWorker.js`, registration scope `/push/onesignal/` (matches the init options in `src/lib/onesignal.ts`)
6. Set your site URL in OneSignal → Web Settings (must be HTTPS in production)
7. The site uses OneSignal's native slidedown prompt as the only permission UI. It appears after the first page view with a short delay and then opens the browser/OS permission dialog after the visitor chooses **Allow**.
7. Add to environment variables:

```bash
NEXT_PUBLIC_ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONESIGNAL_REST_API_KEY=os_v2_app_xxxxxxxxxxxxxxxxxxxxx
```

**Testing:**
```bash
# Send a test push from Admin Panel
# → Admin → Notifications → New Notification → Send Now
```

**Notes:**
- OneSignal only works on the production domain (`kruthika.fun`) — the SDK refuses to initialize on any other domain.
- In development, OneSignal logs: `[OneSignal] Domain restriction — SDK only works on its configured site.` — this is expected.
- Web push is delivered by the device notification system, not an in-browser chat bubble. Android browsers support this when permission is granted; iOS/iPadOS web push requires the site to be installed to the Home Screen (16.4+).
- The admin Compose tab can schedule a broadcast to the `Subscribed Users` segment using OneSignal's UTC `send_after` field. Scheduling does not send a test notification during setup.
- **Env var rename (2026-08):** `ONESIGNAL_API_KEY` → `ONESIGNAL_REST_API_KEY`, and the app ID is now `NEXT_PUBLIC_ONESIGNAL_APP_ID` (browser SDK needs the public-prefixed var).

---

## ElevenLabs

**Purpose:** High-quality AI voice messages (English and multilingual).

**Source files:**
- `src/lib/elevenlabs-tts.ts` — TTS API client
- `src/lib/elevenlabs-key-manager.ts` — key pool rotation (reads `api_keys` table, provider = `elevenlabs`)
- `src/app/api/admin/elevenlabs-keys/route.ts` — admin CRUD for keys
- `src/app/api/voice/generate/route.ts` — voice generation endpoint

**Setup:**
1. Create an account at [elevenlabs.io](https://elevenlabs.io)
2. Go to Profile → API Keys → Create a new key
3. Add the key via **Admin Panel → Voice Settings → ElevenLabs Keys tab**
   (Keys are stored encrypted in the `api_keys` table, provider = `elevenlabs`)
4. Select a Voice ID in **Admin Panel → Voice Settings**

**Env var keys:** `ELEVENLABS_API_KEY_1` … `ELEVENLABS_API_KEY_20` (rotated on exhaustion, see `src/lib/elevenlabs-key-manager.ts`).

**Voice settings stored in DB:**
- `app_configurations` key: `voice_provider_settings` (feature flags: `elevenlabs_enabled`, `sarvam_enabled`)
- Per-provider voice details (voice ID, model, stability, similarity boost, language) are stored under provider-specific keys; see `src/lib/voice-router.ts` (`CONFIG_ID`) and the Admin Panel → Voice Settings tab

---

## Sarvam AI

**Purpose:** Indian-language TTS — supports 10 languages (Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, English-India).

**Source files:**
- `src/lib/sarvam-tts.ts` — TTS API client
- `src/lib/sarvam-key-manager.ts` — key pool rotation (reads `sarvam_api_keys` table)
- `src/app/api/admin/sarvam-keys/route.ts` — admin CRUD for keys
- `database/03_voice_schema.sql` — `sarvam_api_keys` table schema

**Setup:**
1. Create a free account at [sarvam.ai](https://sarvam.ai)
2. Go to API Keys → Generate key
3. Add the key via **Admin Panel → Voice Settings → Sarvam Keys tab**
   (Keys are stored in the `sarvam_api_keys` table — only a hash/prefix; the real key goes in env)
4. Add key to environment:
```bash
SARVAM_API_KEY_1=<your key>
SARVAM_API_KEY_2=<backup key>  # optional — auto-rotates on exhaustion
```

**Key exhaustion:** Sarvam's free tier has a credit limit. When a key returns 402, the system automatically marks it exhausted in `sarvam_api_keys` and switches to the next `SARVAM_API_KEY_N` env var.

---

## Adsterra

**Purpose:** Ad monetization — social bars, native banners, popunders, display banners, direct links.

**Source files:**
- `src/lib/ad-code-registry.ts` — ad code lookup by placement
- `src/lib/ad-injection-lock.ts` — prevents double-injecting ad scripts (3.5 s FIFO lock)
- `src/lib/csp-nonce.ts` — stamps the page CSP nonce onto injected `<script>` tags
- `src/components/ads/StickyMobileAd.tsx` — mobile sticky banner
- `src/components/ads/DesktopRailAd.tsx` — desktop sidebar rail ad
- `src/components/homepage/HomepageAdSlots.tsx` — homepage ad slots
- `src/components/chat/BannerAdDisplay.tsx` — in-chat banner
- `src/components/chat/SocialBarAdDisplay.tsx` — in-chat social bar
- `src/components/chat/DirectLinkAd.tsx` — direct-link ad
- `src/components/GlobalAdScripts.tsx` — popunder / global scripts
- `src/app/api/adsterra/stats/route.ts` — Adsterra stats sync (`ADSTERRA_API_KEY`)

**Setup:**
1. Create an account at [adsterra.com](https://adsterra.com)
2. Create placements for each ad type you want
3. In **Admin Panel → Ads tab**:
   - Paste ad codes into the appropriate fields
   - Toggle placements on/off individually
   - Set direct-link URL if using direct links
4. Optional: set `ADSTERRA_API_KEY` in env for the stats dashboard

**All ad settings stored in DB:**
- `app_configurations` key: `ad_settings_kruthika_chat_v1`
- Master toggle: `adsEnabledGlobally` — if false, all ads are suppressed everywhere

**CSP integration (important):** The nonce-based Content-Security-Policy blocks
third-party inline scripts by default. Ad components stamp the per-request nonce
(server-set, exposed via the `<meta name="csp-nonce">` tag) onto the Adsterra
`<script>` elements they inject, and the CSP `script-src` allowlists the Adsterra
SDK hosts (`adsterra.com`, `exdynsrv.com`, `highperformanceformat.com`). If ads
render blank, check `docs/SECURITY.md` CSP section first.

**Instagram detection:** `instagramDetectionEnabled = true` suppresses ads when the in-app Instagram browser is detected (ads don't render there; detection source: `src/lib/instagram-browser.ts`).

---

## Cloudflare Workers AI

**Purpose:** Provider #2 in the AI cascade — free (10,000 neurons/day) multilingual model (Qwen 2.5 72B) that handles Hindi/Tamil/Kannada/Telugu well when Gemini keys are drained.

**Source files:**
- `src/ai/multi-provider.ts` — `callCloudflare()` implementation
- `src/components/admin/AIKeysTab.tsx` — admin UI collects **both** API Token and Account ID (stored combined as `token:::accountId` in the `api_keys` table)

**Setup:**
1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **Workers AI** → accept the free-tier terms
3. Create an API token: **My Profile → API Tokens → Create Token → Workers AI template**
4. Copy your **Account ID** (shown on the Workers AI / dashboard landing page)
5. Add the key via **Admin Panel → AI Keys tab** (choose the Cloudflare provider — it shows two fields), or set both env vars:

```bash
CLOUDFLARE_API_TOKEN=<your token>
CLOUDFLARE_ACCOUNT_ID=<your account id>
```

> ⚠️ Both values are required — a token without an Account ID cannot call Workers AI.

---

## AI Providers

**Purpose:** Power the chat AI. The system uses a multi-provider fallback chain — if the primary provider fails or rate-limits, the next one is tried automatically.

**Source files:**
- `src/ai/multi-provider.ts` — multi-provider orchestrator (main logic)
- `src/ai/vertex-ai.ts` — backward-compat shim re-exporting from multi-provider
- `src/app/api/admin/api-keys/route.ts` — admin CRUD for keys
- `database/01_core_schema.sql` — `api_keys` and `api_key_logs` tables

**PROVIDER_ORDER (2026-08-21) — tried in this order, Gemini-first:**

| Order | Provider | Env var | Free tier | Notes |
|---|---|---|---|---|
| 1 | Google Gemini | `GEMINI_API_KEY` | Yes | **Primary.** All Gemini keys/models drained first |
| 2 | Cloudflare Workers AI | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Yes | 10,000 neurons/day; Qwen 2.5 72B, strong Indic languages. See [Cloudflare Workers AI](#cloudflare-workers-ai) |
| 3 | Groq | `GROQ_API_KEY` | Yes | Fastest inference; get key at console.groq.com |
| 4 | Cerebras | `CEREBRAS_API_KEY` | Yes | Very fast; get key at cloud.cerebras.ai |
| 5 | SambaNova | `SAMBANOVA_API_KEY` | Yes | cloud.sambanova.ai |
| 6 | GitHub Models | `GITHUB_TOKEN` | Yes | github.com/settings/tokens (classic, no scopes) |
| 7 | OpenRouter | `OPENROUTER_API_KEY` | Yes | openrouter.ai |
| 8 | NVIDIA NIM | `NVIDIA_API_KEY` | Yes | 40 RPM free, 100+ models; build.nvidia.com |
| 9 | Mistral | `MISTRAL_API_KEY` | Limited | api.mistral.ai |
| 10 | Cohere | `COHERE_API_KEY` | Limited | Cohere v2 API |
| 11 | DeepSeek | `DEEPSEEK_API_KEY` | No | Paid-only; used as final overflow |

**Removed providers** (fully paid, no free tier — removed from the chain): OpenAI, Anthropic Claude, Grok (xAI), Together AI, Perplexity.

**How to add keys:**
- Via Admin Panel → AI Keys tab (stored in `api_keys` table)
- Or via `.env` for initial bootstrap (multi-provider.ts reads env vars as fallback)

**Fallback chain:** priority column in `api_keys` table. Lower number = tried first. On error, increments `error_count` and marks `status = exhausted` after threshold.

---

## IndexNow

**Purpose:** Notifies search engines (Bing, Yandex, and via Bing's relay Google) about new/updated blog posts immediately after publishing.

**Source files:**
- `src/lib/indexnow.ts` — IndexNow API client + `pingIndexNow()` + `blogUrl()`
- `src/app/api/cron/seo/route.ts` — cron-triggered SEO ping (also publishes scheduled posts)
- `src/lib/blog-db.ts` — `publishScheduledPosts()`

**Setup:**
1. The key is a **hardcoded constant** in `src/lib/indexnow.ts` (`INDEX_NOW_KEY`) — no env var needed.
2. The verification file must be served at `public/<key>.txt` containing just the key string (check `public/` — it should already exist).

**Trigger:** Fires via the SEO cron (`/api/cron/seo`) or manually:
```bash
curl -X POST https://kruthika.fun/api/cron/seo \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Upstash Redis

**Purpose:** Optional performance cache for `public-config` and blog list/post reads. **Never used for rate limiting** — the rate limiter is L1 in-memory → MySQL (authoritative), so the free-tier command budget is reserved for caching only.

**Source files:**
- `src/lib/redis.ts` — client, circuit breaker, TTL/value guards, health probe
- `src/lib/shared-rate-limiter.ts` — documents why Redis is excluded from rate limiting
- `src/lib/public-config-cache.ts`, `src/lib/blog-db.ts` — cache consumers
- `src/app/api/health/redis/route.ts` — health endpoint (public gets `{status}` only; full diagnostics + `?test=1` write/read/delete probe require a verified admin session)

**Setup (optional — app falls back to memory/DB without it):**
1. Create a free database at [upstash.com](https://upstash.com) (Free = 500K commands/month, 256 MB data, 10 GB bandwidth)
2. Pick a region close to your Hostinger server
3. Set the env vars:

```bash
UPSTASH_REDIS_REST_URL=https://<db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your token>
```

**Behavior guards (all in `src/lib/redis.ts`):**
- Timeouts: `REDIS_TIMEOUT_MS = 1000` (cache ops) / `REDIS_HEALTH_TIMEOUT_MS = 3000` (health)
- Circuit breaker: opens 30 s after 4 consecutive failures; consumers race with 1 s outer timeouts
- Every `redisSet` enforces a TTL (defaults 1 h) and rejects values > 500 KB
- Soft in-memory monthly command counter warns at 250K/400K (not billing-accurate; resets on redeploy)
- If Redis is down or unset, everything degrades gracefully to in-memory/MySQL

---

## Removing an integration

To disable an integration without removing code:
- **OneSignal:** Remove `NEXT_PUBLIC_ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` from env
- **ElevenLabs/Sarvam:** Disable in Admin Panel → Voice Settings → toggle off
- **Adsterra:** Set `adsEnabledGlobally = false` in Admin → Ads tab
- **AI provider (incl. Cloudflare):** Disable in Admin → AI Keys → Provider toggle (or remove the env var(s))
- **Upstash Redis:** Remove `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — app falls back to memory/DB caching
- **IndexNow:** Change `INDEX_NOW_KEY` in `src/lib/indexnow.ts` or delete the `public/<key>.txt` file
