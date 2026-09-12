# Kruthika.fun — Master SEO Checklist & Audit Record (2026)

> **Last updated:** 2026-08-21 · **Standard:** Google Search Central guidance (Dec 2025), Bing Webmaster Guidelines, AI-search (GEO/AEO) practice
> **AI Agent Note:** This is the canonical SEO state of the codebase. Every item below was verified against source on the date above. Re-verify any ✅ item before assuming it is still true if `src/app/`, `src/lib/`, or `next.config.js` changed after that date. Deployment target: **Hostinger Node.js, https://www.kruthika.fun** (set `NEXT_PUBLIC_BASE_URL=https://www.kruthika.fun` at deploy — see §1).

---

## 1. Canonical host & redirects

| Check | Status | Detail |
|---|---|---|
| Single canonical host strategy | ✅ FIXED | `src/proxy.ts` now 301s every non-canonical hostname to the host declared in `NEXT_PUBLIC_BASE_URL`. Deploying on `https://www.kruthika.fun` makes apex → www; deploying on apex makes www → apex. One env var controls everything (canonicals, sitemap, hreflang, OG all read it). |
| Dev/preview safety | ✅ | Redirect skips dev mode entirely, plus localhost / loopback / preview-tunnel hosts even in prod mode |
| http→https collapse | ✅ | Wrong-host redirects land directly on `https://<canonical>/path` — one hop, not two |
| Trailing-slash duplicates | ✅ pre-existing | `skipTrailingSlashRedirect` removed in `next.config.js`; Next 301s `/blog/` → `/blog`, matching sitemap/canonicals |
| Old blog slugs | ✅ pre-existing | 8 permanent redirects for renamed posts (`next.config.js redirects()`) |

## 2. Robots & crawling

| Check | Status | Detail |
|---|---|---|
| robots.txt (dynamic `src/app/robots.ts`) | ✅ | Per-bot rules: Googlebot, Googlebot-Image, GoogleOther, Bingbot(+crawl-delay), Applebot, DuckDuckBot, YandexBot, Amazonbot, OAI-SearchBot, ChatGPT-User, GPTBot, PerplexityBot, ClaudeBot |
| AI training crawlers blocked | ✅ | Google-Extended, anthropic-ai, Meta-ExternalAgent, cohere-ai, Applebot-Extended, CCBot, Bytespider — search/index crawlers stay allowed (GEO strategy) |
| Render resources never blocked | ✅ | `/_next/static/` explicitly allowed everywhere; only `/_next/data/` disallowed |
| Param URL crawl traps | ✅ FIXED | `/*?*ref=` added to catch-all block (was Googlebot-only); session/token params blocked everywhere |
| Admin/API/lite/diagnostics excluded | ✅ | In robots rules AND `X-Robots-Tag: noindex` headers AND per-route metadata (triple backstop) |
| Sitemap declared | ✅ | `<sitemap>` directive emitted |

## 3. Sitemap (`src/app/sitemap.ts`)

| Check | Status | Detail |
|---|---|---|
| Dynamic, DB-backed | ✅ | Posts, categories, authors (static+DB merged) pulled live; revalidate 300 s + instant `revalidatePath` on publish |
| Hreflang alternates | ✅ | Homepage/maya-chat carry full 12-country alternates from single source of truth (`COUNTRY_HREFLANG_MAP`); geo pages self-canonical with x-default→home |
| lastmod hygiene | ✅ | Emitted **only** when backed by a real timestamp (`validLastModified`) — no fake dates |
| Noindex pages excluded | ✅ | `/status`, admin, lite, diagnostics correctly absent |
| Priorities/changeFreq sensible | ✅ | Home 1.0 → maya-chat 0.98 → geo 0.83–0.92 → blog 0.85–0.92 → legal ≤0.45 |

## 4. Indexability & metadata (every page audited)

| Page(s) | Title/desc | Canonical | OG/Twitter | robots | Notes |
|---|---|---|---|---|---|
| `/` (home) | ✅ | ✅ via layout | ✅ webp+jpg | ✅ index | WebApplication+HowTo schemas scoped here |
| `/maya-chat` | ✅ | ✅ | ✅ | ✅ index | SSR'd H1 + intro copy for first-wave crawlers; SoftwareApplication + FAQPage + Breadcrumb schemas |
| 12 × geo pages | ✅ localized | ✅ self | ✅ custom OG (/in,/br,/id,/ng regional) | ✅ + max-image-preview/snippet | geo.region/ICBM meta, speakable, local FAQPage schema, city lists |
| `/blog` (+pagination) | ✅ | ✅ self-referencing per page | ✅ | ✅ | No rel=next/prev (deprecated by Google) ✓ |
| `/blog/[slug]` | ✅ seo_title override | ✅ + safe external-canonical validation | ✅ og_image fallback chain | ✅ honors CMS `noindex` flag | article:* metas via openGraph (duplicate `other` block removed 2026-08-21) |
| Category/author pages | ✅ dynamic | ✅ | ✅ | ✅ | generateStaticParams + revalidate |
| About/FAQ/Contact/Legal ×5 | ✅ | ✅ | ✅ | ✅ | /faq schema mirrors visible accordion content |
| /status, /lite/*, /diagnostics/*, /admin/*, /api/* | — | — | — | ✅ noindex | Metadata + X-Robots-Tag header backstop both present |
| 404 (`not-found.tsx`) | ✅ | — | — | ✅ noindex | Helpful links back |
| Root layout | ✅ template `%s \| Kruthika` | ✅ metadataBase | ✅ env-driven URLs (fixed 2026-08-21) | ✅ index/follow + googleBot directives | **`keywords` meta REMOVED** (Google-documented as unsupported — outdated practice removed 2026-08-21) |

## 5. Structured data (all server-rendered JSON-LD in initial HTML)

| Schema | Where | Status |
|---|---|---|
| Organization (stable `@id`, logo 512px, sameAs socials) | sitewide | ✅ |
| WebSite (stable `@id`, inLanguage list, speakable) | sitewide | ✅ SearchAction intentionally omitted until a real search endpoint exists (fake SearchAction = invalid SD) |
| WebApplication + HowTo | home + /maya-chat only (correctly scoped) | ✅ full step details; step text now env-driven |
| SoftwareApplication | /maya-chat | ✅ FIXED 2026-08-21: fresh `dateModified`, env-driven URLs, linked to Organization `@id` |
| BlogPosting @graph (+Person E-E-A-T author, Breadcrumbs, ImageObject, auto-FAQPage) | every DB post | ✅ single source of truth shared by public page + admin preview (`blog-jsonld.ts`) |
| FAQPage | /faq, /maya-chat, geo pages | ✅ mirrors visible content; fabricated ratings/mismatched sitewide FAQ already removed |
| SpeakableSpecification | sitewide + geo pages | ✅ AEO signal |

## 6. International / GEO — 22-country cluster

- ✅ **22 markets live**: IN, US, UK, CA, AU, BR(pt-BR), ID(id-ID), MY, PH, NG, PK, AE + **2026 expansion: DE, FR, IT, ES, MX, JP, KR, SA(ar-SA/RTL), TR, VN**
- ✅ hreflang cluster complete with return tags; `x-default` = homepage; single source of truth (`hreflang.ts` ← `locales.ts`)
- ✅ Every expansion page: native-language copy (DE/FR/IT/ES/MX/Japanese/Korean/Arabic/Turkish/Vietnamese), local city grids, local currency in SoftwareApplication offers (`EUR/JPY/KRW/SAR/MXN/TRY/VND`), localized FAQPage schema, geo.region/ICBM meta, speakable, Wikidata country entity-linking
- ✅ Shared `GeoPageTemplate` + `GeoCrossLinks` — new countries propagate to every page's cross-links automatically (old hardcoded lists were drifting)
- ✅ RTL: `/sa` renders `dir="rtl"` via script-base detection; hydration-safe
- ✅ Guarded by tests: `npm test` (geo-consistency suite) + `npm run test:geo` (117 checks; add `--url http://localhost:5000` for live crawl verification)
- ⚠️ Content task: regional OG art for the new markets (currently generic og-image fallback; /in,/br,/id,/ng already have custom art)

## 7. On-page quality

- ✅ Exactly one H1 per page (verified across all routes)
- ✅ Semantic HTML landmarks; breadcrumbs server-rendered and matching BreadcrumbList schema
- ✅ CMS-enforced image alt text; Next/Image optimization; WebP pipeline
- ✅ Titles ≈30–65 chars, descriptions ≈100–165 (runtime auditor on /diagnostics)
- ✅ Persona facts consistent everywhere public (23-year-old psychology student, Mumbai): prompt, FAQ, schema, llms.txt aligned 2026-08-21

## 8. AI-search readiness (GEO/AEO)

- ✅ `/llms.txt` dynamic (live posts, real timestamps, permissions section) — corrected 2026-08-21: false "SearchAction" claim removed; persona wording aligned
- ✅ Search-index AI bots allowed (OAI-SearchBot, PerplexityBot, ClaudeBot, Bingbot); training harvesters blocked
- ✅ Valid RSS feed for discovery surfaces
- ✅ Server-rendered content on every SEO-relevant page (no JS-only content)

## 9. Performance (Core Web Vitals proxies)

- ✅ next/font self-hosted fonts, display=swap; static assets immutable-cached; HTML stale-while-revalidate
- ✅ compress on, poweredByHeader off, prod console stripped, bundle analyzer wired
- ✅ MySQL 8 s query timeout + fail-fast breaker — slow DB can never hang SSR

## 10. Post-deploy checklist (once live on www.kruthika.fun)

1. Set `NEXT_PUBLIC_BASE_URL=https://www.kruthika.fun` (+ `NEXT_PUBLIC_SITE_URL`) in Hostinger env vars.
2. Verify `curl -I https://kruthika.fun/` → **301** to `https://www.kruthika.fun/`.
3. Verify `https://www.kruthika.fun/robots.txt` and `/sitemap.xml` render with www URLs.
4. Google Search Console: add Domain property, submit the www sitemap.
5. Bing Webmaster Tools: import from GSC or add sitemap.
6. Rich Results Test on `/`, `/maya-chat`, one blog post, one geo page, `/faq`.
7. Lighthouse SEO audit (expect ~100).
8. Confirm og:image previews via LinkedIn/Facebook/X debuggers.

---

*Verified against source: 2026-08-21. Re-audit trigger: changes to `src/proxy.ts`, `layout.tsx`, `sitemap.ts`, `robots.ts`, `hreflang.ts`, `StructuredData.tsx`, `next.config.js`, or route additions/removals.*

---

## 11. Responsiveness & Accessibility (WCAG 2.1 AA) � audited 2026-08-21

**Scanner:** ``node scripts/_a11y-audit.mjs`` (256 initial findings ? all resolved or dispositioned).

### Global foundation (src/app/globals.css)
- ? :focus-visible ring on every interactive element (WCAG 2.4.7)
- ? Enhanced prefers-reduced-motion (animations + transitions + scroll-behavior)
- ? Overflow guards: html,body{overflow-x:clip} + overflow-wrap:break-word on text elements
- ? .safe-top/.safe-bottom env(safe-area-inset-*) helpers � .tap-target hit-area expander
- ? .table-responsive wrapper utility � fluid hero H1 clamps =400px
- ? Skip-to-content link verified in root layout body

### Fixed across files
- Modal backdrops ? role="presentation" (BlogEditor �5, BlogPreview, admin/blog �2)
- Clickable divs ? role="button"+tabIndex+onKeyDown (ChatHeader name plate, admin/tags rows)
- target="_blank" ? rel="noopener noreferrer" everywhere (12 duplicate tags deduped)
- Non-collapsing grids ? grid-cols-2 md:grid-cols-N (ProfileEditor �4, NotificationsTab)
- Fixed-width overflow risks ? max-w-full guards (toast, ErrorBoundary, MessageBubble �3,
  ProfileEditor, MediaLibrary, NotificationsTab, blog filters, article cards, previews).
  Ad slots intentionally exempt � IAB creative sizes must stay exact.
- maya-chat SSR intro copy bumped to readable sizes on mobile

### Dispositioned (verified non-issues)
- min-w-[116px] tab triggers live inside an overflow-x-auto strip ?
- Analytics/legal tables already had overflow wrappers ?
- Dense admin text-[10px]/[11px] labels kept (dashboard convention, AA contrast held);
  user-facing copy is =12px
- "img-no-alt" hits were regex-string contexts; the CMS enforces alt at authoring

Re-run: node scripts/_a11y-audit.mjs � expect only dispositioned categories.

---

## 12. CMS SEO-fields modernisation (2026-08-21)

- ? Removed outdated Primary-keywords input from BlogEditor. Google (Search Central,
   Dec 2025): meta-keywords has no effect on indexing/ranking; Bing calls it a spam
   signal; Yoast deleted the feature in v6.3.
- ? Long-tail field relabelled Target keywords & article tags (internal guidance;
   powers article:tag OG metas & JSON-LD).
- ? Fixed silent data loss: og_title / og_description / twitter_title /
   twitter_description editor inputs existed but were never persisted on update
   ([id] PUT destructure) nor sent by the save payload. Both now wired end-to-end
   and honoured by the public article page (OG/Twitter fall back to SEO fields).
- ? JSON-LD preview payload kept type-clean (JsonLdPostInput untouched).
