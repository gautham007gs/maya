# Kruthika AI — AI Companion Web App

> **Last updated:** 2026-08-21
> **Build status:** ✅ Next.js 16.3.0 (Turbopack), zero TypeScript errors (`npm run build` ≈ 2.5 min)
> **Live site:** https://kruthika.fun
> **AI Agent:** Read `docs/AI_SYSTEM.md` first to understand the codebase architecture. Then read `database/README.md` for the DB schema.
> **Staleness rule:** Re-verify this README every 30 days. See the "For AI Agents" section at the bottom for what to re-scan.

---

## What is this?

Kruthika AI is a WhatsApp-style AI companion web app. Users chat with Kruthika, a 23-year-old psychology student persona powered by a multi-provider AI brain. The app features:

- Real-time AI chat with emotional state simulation
- Multi-language support (Hindi, English, Tamil, Telugu + 7 more Indian languages)
- Voice messages (ElevenLabs + Sarvam AI TTS)
- Proactive messaging and push notifications (OneSignal)
- Admin dashboard (AI profile, blog CMS, analytics, ad management)
- Blog with full SEO (sitemap, IndexNow, structured data, multilingual)
- PWA — installable on mobile, service worker, offline support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.0 (App Router + Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui + @tailwindcss/typography |
| Database | MySQL 8.x (Hostinger) — `mysql2` pool via `MYSQL_CONNECTION_LIMIT` (clamped 6–20, default 10; 3 s connect / 8 s query timeout) |
| AI Providers | Gemini, Cloudflare Workers AI, Groq, Cerebras, SambaNova, GitHub Models, OpenRouter, NVIDIA NIM, Mistral, Cohere, DeepSeek |
| Cache | Upstash Redis (**optional**) — public-config & blog caching only; never rate limiting |
| Push Notifications | OneSignal |
| TTS (voice) | ElevenLabs + Sarvam AI (multilingual) |
| Auth | HMAC-SHA256 signed session cookies (no third-party auth) |
| Ads | Adsterra (social bar, banners, native, popunder, direct link) |
| SEO | IndexNow, dynamic sitemap, JSON-LD structured data, hreflang, geo landing pages |
| Hosting | Hostinger Node.js + MySQL |
| Dev environment | Node.js 20.x / 22.x, `npm run dev` on port 5000 |

---

## Quick Start (local development)

```bash
git clone <repo-url>
cd <repo-folder>
npm install
cp .env.example .env   # fill in your values
npm run dev            # starts at http://localhost:5000
```

See **`LOCAL_SETUP.md`** for detailed setup instructions including env vars, DB setup, and common issues.

---

## Project Structure

```
kruthika-ai/
├── src/
│   ├── app/              Next.js App Router pages and API routes
│   │   ├── page.tsx      Home / chat list page
│   │   ├── maya-chat/    Main AI chat page
│   │   ├── lite/         Lightweight chat variant (lite-mode detection)
│   │   ├── admin/        Admin dashboard (login, analytics, blog, profile)
│   │   ├── blog/         Blog (listing, post, author, category pages)
│   │   ├── legal/        Legal pages (privacy, terms, cookie, accessibility)
│   │   ├── api/          All API routes
│   │   │   ├── chat/     Main AI chat endpoint
│   │   │   ├── admin/    Admin CRUD endpoints
│   │   │   ├── cron/     Cron job endpoints (proactive, reengagement, seo)
│   │   │   ├── voice/    TTS voice generation + pending delivery
│   │   │   └── ...       Analytics, memory, blog, health, upload, adsterra
│   │   ├── status/       Public status page
│   │   ├── diagnostics/  Dev diagnostics page
│   │   └── ...           Geo pages (in, us, uk, ca, au, br, id, my, ng, ph, pk, ae), faq, about, contact
│   ├── ai/               AI modules
│   │   ├── chat.ts               Orchestrator — buildSystemPrompt + generateResponse
│   │   ├── multi-provider.ts     Multi-provider fallback engine (main)
│   │   ├── prompt.ts             System prompt builder
│   │   ├── response-cleanup.ts   cleanLLMResponse + bubble splitting
│   │   ├── user-classifier.ts    User stage classification
│   │   ├── kruthika-day-state.ts Time-of-day emotional state
│   │   ├── kruthika-hormones.ts  Hormonal cycle simulation
│   │   └── flows/                Flow modules (emotional-state, proactive, voice, offline)
│   ├── lib/              Server-side utilities
│   │   ├── brain/        AI simulation engine (core)
│   │   │   ├── evaluators.ts         Message classification / prompt injection
│   │   │   ├── media-server.ts       Image sharing logic
│   │   │   ├── voice-server.ts       Voice note logic
│   │   │   └── constants.ts, types.ts
│   │   ├── mysql-client.ts  DB pool (default 10 conns via MYSQL_CONNECTION_LIMIT, 3 s connect / 8 s query timeout)
│   │   ├── redis.ts         Upstash Redis cache (optional, cache-only)
│   │   ├── admin-auth.ts    HMAC session auth
│   │   └── ...              Analytics, ads, TTS, security, SEO utilities
│   ├── components/       React UI components
│   │   ├── chat/         Chat UI (bubbles, typing indicator, voice player, ads)
│   │   ├── admin/        Admin panel tabs
│   │   ├── blog/         Blog post rendering (DbBlogPostContent.tsx)
│   │   ├── ads/          Ad placement components (StickyMobileAd, DesktopRailAd)
│   │   └── ui/           shadcn/ui components
│   ├── proxy.ts          Next.js 16 proxy (renamed middleware) — CSP, rate limiting, security headers, admin auth
│   ├── instrumentation.ts Node.js bootstrap — external-cron log, rate-limit/blocklist restore
│   ├── contexts/         React context providers
│   ├── types/            TypeScript types
│   └── utils/            Shared utilities (logger, performance)
├── public/               Static assets (icons, manifest, service worker, OG images)
├── scripts/              Ops scripts — backup-db.mjs, restore-db.mjs (see docs/BACKUP_RESTORE.md)
├── database/             SQL schema and migration files (run these to set up DB)
│   ├── README.md         DB documentation and table index
│   ├── 01_core_schema.sql … 04_migrations.sql   Core schema + patches
│   ├── 05_audit_remediation.sql                 Voice-retry columns, analytics index, ai_response_times
│   ├── 06_cms_foundation_migration.sql â€¦ 13_media_blobs.sql   CMS + media migrations
│   └── 99_access_grants.sql                     Permission grants
├── docs/                 Documentation
│   ├── AI_SYSTEM.md      AI architecture deep-dive
│   ├── DEPLOYMENT.md     Hostinger deployment guide
│   ├── INTEGRATIONS.md   Third-party integrations (OneSignal, TTS, ads, AI providers, Redis)
│   ├── CRON.md           Cron job architecture
│   ├── BACKUP_RESTORE.md MySQL backup/restore procedure
│   └── SECURITY.md       Security architecture
├── LOCAL_SETUP.md        Local development setup guide
├── AUDIT_REPORT.md       Full chat pipeline forensic audit (2026-08-07)
├── SEO_AUDIT_2026.md     SEO & technical audit with fix status (2026-08-06)
├── next.config.js
├── tailwind.config.ts
└── package.json
```

---

## Key Routes

| Route | What it is |
|---|---|
| `/` | Home — chat list (WhatsApp-style) |
| `/maya-chat` | Main AI chat interface |
| `/lite` | Lightweight chat variant |
| `/admin` | Admin dashboard (password protected) |
| `/admin/analytics` | Analytics — DAU, sessions, messages, revenue |
| `/admin/blog` | Blog CMS — create, edit, publish posts |
| `/admin/profile` | AI profile + media assets + status management |
| `/blog` | Blog listing |
| `/blog/[slug]` | Blog post page |
| `/blog/author/[slug]` | Author page |
| `/blog/category/[slug]` | Category page |
| `/status` | Public status page |
| `/diagnostics` | Dev diagnostics page |
| `/in`, `/us`, `/uk`, `/ca`, `/au` … | Geo landing pages (12 countries) |
| `/legal/*` | Privacy, terms, cookie policy, accessibility, editorial policy |
| `/api/chat` | AI chat API endpoint |
| `/api/health` | Health check (returns 200 healthy / 503 degraded) |
| `/api/cron/proactive` | Proactive messaging cron (bearer auth) |
| `/api/adsterra/stats` | Adsterra stats sync (bearer auth via `ADSTERRA_API_KEY`) |

---

## Environment Variables

See `.env.example` for the complete list. Key variables (accurate as of 2026-08-21):

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_EMAIL` | ✅ | Admin panel login email |
| `ADMIN_PASSWORD` | ✅ | Admin panel login password (or `ADMIN_PASSWORD_HASH` + `ADMIN_PASSWORD_SALT`) |
| `ADMIN_SESSION_SECRET` | ✅ | 32+ char string for signing admin sessions |
| `COOKIE_SECRET` | ✅ (prod) | Cookie encryption secret (32+ chars) |
| `REQUEST_SIGNATURE_SECRET` | ✅ (prod) | Internal API request signing (32+ chars) |
| `GROQ_API_KEY` | Recommended | Groq AI (fastest, free tier) |
| `GEMINI_API_KEY` | Recommended | Google Gemini AI (primary provider) |
| `MYSQL_HOST` | No | DB host — app degrades gracefully without DB |
| `MYSQL_DATABASE` | No | DB name |
| `MYSQL_USER` | No | DB username |
| `MYSQL_PASSWORD` | No | DB password |
| `CRON_SECRET` | No | Enables automatic cron jobs when set |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | No | OneSignal push notifications (browser SDK) |
| `ONESIGNAL_REST_API_KEY` | No | OneSignal REST API key (server-side push) |
| `ADSTERRA_API_KEY` | No | Adsterra stats API token |
| `CLOUDFLARE_API_TOKEN` | No | Cloudflare Workers AI (provider #2) — needs `CLOUDFLARE_ACCOUNT_ID` too |
| `CLOUDFLARE_ACCOUNT_ID` | No | Cloudflare account id (paired with the token above) |
| `MYSQL_CONNECTION_LIMIT` | No | DB pool size, clamped 6–20 (default 10) |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis cache endpoint (optional; cache-only) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis auth token |
| `NEXT_PUBLIC_SITE_URL` | No | Cron/notification callback base URL (defaults to localhost:5000) |
| `NEXT_PUBLIC_BASE_URL` | No | Canonical site URL for SEO (defaults to https://kruthika.fun) |
| `NEXT_PUBLIC_ENABLE_SCREENSHOT_PROTECTION` | No | Screenshot protection on/off |

> **Note:** `SESSION_SECRET` is legacy and no longer read by the codebase. OneSignal
> now uses `NEXT_PUBLIC_ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY`
> (previously `ONESIGNAL_API_KEY`). `INDEXNOW_KEY` is now a hardcoded constant
> in `src/lib/indexnow.ts` (no env var needed).

---

## Database

All SQL files are in the `database/` folder. Run them in order on a fresh install:

```bash
# Via MySQL CLI
mysql -u USER -p DATABASE < database/01_core_schema.sql
mysql -u USER -p DATABASE < database/02_blog_schema.sql
mysql -u USER -p DATABASE < database/03_voice_schema.sql
mysql -u USER -p DATABASE < database/04_migrations.sql
```

The app runs in **degraded mode** if MySQL is unreachable — chat works, user memory does not persist. The pool is configurable via `MYSQL_CONNECTION_LIMIT` (clamped 6–20, default **10**) with a **3 s connect timeout**, an **8 s query timeout** on every query, and a fail-fast breaker when the DB host is down (`src/lib/mysql-client.ts`) — see `database/README.md` for details.

---

## Blog System

The blog is managed via the Admin CMS at `/admin/blog`. Key details:

- Posts are stored in MySQL `blog_posts` table
- Content is stored as HTML (no markdown processing)
- Post rendering uses `src/components/blog/DbBlogPostContent.tsx` with Tailwind `prose` classes
- **Requires `@tailwindcss/typography`** — configured in `tailwind.config.ts`
- Word count and reading time are auto-calculated when content is included in a PUT request
- Related posts section is a generic link back to `/blog` (no hardcoded post links)

### Blog PUT API behavior (important)
`PUT /api/admin/blog/:id` only recalculates `word_count` and `reading_time_minutes` when `content` is included in the request body. Metadata-only updates (title, seo_description, etc.) do NOT touch word count.

---

## Documentation

| Document | Contents |
|---|---|
| `ARCHITECTURE.md` | Request pipeline, provider flow, architectural decisions |
| `LOCAL_SETUP.md` | Complete local development guide |
| `IMAGE_ASSETS_GUIDE.md` | Every public/ image asset + how to replace them |
| `docs/AI_SYSTEM.md` | AI architecture, brain pipeline, provider system |
| `docs/DEPLOYMENT.md` | Hostinger deployment guide |
| `docs/INTEGRATIONS.md` | OneSignal, ElevenLabs, Sarvam AI, Adsterra, Cloudflare Workers AI, Upstash Redis, AI providers |
| `docs/CRON.md` | Cron job schedule and manual trigger guide |
| `docs/BACKUP_RESTORE.md` | MySQL backup/restore scripts and quarterly procedure |
| `docs/SECURITY.md` | Proxy (CSP), rate limiting, admin auth |
| `database/README.md` | DB table index, named config keys, run order |
| `AUDIT_REPORT.md` | Full chat pipeline forensic audit (2026-08-07, point-in-time) |
| `SEO_AUDIT_2026.md` | SEO audit with all fix statuses (2026-08-06, point-in-time) |
| `docs/SEO_CHECKLIST_2026.md` | **Master SEO checklist & current state** (canonical host strategy, robots/sitemap/schema status, post-deploy steps) |

---

## For AI Agents

If you are an AI agent working on this codebase, read these files first in this order:

1. `README.md` (this file) — project overview
2. `docs/AI_SYSTEM.md` — how the AI brain works
3. `database/README.md` — DB schema and table index
4. `docs/SECURITY.md` — critical: security runs in `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`; it exports `proxy` + a `config.matcher`)
5. `SEO_AUDIT_2026.md` — SEO status and known remaining issues
6. `docs/CRON.md` — scheduled jobs and how to trigger them manually

**Staleness check:** This README was last verified on **2026-08-21**. If today's date is more than **30 days** later, re-scan `src/app/`, `src/lib/`, and `src/ai/` for structural changes and update accordingly. Route count: ~45 pages + ~61 API routes (Next 16.3.0 / Turbopack).
