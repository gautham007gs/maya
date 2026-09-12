# Kruthika AI — Architecture

*Last updated: 2026-08-21*

## Request Pipeline

```
User (WhatsApp-style UI)
        │
        ▼
src/app/maya-chat/actions.ts ────────────── Server Action entry
  • Busy / ignore gate (shouldAIBeBusyServerSafe → resolveIgnoreGate;
    globally bypassable via Admin → AI Replies toggle, ai_ignore_settings)
  • Passes message + history untouched to chat.ts orchestrator
        │
        ▼
src/ai/chat.ts ──────────────────────────── Orchestrator (single source of truth)
  • buildSystemPrompt()      — ONE system prompt, no competing directives
  • buildConversationPayload() — builds ChatMessage[] ONCE (system+history+user)
  • generateResponse()       — hands ChatMessage[] to multi-provider engine
  • cleanLLMResponse()       — strips quotes and markdown artifacts only
  • splitResponseIntoBubbles() — splits response into multiple chat bubbles
        │
        ▼
src/ai/multi-provider.ts ────────────────── Fallback engine
  • generateFromMessages()   — iterates PROVIDER_ORDER with key rotation
  • callProvider()           — dispatches to the right provider function
        │
        ├─► callGemini()      → Gemini API (primary — drains Gemini keys/models first)
        ├─► callCloudflare()  → Cloudflare Workers AI (@cf/qwen/qwen2.5-72b-instruct, 10k neurons/day free)
        ├─► callGroq()        → callOpenAICompat() → Groq API
        ├─► callCerebras()    → callOpenAICompat() → Cerebras API
        ├─► callSambaNova()   → callOpenAICompat() → SambaNova API
        ├─► callGithub()      → callOpenAICompat() → GitHub Models API
        ├─► callOpenRouter()  → OpenRouter API
        ├─► callNvidia()      → NVIDIA NIM API
        ├─► callMistral()     → callOpenAICompat() → Mistral API
        ├─► callCohere()      → Cohere v2 API
        ├─► callDeepSeek()    → callOpenAICompat() → DeepSeek API
        │
        ▼
  raw LLM text
        │
        ▼
chat.ts (continued)
  • cleanLLMResponse()          — strips quotes and markdown artifacts only
        │
        ▼
  cleaned response → actions.ts → UI
```

> **Provider order (2026-08-21):** default `PROVIDER_ORDER` starts **openrouter (ox-alpha ⭐) → gemini → cloudflare → groq → … → deepseek** (see source). The runtime cascade is **admin-manageable**: ranks in `provider_priority_v1` (Admin → AI Models dropdowns) reorder providers dynamically per request, with conflict-free swap semantics. OpenAI, Claude, Grok, Together, and Perplexity remain removed (no free tier).

## Invariants

| Invariant | Where enforced |
|-----------|----------------|
| system message appears exactly once (index 0) | `buildConversationPayload()` |
| user message appears exactly once (always last) | `buildConversationPayload()` |
| history is chronological | `buildConversationPayload()` (slice -20, insertion order) |
| messages[] never mutated after construction | all providers receive it by value, log it, pass it to API unchanged |
| Gemini format conversion is content-preserving | `callGemini()` maps role/content verbatim; only role names change |
| cleanup is applied exactly once | `cleanLLMResponse()` in `response-cleanup.ts`; proactive/offline flows use same function |
| system prompt built exactly once | `buildSystemPrompt()` in `prompt.ts` |
| no hidden prompt generation | `prompt.ts` is the only builder; no provider adds instructions |

## Alternate Entry Points

```
/api/chat (HTTP POST)
  └─► Same brain pipeline — route.ts calls generateResponse() (via flows/emotional-state-simulation.ts)
      Difference: XSS sanitization on input (documented in AUDIT_REPORT.md)

/api/cron/proactive
  └─► ai/flows/proactive-messaging-actions.ts → same multi-provider engine
      No history, no memory context; standalone persona message

/api/cron/reengagement
  └─► route.ts uses static WAVE_MESSAGES templates (no LLM call)
      Segment-based: warm / cooling / dormant / at_risk / lost → OneSignal push
```

## Blog System Architecture

```
Admin CMS (/admin/blog)
  └─► PUT /api/admin/blog/:id
        • Validates + sanitizes fields
        • Only recalculates word_count when content is in payload
        • Stores raw HTML in blog_posts.content
        │
        ▼
  blog_posts table (MySQL)
        │
        ▼
  GET /blog/[slug]
  └─► src/app/blog/[slug]/page.tsx (Server Component)
        • Fetches post from DB via getPublishedPostBySlug()
        • Renders DbBlogPostContent client component
        │
        ▼
  src/components/blog/DbBlogPostContent.tsx (Client Component)
        • Splits content into segments for ad injection
        • Renders each segment with dangerouslySetInnerHTML
        • Uses PROSE = 'prose prose-lg ...' (requires @tailwindcss/typography)
        • Blockquotes styled as callout cards
        • Tables styled with borders and alternating rows
        • HR tags styled as section dividers between ranked items
```

## Key Architectural Decisions

| Decision | Reason |
|----------|--------|
| Single `proxy.ts` for all security | Next.js 16 renamed `middleware.ts` → `proxy.ts`. It must be named `proxy.ts` at `src/` and export `proxy` + `config.matcher`; any other name is silently ignored |
| Provider order starts with Gemini | Gemini-first, all keys/models drained before next provider (Cloudflare Workers AI #2). See `PROVIDER_ORDER` in `multi-provider.ts` |
| MySQL pool: configurable limit + 8 s query timeout + fail-fast breaker | A stalled DB query must never hang an SSR page (Lighthouse `PAGE_HUNG` class of bugs). Pool resets after 5 consecutive errors; unreachable host fails fast for 5 s |
| Blog content as raw HTML (not markdown) | CMS writes HTML directly; no markdown pipeline needed |
| `@tailwindcss/typography` for blog prose | Required for all `prose-*` classes to work; added July 30 2026 |
| `word_count` only recalculated with content | Prevents zeroing on metadata-only PUT requests |
| Session cookies (HMAC) not JWT | Simpler, no token refresh, controlled expiry |
| Redis = cache only, never rate limiting | Protects the Upstash free-tier command budget (500K/month); rate limiting is in-memory → MySQL |
| DB-less degraded mode | Chat works without MySQL; only memory/persistence fails |
| Footer excluded on app surfaces | `/admin`, `/`, `/maya-chat`, `/status` render no footer (driven by `x-pathname` header in `proxy.ts` → `showFooter` in root layout) |

## Frontend Design System

- **Framework:** Next.js 16.3.0 App Router (Server + Client Components, Turbopack)
- **Styling:** Tailwind CSS v3 + shadcn/ui + `@tailwindcss/typography`
- **Typography plugin config:** `tailwind.config.ts` → `plugins: [animate, typography]`
- **Blog prose:** `PROSE` constant in `DbBlogPostContent.tsx` — comprehensive set of `prose-*` modifiers
- **Theme tokens:** CSS variables in `globals.css` mapped to Tailwind via `tailwind.config.ts`

## Security Layers

See `docs/SECURITY.md` for details. Summary:

```
Every request:
  proxy.ts → CSP nonce + rate limit + DDoS check + admin auth + security headers
             (sets x-nonce, x-pathname, x-html-lang, x-ui-lang, x-country request headers)

API routes (/api/chat):
  • Prompt injection detection (evaluators.ts)
  • XSS sanitization on input
  • Rate limiting per IP

Admin routes (/admin/*):
  • HMAC-SHA256 session cookie verification
  • Redirects to /admin/login on invalid session
```
