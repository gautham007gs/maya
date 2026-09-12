# AI System Architecture — Kruthika AI

> **Last updated:** 2026-08-21
> **Next re-scan trigger:** update this file whenever files in `src/ai/` or `src/lib/brain/` change significantly. Key signal: if `src/ai/chat.ts` is modified, re-read it and update the "Brain pipeline" section.
> **AI Agent Note:** This is the primary reference for understanding how the AI chat system works. Read this before touching any file in `src/ai/` or `src/lib/brain/`. The brain pipeline section describes data flow from user message → AI response.
>
> **Migration note (2026-08):** The old orchestrator `src/lib/brain/simulation-engine.ts` was **removed**. Its responsibilities moved to `src/ai/chat.ts` (`generateResponse`, `buildConversationPayload`) + `src/ai/prompt.ts` (`buildSystemPrompt`) + `src/ai/response-cleanup.ts` (`cleanLLMResponse`, `splitResponseIntoBubbles`).

---

## System Overview

Kruthika AI is a simulated AI companion (persona: Kruthika, a 23-year-old psychology student from Mumbai). The AI uses a multi-layer brain pipeline to produce natural, contextually aware, emotionally consistent responses.

```
User message
    │
    ▼
[src/app/api/chat/route.ts]  (or Server Actions → src/app/maya-chat/actions.ts)
    │  load user memory, session data, analytics
    ▼
[src/ai/flows/emotional-state-simulation.ts]  ← per-message emotion pre-pass
    │
    ▼
[src/ai/chat.ts]  ← orchestrator (generateResponse)
    │
    ├─ [src/lib/brain/evaluators.ts]     classify message (intent, safety, language, prompt injection)
    ├─ [src/ai/user-classifier.ts]       classify user (stage, session depth, personality)
    ├─ [src/ai/kruthika-day-state.ts]    compute Kruthika's time-of-day emotional state
    ├─ [src/ai/kruthika-hormones.ts]     compute hormonal cycle phase (fixed calendar)
    ├─ [src/lib/brain/media-server.ts]   decide if Kruthika should share an image
    ├─ [src/lib/brain/voice-server.ts]   decide if Kruthika should send a voice note
    │
    ▼
[src/ai/multi-provider.ts]  ← AI call
    │  tries providers in PROVIDER_ORDER (Gemini first — see below)
    │  falls back automatically on rate-limit / error
    ▼
[src/ai/response-cleanup.ts — post-processing]
    │  cleanLLMResponse() + splitResponseIntoBubbles()
    ▼
Response sent to client
```

---

## File Reference

### Core Brain (`src/lib/brain/`)

| File | Purpose |
|---|---|
| `evaluators.ts` | Message classification: intent, safety, language detection, prompt injection detection |
| `constants.ts` | Static regex pools used by evaluators |
| `types.ts` | TypeScript types for the brain system |
| `media-server.ts` | Decides when to attach images; reads `ai_media_assets_config_v1` from DB |
| `voice-server.ts` | Decides when to attach voice notes; reads voice settings from DB |

### AI Modules (`src/ai/`)

| File | Purpose |
|---|---|
| `chat.ts` | **Orchestrator** — builds the prompt, conversation payload, calls multi-provider, cleans response. Main entry: `generateResponse()` |
| `multi-provider.ts` | Main multi-provider fallback engine (`generateFromMessages`, `PROVIDER_ORDER`, per-provider callers) |
| `prompt.ts` | System prompt builder (`buildSystemPrompt`) — the single source of prompt content |
| `response-cleanup.ts` | `cleanLLMResponse()` + `splitResponseIntoBubbles()` — applied after every LLM call |
| `user-classifier.ts` | Classifies users into stages (new, engaged, invested, at-risk) |
| `kruthika-day-state.ts` | Time-of-day emotional state (morning energy, evening calm, etc.) |
| `kruthika-hormones.ts` | Fixed hormonal cycle simulation (28-day calendar-based) |
| `vertex-ai.ts` | Backward-compat shim re-exporting from multi-provider |
| `flows/emotional-state-simulation.ts` | Per-message emotion pre-pass; also used directly by `/api/chat` |
| `flows/proactive-messaging.ts` | Proactive outreach decision logic (shouldSendProactiveMessage) |
| `flows/proactive-messaging-actions.ts` | Proactive outreach execution — generates + sends the message |
| `flows/offline-message-generation.ts` | Comeback/offline message generation (Indian-girl texting style) |
| `flows/conversation-memory.ts` | Client-side conversation-context tracking (topics, relationship level) — UI-only, not the DB memory table |
| `flows/realistic-behaviors.ts` | Typing delays, bubble-splitting realism knobs |
| `flows/voice-trigger.ts` | Decides when a proactive message should include a voice note |

> **Note:** `kruthika-neurotransmitters.ts` and `texting-psychology.ts` no longer exist — their behavior was folded into `kruthika-day-state.ts` / `kruthika-hormones.ts` and the system prompt.

---

## Provider System

### PROVIDER_ORDER — default (runtime order is admin-rankable)

```ts
// src/ai/multi-provider.ts
export const PROVIDER_ORDER: AIProvider[] = [
  'openrouter', 'gemini', 'cloudflare', 'groq', 'cerebras', 'sambanova',
  'github', 'nvidia', 'mistral', 'cohere', 'deepseek',
];
```

OpenRouter leads the default cascade and its internal model list starts with **`google/gemma-4-31b-it:free`**, followed by Gemma 4 26B, MiniMax M3, Ling 3.0 Flash, GLM 5.2, and lower-ranked agent/reasoning fallbacks. The **runtime** order is dynamic: ranks stored in `provider_priority_v1` (set from Admin → AI Models) are applied on every request via `getDynamicProviderOrder()` — ranked providers run first ascending, unranked providers keep this default sequence after them. Reasoning-capable OpenRouter models receive reasoning exclusion/off controls, and visible planning leaks are rejected so the cascade can continue.

Gemini-first is the default for quality/multilingual, but the runtime order follows the admin's rank assignments (see above). Within each provider, keys are tried lowest-priority-first (DB sorted by `priority` ASC). Cloudflare Workers AI (10,000 neurons/day free tier — Qwen 2.5 72B, strong multilingual) needs both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, stored combined as `token:::accountId` in the `api_keys` table. Paid-only providers (deepseek) are last as final overflow.

**Removed providers** (fully paid, no free tier — do not re-add without a free tier): `openai`, `claude` (Anthropic), `grok` (xAI), `together`, `perplexity`.

### Gemini-specific notes (2026-08)

- Model cascade (via `@google/genai` SDK, v1beta): `gemini-flash-latest` → 3.6-Flash → 3.5-Flash → 3.5-Flash-Lite (2.0/2.5 models are gone from v1beta)
- Requires `maxTokens: 600` (not 450)
- No `thinkingConfig` support

### Multi-bubble splitting

AI responses are split into multiple chat bubbles before sending (`splitResponseIntoBubbles` in `response-cleanup.ts`):

- Splits at 40 characters (not 60), at clause boundaries
- Each bubble trimmed to 90 characters max
- Image and text separated into distinct bubbles
- Image cooldown: 45 min, 6%/3% random drop, 1 per 25 server turns

---

## System Prompt Architecture

The system prompt is built ONCE per request in `buildSystemPrompt()` in `src/ai/prompt.ts` (called by `chat.ts`). It contains:

1. **Persona definition** — Kruthika's name, age, city, personality traits
2. **Day state** — time-of-day emotional tone
3. **Hormonal state** — cycle phase influencing emotional intensity
4. **User memory** — extracted name, relationship stage, key facts about the user
5. **Language instructions** — detected language with code-switching guidance
6. **Safety rules** — forbidden phrases and behaviors
7. **Texting style** — response length, emoji use, attachment pattern for this session

### Invariants

| Invariant | Where enforced |
|-----------|----------------|
| System message appears exactly once, at index 0 | `buildConversationPayload()` |
| User message appears exactly once, always last | `buildConversationPayload()` |
| History is chronological, max 20 turns | `buildConversationPayload()` |
| Cleanup applied exactly once | `cleanLLMResponse()` in `response-cleanup.ts` |
| System prompt built exactly once | `buildSystemPrompt()` in `prompt.ts` |
| No provider modifies prompts | All providers receive identical payload |

---

## Memory System

User memory is stored as a plain text string in the `kruthika_user_memory` table (runtime-created by `/api/memory`), keyed by `session_id`. The string is parsed by `parseMemoryContext()` in `src/ai/chat.ts` at the start of each request.

Format (stored as text):
```
name: Arjun | stage: invested | lang: hinglish | facts: loves cricket, works at TCS
```

Memory is persisted via `POST /api/memory` — the client saves it every ~10 messages and loads it on mount (`src/app/maya-chat/actions.ts`). Note: `src/ai/flows/conversation-memory.ts` is a **client-side** conversation-context utility (UI-only), unrelated to the DB memory table.

---

## Proactive Messaging

Cron job at `/api/cron/proactive` (requires `CRON_SECRET` env var):
- Triggered by the **external cron provider** (Hostinger cron) — 2 daily waves: IST 08:00 and 19:00 (see `docs/CRON.md`). No in-process scheduler.
- Targets users via OneSignal `external_id` aliases (batched, no per-user delay)
- Calls `src/ai/flows/proactive-messaging-actions.ts`
- Generates a message from Kruthika's persona without user history
- Optionally includes a voice note (`flows/voice-trigger.ts`)
- Delivered via OneSignal push notification

Re-engagement flow at `/api/cron/reengagement` uses **static segment templates** (warm/cooling/dormant/at_risk/lost) — no LLM call.

See `docs/CRON.md` for the full cron architecture.
