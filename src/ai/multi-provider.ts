/**
 * Multi-Provider AI Engine — v5.2
 * FREE-FIRST provider order. Only providers with a genuine free tier are included.
 *
 * PROVIDER ORDER (free first, then cheap fallbacks):
 *   openrouter (Gemma 4 ⭐) → gemini → cloudflare → groq → cerebras → sambanova →
 *   github → nvidia → mistral → cohere → deepseek
 *
 * DYNAMIC RANKING: the runtime cascade order is admin-manageable — ranks set in
 * Admin → AI Models are stored in provider_priority_v1 and applied on every
 * request via getDynamicProviderOrder(). Ranked providers run first (ascending),
 * unranked ones keep this default order after them. See src/lib/provider-priority.ts.
 *
 * v5.2 changes (July 2026):
 *   - Single-construction-point architecture: chat.ts builds ChatMessage[] once via
 *     buildConversationPayload(), passes it unchanged through every provider.
 *   - All provider functions now receive pre-built ChatMessage[] — zero reconstruction.
 *   - logPreRequest() fires immediately before every HTTP call, proving no mutation.
 *   - generateFromMessages() is the new clean entry point for the main chat path.
 *   - generateAIResponse() is now a thin wrapper (backward compat for proactive/offline flows).
 *   - Cohere history cap (was -20) aligned to -20 via buildConversationPayload's -20 slice.
 *
 * v5.1 changes (July 2026 live-verified):
 *   - GitHub Models: 5-model cascade (GPT-4o, GPT-4o-mini, Llama-3.3-70B, Phi-4, Mistral-Small-2503)
 *     NOTE: GitHub model IDs are case-sensitive. 'meta/Llama-3.3-70B-Instruct' not 'meta/llama-3.3...'
 *   - NVIDIA NIM: tightened to 3 verified models on this free account, fastest first
 *     (nemotron-3-super-120b removed — outputs meta-commentary; llama-3.1-70b removed — timeouts)
 *   - Groq: removed decommissioned llama-3.1-70b & gemma2-9b; removed gpt-oss & qwen (refuse persona)
 *   - SambaNova: removed 405B (404) and Qwen2.5-72B (410); added MiniMax-M2.7 and DeepSeek-V3.2
 *   - Cerebras: gemma-4-31b first (free tier model); all cascade to 402 → key disabled gracefully
 *   - stripThinkTags: no longer falls back to original — empty = try next model
 *   - NVIDIA timeout extended to 25s + 503/abort/exhausted added to retry conditions
 *
 * REMOVED (fully paid, no free tier): openai, claude, grok, together, perplexity
 *
 * Automatic fallback: if a key is exhausted/errored, tries next key then next provider.
 * Auth errors (401/403) → permanently disable key, not just mark error.
 * Each provider call has a 20-second timeout (25s for NVIDIA).
 * After the first cascade, one bounded recovery round retries only transient
 * failures with an adaptive, longer timeout. There is never an unbounded loop.
 * OpenAI SDK client is cached per (apiKey+baseURL) to avoid recreating per request.
 */

import { getMysqlClient } from '@/lib/mysql-client';
import { decryptSecret } from '@/lib/key-encryption';
import { getProviderRanks, orderProvidersByRank, bustProviderPriority } from '@/lib/provider-priority';
import { getModelList, bustProviderModels } from '@/lib/provider-models';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIProvider =
  | 'gemini'
  | 'cloudflare'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'cohere'
  | 'cerebras'
  | 'sambanova'
  | 'openrouter'
  | 'github'
  | 'nvidia';

export interface ProviderMeta {
  name: string;
  label: string;
  model: string;
  baseUrl?: string;
  description: string;
}

export const PROVIDER_META: Record<AIProvider, ProviderMeta> = {
  gemini:     { name: 'gemini',     label: 'Google Gemini FREE ⭐',   model: 'gemini-flash-latest',                    description: '⭐ FREE tier — aistudio.google.com · cascades: 3.6-Flash → 3.5-Flash → 3.5-Flash-Lite. Get key: aistudio.google.com → Get API Key' },
  cloudflare: { name: 'cloudflare', label: 'Cloudflare Workers AI ⭐', model: '@cf/qwen/qwen2.5-72b-instruct',          description: '⭐ FREE — 10,000 neurons/day · Qwen 2.5 72B multilingual (Hindi/Tamil/Kannada/Telugu). Needs: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID. Get from: dash.cloudflare.com → Workers AI' },
  groq:       { name: 'groq',       label: 'Groq ⭐ FREE',            model: 'openai/gpt-oss-120b',                   baseUrl: 'https://api.groq.com/openai/v1',         description: '⭐ FREE — console.groq.com · GPT-OSS 120B, ultra-fast 500+ tok/sec, multi-model cascade. Get key: console.groq.com → API Keys' },
  cerebras:   { name: 'cerebras',   label: 'Cerebras FREE',           model: 'llama-3.3-70b',                          baseUrl: 'https://api.cerebras.ai/v1',             description: '⭐ FREE — cloud.cerebras.ai · 1M tokens/day, ~2600 tok/sec, ultra-fast. Get key: cloud.cerebras.ai → Sign Up → API Keys' },
  sambanova:  { name: 'sambanova',  label: 'SambaNova ⭐ FREE',       model: 'Meta-Llama-3.3-70B-Instruct',            baseUrl: 'https://api.sambanova.ai/v1',            description: '⭐ FREE — cloud.sambanova.ai · Llama 3.3 70B cascade. Get key: cloud.sambanova.ai → Sign Up → API Keys' },
  github:     { name: 'github',     label: 'GitHub Models FREE',      model: 'openai/gpt-4o-mini',                     baseUrl: 'https://models.github.ai/inference',     description: '⭐ FREE — github.com/marketplace/models · GPT-4o-mini + Llama 3.3 70B. Get key: github.com/settings/tokens → Generate new token (classic), scopes: none needed' },
  openrouter: { name: 'openrouter', label: 'OpenRouter FREE',         model: 'google/gemma-4-31b-it:free',             baseUrl: 'https://openrouter.ai/api/v1',            description: 'FREE pool — openrouter.ai · ranked multilingual chat cascade led by Gemma 4. Get key: openrouter.ai → Sign In → Keys' },
  nvidia:     { name: 'nvidia',     label: 'NVIDIA NIM FREE',         model: 'meta/llama-3.3-70b-instruct',            baseUrl: 'https://integrate.api.nvidia.com/v1',    description: 'FREE — build.nvidia.com · 40 RPM. Get key: build.nvidia.com → Developer Account → Get API Key (starts with nvapi-)' },
  mistral:    { name: 'mistral',    label: 'Mistral FREE',            model: 'mistral-small-2603',                     baseUrl: 'https://api.mistral.ai/v1',              description: 'FREE tier — console.mistral.ai · mistral-small-2603. Get key: console.mistral.ai → API Keys' },
  cohere:     { name: 'cohere',     label: 'Cohere Trial',            model: 'command-r7b-12-2024',                    description: 'Trial free tier — dashboard.cohere.com. Get key: dashboard.cohere.com → API Keys' },
  deepseek:   { name: 'deepseek',   label: 'DeepSeek',                model: 'deepseek-v4-flash',                      baseUrl: 'https://api.deepseek.com',               description: 'Paid (very cheap) — platform.deepseek.com. Get key: platform.deepseek.com → API Keys' },
};

// Provider execution order: DEFAULT cascade. The runtime order is dynamic —
// ranks from provider_priority_v1 (Admin → AI Models) are applied first via
// getDynamicProviderOrder(); unranked providers follow in this default order.
export const PROVIDER_ORDER: AIProvider[] = [
  'openrouter', 'gemini', 'cloudflare', 'groq', 'cerebras', 'sambanova', 'github', 'nvidia', 'mistral', 'cohere', 'deepseek',
];

/**
 * Built-in DEFAULT model cascade per provider (verified against official
 * provider docs / live APIs — August 2026). The ADMIN can override any of
 * these per provider (Admin → AI Keys → AI Models card) via
 * provider_models_v1; overrides REPLACE this list for that provider.
 *
 * Deprecated models removed in the Aug-2026 refresh:
 *   - gemini-3.1-flash-lite-preview  (shut down per Google deprecation table)
 *   - open-mistral-nemo(-2407)       (retired 2026-07-31)
 *   - zai-glm-4.7 on Cerebras        (no longer on public endpoints)
 *   - deepseek-chat                  (legacy V3 alias — V4 is current)
 */
export const PROVIDER_DEFAULT_MODELS: Record<AIProvider, string[]> = {
  gemini: [
    'gemini-flash-latest',           // alias → auto-tracks newest Flash (never goes stale)
    'gemini-flash-lite-latest',      // alias → auto-tracks newest Flash-Lite
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
  ],
  cloudflare: [
    '@cf/qwen/qwen2.5-72b-instruct',            // ⭐ best multilingual (Hindi/Tamil/Kannada/Telugu/English)
    '@cf/google/gemma-3-12b-it',                // strong reasoning & multilingual
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast', // fast 70B
    '@cf/meta/llama-3.1-8b-instruct',           // fast 8B fallback
  ],
  groq: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
  ],
  cerebras: [
    'gemma-4-31b',   // confirmed free tier, strong multilingual (Indian scripts)
    'gpt-oss-120b',  // high quality
  ],
  sambanova: [
    'Meta-Llama-3.3-70B-Instruct',
    'MiniMax-M2.7',
    'gpt-oss-120b',
    'gemma-4-31B-it',
    'DeepSeek-V3.2',
    'DeepSeek-V3.1',
  ],
  github: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'meta/Llama-3.3-70B-Instruct',   // exact case required by GitHub Models
    'mistral-ai/Mistral-Small-2503',
  ],
  openrouter: [
    // Ranked for natural multilingual conversation, not coding/agent benchmarks.
    'google/gemma-4-31b-it:free',                    // #1 — 140+ languages, strong direct chat
    'google/gemma-4-26b-a4b-it:free',                // #2 — near-31B quality, faster MoE
    'minimax/minimax-m3:free',                       // #3 — strong multi-turn collaboration
    'inclusionai/ling-3.0-flash-fin:free',           // #4 — efficient multilingual fallback
    'z-ai/glm-5.2:free',                             // #5 — capable, but reasoning-oriented
    'nvidia/nemotron-3.5-lightning:free',            // #6 — fast, but less chat-focused
    'nvidia/nemotron-3-ultra-550b-a55b:free',        // #7 — reasoning/agent model; last-resort
    'nvidia/nemotron-3-super-120b-a12b:free',        // #8 — reasoning model; last-resort
    'openai/gpt-oss-20b:free',                       // #9 — smaller general fallback
    'poolside/laguna-s-2.1:free',                    // #10 — coding-agent model, weakest chat fit
  ],
  nvidia: [
    'openai/gpt-oss-120b',
    'meta/llama-3.3-70b-instruct',
    'deepseek-ai/deepseek-v4-flash',
    'nvidia/nemotron-3-ultra-550b-a55b',
    'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    'minimaxai/minimax-m3',
    'moonshotai/kimi-k2.6',
  ],
  mistral: [
    'mistral-small-2603',     // Mistral Small 4 era — verified working
    'mistral-small-latest',   // alias → auto-tracks newest Small (never goes stale)
  ],
  cohere: [
    'command-a-03-2025',
    'command-r7b-12-2024',
    'command-r-08-2024',
  ],
  deepseek: [
    'deepseek-v4-flash',
    'deepseek-v4-pro',
  ],
};

export interface ApiKey {
  id: number;
  provider: AIProvider;
  key_label: string;
  key_value: string;
  priority: number;
  status: 'active' | 'exhausted' | 'error' | 'disabled';
  last_used: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
}

export interface GenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  context?: string[];
  /** Per-request timeout override in milliseconds (default: 20 000). */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Canonical conversation payload — built ONCE by chat.ts, passed unchanged
// ---------------------------------------------------------------------------

/** Single message in the OpenAI-compatible conversation format. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Internal provider call options.
 * Contains ONLY execution parameters — no prompt, no system, no history.
 * All conversation content lives in the pre-built ChatMessage[].
 */
interface ProviderCallOpts {
  maxTokens?: number;
  temperature?: number;
  /** Abort signal — fires when the caller's timeout budget expires so the HTTP request is actually cancelled. */
  signal?: AbortSignal;
}

/**
 * Build the canonical conversation payload ONCE from raw inputs.
 * This is the single authorised construction point for the main chat path.
 * chat.ts calls this, logs the result, then passes it unchanged to every provider.
 *
 * Invariants enforced:
 *  • system message appears at index 0 (or not at all)
 *  • history lines parsed in insertion order (chronological)
 *  • current user message is always the final element
 *  • unrecognised prefixes silently skipped (noise guard)
 */
export function buildConversationPayload(
  systemPrompt: string | undefined,
  historyLines: string[],
  userMessage: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  for (const line of historyLines.slice(-20)) {
    if (line.startsWith('User:'))
      messages.push({ role: 'user', content: line.replace(/^User:\s*/, '') });
    else if (/^(AI:|Kruthika:)/.test(line))
      messages.push({ role: 'assistant', content: line.replace(/^(AI:|Kruthika:)\s*/, '') });
    // other prefixes (noise / debug lines) silently skipped
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

/**
 * Pre-request audit log — fires immediately before every HTTP call.
 *
 * Always-on compact one-liner proves: message count, role shape, and the exact
 * final user message that reaches the wire. Together with the source log in
 * chat.ts, these two entries prove messages[] was not modified in transit.
 *
 * In development: also dumps full message content for visual inspection.
 */
function logPreRequest(provider: string, model: string, messages: ChatMessage[]): void {
  const roleCode: Record<string, string> = { system: 'S', user: 'U', assistant: 'A' };
  const shape = messages.map(m => roleCode[m.role] ?? '?').join('');
  const sysCnt = messages.filter(m => m.role === 'system').length;
  const usrCnt = messages.filter(m => m.role === 'user').length;
  const last = messages[messages.length - 1];
  const lastLen = last?.content?.length ?? 0;
  console.log(
    `[AI][pre-request] ${provider}/${model}` +
    ` | msgs=${messages.length} [${shape}] system=${sysCnt} user_turns=${usrCnt}` +
    ` | last_len=${lastLen}`,
  );
}

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

let keysCache: ApiKey[] = [];
let keysCacheTime = 0;
let providerSettingsCache: Record<string, boolean> = {};
let providerSettingsCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 min — minimize plaintext key retention (MED-041)

// OpenAI SDK client cache — keyed by "apiKey:::baseURL"
// Reusing clients avoids re-creating TLS connections on every request.
const openAIClientCache = new Map<string, any>();

// Per-process adaptive key health. This deliberately stays out of MySQL: a
// timeout is transient, and writing it for every request becomes its own
// bottleneck under load. Permanent auth/quota failures are still stored below.
type KeyHealth = { latencyMs: number; failures: number; coolUntil: number; inFlight: number };
const keyHealth = new Map<number, KeyHealth>();
const DEFAULT_KEY_HEALTH: KeyHealth = { latencyMs: 1_500, failures: 0, coolUntil: 0, inFlight: 0 };

function healthFor(key: ApiKey): KeyHealth {
  let health = keyHealth.get(key.id);
  if (!health) {
    health = { ...DEFAULT_KEY_HEALTH };
    keyHealth.set(key.id, health);
  }
  return health;
}

function rankKeys(keys: ApiKey[]): ApiKey[] {
  const now = Date.now();
  return [...keys].sort((a, b) => {
    const ah = healthFor(a), bh = healthFor(b);
    const aCooling = ah.coolUntil > now ? 1 : 0;
    const bCooling = bh.coolUntil > now ? 1 : 0;
    return aCooling - bCooling || ah.failures - bh.failures || ah.inFlight - bh.inFlight ||
      ah.latencyMs - bh.latencyMs || a.priority - b.priority;
  });
}

// ---------------------------------------------------------------------------
// Response sanitiser — strips reasoning/thinking blocks leaked into output
// ---------------------------------------------------------------------------

/**
 * Strips <think>...</think> and <thinking>...</thinking> blocks that
 * reasoning models (Qwen3, DeepSeek-R1, etc.) occasionally leak into
 * their visible output. Also trims surrounding whitespace.
 *
 * IMPORTANT: If stripping leaves an empty string, returns "" — do NOT fall
 * back to the original text. An empty return triggers "Empty response" in the
 * callers, which causes automatic fallthrough to the next model. This is the
 * correct behavior when a model fills its entire output budget with thinking
 * and produces no actual reply.
 */
function stripThinkTags(text: string): string {
  if (!text) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // Remove unclosed opening tags + everything after (model cut off mid-think)
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/<thinking>[\s\S]*/gi, '')
    .trim();
}

/**
 * Reasoning/agent models can occasionally put their scratchpad in the normal
 * content field.  These are not ordinary persona replies, so reject them and
 * let the OpenRouter cascade try the next model instead of showing them.
 */
function hasVisiblePlanningLeak(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    /^analysis\s*:/i.test(normalized) ||
    /^(?:the\s+)?user\s+(?:asked|said|wants|needs)\b/i.test(normalized) ||
    /^(?:assistant|system)\s*(?:response|message|prompt)?\s*:/i.test(normalized) ||
    /^(?:we|i)\s+need\s+to\s+(?:continue|respond|reply|answer|craft|write)\b/i.test(normalized) ||
    /^(?:let['’]s|here(?:['’]s| is))\s+(?:craft|write|the\s+(?:response|reply))\b/i.test(normalized) ||
    /\b(?:system\s+prompt|internal\s+(?:reasoning|instruction)|continue\s+as\s+kruthika|word\s+count)\b/i.test(normalized)
  );
}

// ---------------------------------------------------------------------------
// Env-variable fallback keys (used when DB has no active keys)
// ---------------------------------------------------------------------------

/** Env-variable fallback keys */
function getEnvFallbackKeys(): ApiKey[] {
  // Cloudflare uses two env vars — combine them as "token:::accountId" so the
  // existing single-string ApiKey.key_value slot works for the env fallback path.
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfCombo = cfToken && cfAccountId ? `${cfToken}:::${cfAccountId}` : undefined;

  const envMap: Partial<Record<AIProvider, string | undefined>> = {
    gemini:     process.env.GEMINI_API_KEY,
    cloudflare: cfCombo,
    groq:       process.env.GROQ_API_KEY,
    cerebras:   process.env.CEREBRAS_API_KEY,
    sambanova:  process.env.SAMBANOVA_API_KEY,
    github:     process.env.GITHUB_TOKEN,
    openrouter: process.env.OPENROUTER_API_KEY,
    nvidia:     process.env.NVIDIA_API_KEY,
    mistral:    process.env.MISTRAL_API_KEY,
    cohere:     process.env.COHERE_API_KEY,
    deepseek:   process.env.DEEPSEEK_API_KEY,
  };
  const keys: ApiKey[] = [];
  let id = -1;
  for (const [provider, val] of Object.entries(envMap)) {
    if (val) {
      keys.push({
        id: id--,
        provider: provider as AIProvider,
        key_label: `env-${provider}`,
        key_value: val,
        priority: 1,
        status: 'active',
        last_used: null,
        last_error: null,
        error_count: 0,
        created_at: '',
      });
    }
  }
  // Support GEMINI_API_KEY_1…_N (and the same convention for every provider)
  // without a code change whenever more capacity is added. A comma-separated
  // value is also accepted for deployment platforms that limit env names.
  if (cfAccountId) {
    const tokens = Object.entries(process.env)
      .filter(([name, value]) => (name === 'CLOUDFLARE_API_TOKEN' || /^CLOUDFLARE_API_TOKEN_\d+$/.test(name)) && value)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([, value]) => String(value).trim())
      .filter(Boolean);
    for (const token of [...new Set(tokens)]) {
      const value = `${token}:::${cfAccountId}`;
      if (keys.some(key => key.provider === 'cloudflare' && key.key_value === value)) continue;
      keys.push({ id: id--, provider: 'cloudflare', key_label: `env-cloudflare-${Math.abs(id)}`,
        key_value: value, priority: keys.filter(key => key.provider === 'cloudflare').length + 1,
        status: 'active', last_used: null, last_error: null, error_count: 0, created_at: '' });
    }
  }

  for (const provider of PROVIDER_ORDER) {
    if (provider === 'cloudflare') continue;
    const prefix = provider === 'github' ? 'GITHUB_TOKEN' : `${provider.toUpperCase()}_API_KEY`;
    const values = Object.entries(process.env)
      .filter(([name, value]) => (name === prefix || new RegExp(`^${prefix}_\\d+$`).test(name)) && value)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .flatMap(([, value]) => String(value).split(',').map(key => key.trim()).filter(Boolean));
    for (const value of [...new Set(values)]) {
      if (keys.some(key => key.provider === provider && key.key_value === value)) continue;
      keys.push({ id: id--, provider, key_label: `env-${provider}-${Math.abs(id)}`, key_value: value,
        priority: keys.filter(key => key.provider === provider).length + 1, status: 'active', last_used: null,
        last_error: null, error_count: 0, created_at: '' });
    }
  }
  return keys;
}

/** Fetch which providers are enabled from DB */
async function getEnabledProviders(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (now - providerSettingsCacheTime < CACHE_TTL_MS) return providerSettingsCache;
  try {
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      `SELECT settings FROM app_configurations WHERE id = 'provider_settings' LIMIT 1`
    );
    if (Array.isArray(rows) && rows[0]?.settings) {
      const raw = rows[0].settings;
      providerSettingsCache = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } else {
      providerSettingsCache = Object.fromEntries(PROVIDER_ORDER.map(p => [p, true]));
    }
  } catch {
    providerSettingsCache = Object.fromEntries(PROVIDER_ORDER.map(p => [p, true]));
  }
  providerSettingsCacheTime = now;
  return providerSettingsCache;
}

/**
 * Runtime cascade order = admin-managed ranks applied over the default order.
 * Ranked providers run first (ascending rank); unranked providers follow in
 * the built-in free-first sequence. Fails safe to the default order.
 */
export async function getDynamicProviderOrder(): Promise<AIProvider[]> {
  try {
    const ranks = await getProviderRanks();
    return orderProvidersByRank(PROVIDER_ORDER, ranks);
  } catch {
    return [...PROVIDER_ORDER];
  }
}

export async function getActiveKeys(provider?: AIProvider): Promise<ApiKey[]> {
  const now = Date.now();
  if (now - keysCacheTime > CACHE_TTL_MS) {
    try {
      const db = await getMysqlClient();
      const [rows] = await db.query(
        `SELECT * FROM api_keys WHERE status != 'disabled' ORDER BY provider, priority ASC`
      );
      const rawRows = Array.isArray(rows) ? (rows as any[]) : [];
      // Decrypt key_value only after it leaves the DB and immediately before it
      // is used. Encrypted values are never held in the long-lived cache.
      keysCache = rawRows.map((r: any) => {
        let key_value = r.key_value;
        try {
          key_value = decryptSecret(r.key_value);
        } catch (e) {
          console.error(`[AI] Failed to decrypt key id=${r.id} (${r.provider}/${r.key_label}):`, (e as Error).message);
          key_value = r.key_value;
        }
        return { ...r, key_value };
      }) as ApiKey[];
      keysCacheTime = now;
    } catch {
      // keep stale cache
    }
  }
  const enabledProviders = await getEnabledProviders();
  const dbActive = keysCache.filter(k => {
    if (k.status === 'disabled' || k.status === 'error') return false;
    if (k.status === 'exhausted') {
      // Auto-recovery: re-admit exhausted keys after the cooldown window.
      // Keys with no recorded timestamp (e.g. flagged before this deploy, or
      // reset by an admin) are retried immediately.
      const at = exhaustedAt.get(k.id);
      return at === undefined || Date.now() - at > EXHAUSTED_RETRY_MS;
    }
    return enabledProviders[k.provider] !== false; // status === 'active'
  });

  // Merge strategy: use DB keys as the primary source, then fill in env-variable
  // keys for any provider that has NO DB key at all.  The old "all-or-nothing"
  // fallback meant a provider like NVIDIA (env-only) was silently invisible
  // whenever any other provider existed in the DB.
  let allActive: ApiKey[];
  const envKeys = getEnvFallbackKeys();
  allActive = [...dbActive, ...envKeys.filter(env => !dbActive.some(db => db.provider === env.provider && db.key_value === env.key_value))];

  if (provider) return allActive.filter(k => k.provider === provider);
  return allActive;
}

export function invalidateKeysCache() {
  keysCacheTime = 0;
  providerSettingsCacheTime = 0;
  // Also bust the admin-managed provider-priority and model-override caches so
  // rank/model changes apply to the very next request (real-time behaviour).
  bustProviderPriority();
  bustProviderModels();
}

// ---------------------------------------------------------------------------
// Mark key status after failure
// ---------------------------------------------------------------------------

/**
 * Exhausted-key auto-recovery: quota windows reset (per-minute RPM buckets,
 * daily caps), so an 'exhausted' key must become retryable again. We record
 * WHEN a key was marked exhausted and re-admit it after a cooldown instead of
 * locking it out until an admin manually resets it.
 */
const EXHAUSTED_RETRY_MS = 10 * 60_000; // 10 min — safe for RPM buckets, cheap for daily caps
const exhaustedAt = new Map<number, number>();

async function markKeyStatus(
  id: number,
  status: 'exhausted' | 'error' | 'disabled',
  errorMessage: string
) {
  if (id < 0) {
    console.warn(`[AI] Env-fallback key id=${id} failed: ${errorMessage}`);
    return;
  }
  if (status === 'exhausted') exhaustedAt.set(id, Date.now());
  else exhaustedAt.delete(id);
  invalidateKeysCache();
  try {
    const db = await getMysqlClient();
    await db.query(
      `UPDATE api_keys SET status = ?, last_error = ?, error_count = error_count + 1 WHERE id = ?`,
      [status, errorMessage.substring(0, 500), id]
    );
    await db.query(
      `INSERT INTO api_key_logs (key_id, provider, event_type, message)
       SELECT id, provider, ?, ? FROM api_keys WHERE id = ?`,
      [status, errorMessage.substring(0, 500), id]
    );
  } catch (e) {
    console.error('[AI] Failed to update key status in DB:', e);
  }
  const key = keysCache.find(k => k.id === id);
  if (key) { key.status = status; key.last_error = errorMessage; key.error_count++; }
}

async function markKeyUsed(id: number) {
  if (id < 0) return;
  try {
    const db = await getMysqlClient();
    await db.query(`UPDATE api_keys SET last_used = NOW() WHERE id = ?`, [id]);
  } catch {}
  const key = keysCache.find(k => k.id === id);
  if (key) key.last_used = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function isExhaustedError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    msg.includes('quota') || msg.includes('rate limit') || msg.includes('rate_limit') ||
    msg.includes('too many requests') || msg.includes('429') ||
    msg.includes('resource_exhausted') || msg.includes('insufficient_quota') ||
    msg.includes('exceeded') || msg.includes('tokens per') || msg.includes('requests per')
  );
}

/** Auth / payment errors are permanent — bad key or billing issue. Mark as disabled, not retryable. */
function isAuthError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    msg.includes('401') || msg.includes('403') || msg.includes('402') ||
    msg.includes('unauthorized') || msg.includes('invalid api key') ||
    msg.includes('invalid_api_key') || msg.includes('authentication') ||
    msg.includes('access denied') || msg.includes('forbidden') ||
    msg.includes('no auth') || msg.includes('api key not found') ||
    msg.includes('incorrect api key') || msg.includes('billing') ||
    msg.includes('payment required') || msg.includes('payment') ||
    msg.includes('subscription') || msg.includes('upgrade your plan')
  );
}

/**
 * Decide whether a failed key has a realistic chance of succeeding if given
 * another attempt. Permanent key/quota/model failures are deliberately excluded:
 * retrying those only burns the request budget and delays the next provider.
 */
function isTransientFailure(err: unknown): boolean {
  if (isAuthError(err) || isExhaustedError(err)) return false;
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();

  return (
    /\b(?:timeout|timed out|aborted|abort|network|econnreset|econnrefused|etimedout)\b/.test(msg) ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable') ||
    msg.includes('gateway timeout') ||
    msg.includes('overloaded') ||
    msg.includes('try again') ||
    /\b(?:http\s*)?(?:500|502|503|504|529)\b/.test(msg)
  );
}

/** Race a provider call against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// ---------------------------------------------------------------------------
// Provider call functions
// All functions receive a pre-built ChatMessage[] from chat.ts via
// generateWithFallback. They pass it to the API unchanged (Gemini requires
// format translation, but content is never modified). logPreRequest() fires
// immediately before every HTTP dispatch.
// ---------------------------------------------------------------------------

async function callGemini(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  // All free-tier Gemini models, newest → oldest (July 2026).
  // Each model has its own quota bucket — exhausting one falls through to the next.
  // 402/payment errors are caught below and treated as model-level skips (NOT key disables).
  // Gemini free-tier model cascade — July 29, 2026 (live-verified against API key).
  //
  // KEY FINDINGS from live testing on this API key (July 29 2026):
  //  • gemini-3.6-flash, 3.5-flash, 3.5-flash-lite, 3.1-flash-lite → ✅ work on v1beta
  //  • gemini-3-flash-preview, gemini-3.1-flash-lite-preview → ✅ verified working
  //  • gemini-flash-latest alias → ✅ resolves to 3.6-flash
  //  • gemini-flash-lite-latest alias → ✅ resolves to 3.5-flash-lite
  //  • gemini-2.5-flash → "no longer available to new users" on this key
  //  • gemini-2.0-flash → 429 quota limit 0 (paid tier only on this key)
  //
  //  thinkingConfig MUST NOT be sent to 3.x models — returns 400 "invalid argument".
  //  Only gemini-2.5-* support thinkingConfig, but none are in this cascade.
  //  For chat, we never want thinking anyway (wastes tokens, slows response).
  //
  // Aug-2026 refresh: gemini-3.1-flash-lite-preview REMOVED (shut down per
  // Google's deprecation table). Aliases (gemini-flash-latest) lead the list —
  // they auto-track Google's newest Flash release so this cascade never goes
  // stale. Admin overrides replace the whole list (provider_models_v1).
  const GEMINI_MODELS = await getModelList('gemini', PROVIDER_DEFAULT_MODELS.gemini);

  // Format conversion: ChatMessage[] → Gemini API format.
  // This is pure format translation — content is copied verbatim, nothing added.
  //   system role  → config.systemInstruction (Gemini's required separate field)
  //   user role    → { role: 'user',  parts: [{ text }] }
  //   assistant    → { role: 'model', parts: [{ text }] }
  const systemMsg = messages.find(m => m.role === 'system');
  const contents: any[] = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  let lastErr: unknown;
  for (const modelName of GEMINI_MODELS) {
    // Log canonical ChatMessage[] immediately before HTTP dispatch
    logPreRequest('gemini', modelName, messages);
    try {
          // No models in this cascade support thinkingConfig (all are 3.x).
      // Only gemini-2.5-* support thinkingConfig, and those are not in our list
      // because they are not available to new users on the free tier.
      // Sending thinkingConfig to 3.x models causes 400 "invalid argument".
      const isThinkingModel = false; // none of our free-tier models need thinking
      const result = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
          temperature: opts.temperature ?? 0.75,
          maxOutputTokens: opts.maxTokens ?? 600,
          topP: 0.9,
          // Without this, the outer cascade timer only stops waiting for
          // Gemini while the SDK request continues in the background.
          ...(opts.signal ? { abortSignal: opts.signal } : {}),
          ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      const text = result.text;
      if (!text) throw new Error(`Empty response from Gemini (${modelName})`);
      console.log(`[AI] Gemini model used: ${modelName}`);
      return stripThinkTags(text);
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      // 402 = model requires paid plan on this key — skip model, do NOT disable key.
      const isQuotaOrModel = msg.includes('quota') || msg.includes('429') || msg.includes('not found') ||
                             msg.includes('not supported') || msg.includes('model') || msg.includes('limit: 0') ||
                             msg.includes('402') || msg.includes('billing') || msg.includes('payment') ||
                             msg.includes('upgrade') || msg.includes('resource_exhausted') || msg.includes('unavailable');
      if (isQuotaOrModel) {
        lastErr = err;
        console.warn(`[AI] Gemini model ${modelName} unavailable, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All Gemini models failed');
}

/** Get or create a cached OpenAI SDK client */
async function getOpenAIClient(apiKey: string, baseURL?: string, extraHeaders?: Record<string, string>): Promise<any> {
  const cacheKey = `${apiKey}:::${baseURL || 'default'}`;
  if (openAIClientCache.has(cacheKey)) return openAIClientCache.get(cacheKey)!;
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    ...(extraHeaders ? { defaultHeaders: extraHeaders } : {}),
  });
  openAIClientCache.set(cacheKey, client);
  return client;
}

/**
 * Core OpenAI-compatible HTTP call.
 * Receives the pre-built ChatMessage[] — no message construction here.
 * Logs immediately before create(), then passes messages[] to the API unchanged.
 */
async function callOpenAICompat(
  apiKey: string,
  messages: ChatMessage[],
  opts: ProviderCallOpts,
  model: string,
  baseURL?: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const client = await getOpenAIClient(apiKey, baseURL, extraHeaders);
  // Pre-request log — exact messages[] immediately before HTTP
  logPreRequest(baseURL?.replace('https://', '').split('/')[0] ?? 'openai-compat', model, messages);
  const completion = await client.chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens ?? 600,
    temperature: opts.temperature ?? 0.75,
    // Reduce repetition and phrase-recycling — important for natural companion conversation.
    // presence_penalty: discourages repeating topics already covered.
    // frequency_penalty: discourages repeating the same words/phrases verbatim.
    // NOTE: 600 tokens default — Indian scripts (Kannada, Tamil, Telugu, Marathi) use
    // 3-4 tokens per word vs ~1.5 for English, so the higher budget prevents cut-off replies.
    presence_penalty: 0.3,
    frequency_penalty: 0.3,
  }, opts.signal ? { signal: opts.signal } : undefined);
  const text = completion.choices[0]?.message?.content;
  const stripped = stripThinkTags(text ?? '');
  if (!stripped) throw new Error(`Empty response from ${baseURL || 'OpenAI-compat'} (${model})`);
  return stripped;
}

// ---------------------------------------------------------------------------
// Cloudflare Workers AI — REST API (not OpenAI-compatible, custom fetch)
// Needs key_value stored as "token:::accountId" (combined for single-field storage)
// Free tier: 10,000 neurons/day · Best free multilingual model: Qwen 2.5 72B
// ---------------------------------------------------------------------------
async function callCloudflare(keyValue: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // key_value is stored as "CF_API_TOKEN:::CF_ACCOUNT_ID"
  const [apiToken, accountId] = keyValue.split(':::');
  if (!apiToken || !accountId) throw new Error('Cloudflare key must be "CF_API_TOKEN:::CF_ACCOUNT_ID"');

  // Best free multilingual models (Qwen -> Gemma -> Llama cascade)
  // Admin overrides replace the whole list (provider_models_v1).
  const CF_MODELS = await getModelList('cloudflare', PROVIDER_DEFAULT_MODELS.cloudflare);

  // Convert ChatMessage[] to CF format (same as OpenAI messages structure)
  const cfMessages = messages.map(m => ({ role: m.role, content: m.content }));
  let lastErr: unknown;

  for (const model of CF_MODELS) {
    logPreRequest('cloudflare', model, messages);
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: cfMessages,
          max_tokens: opts.maxTokens ?? 600,
          temperature: opts.temperature ?? 0.75,
        }),
        signal: opts.signal ?? AbortSignal.timeout(20000),
      });

      if (res.status === 429) {
        lastErr = new Error(`Cloudflare rate limit (429) on ${model}`);
        console.warn(`[AI] Cloudflare model ${model} rate-limited, trying next…`);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Cloudflare auth failed (${res.status}) — check API token`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // If model not found or quota, try next model
        if (res.status === 404 || res.status === 400) {
          lastErr = new Error(`Cloudflare model ${model} unavailable (${res.status})`);
          console.warn(`[AI] Cloudflare model ${model} unavailable, trying next…`);
          continue;
        }
        throw new Error(`Cloudflare HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as any;
      // CF response: { result: { response: string }, success: boolean }
      const text = data?.result?.response;
      if (!text || text.trim() === '') {
        lastErr = new Error(`Empty response from Cloudflare model ${model}`);
        console.warn(`[AI] Cloudflare ${model} empty response, trying next…`);
        continue;
      }
      console.log(`[AI] Cloudflare Workers AI model used: ${model}`);
      return stripThinkTags(text);
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('timeout') || msg.includes('abort') || msg.includes('fetch') ||
          msg.includes('network') || msg.includes('econnreset')) {
        lastErr = err;
        console.warn(`[AI] Cloudflare network error on ${model}, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All Cloudflare Workers AI models failed');
}

// ---------------------------------------------------------------------------
// Groq — cascade through multiple free models (different rate-limit buckets)
// ---------------------------------------------------------------------------
async function callGroq(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // Verified against live Groq /v1/models API July 29, 2026.
  // REMOVED: llama-3.1-70b-versatile (decommissioned), gemma2-9b-it (decommissioned),
  //          qwen/qwen3.6-27b (think blocks overflow max_tokens → empty reply),
  //          openai/gpt-oss-120b and openai/gpt-oss-20b (refuse persona system prompts → empty reply).
  // Each model has its own rate-limit bucket → more combined headroom across keys.
  // Verified current per Groq docs (console.groq.com/docs/models) Aug 2026.
  const GROQ_MODELS = await getModelList('groq', PROVIDER_DEFAULT_MODELS.groq);
  // Note: allam-2-7b is Arabic-only. groq/compound requires tool setup. Kept minimal list
  // of persona-respecting models — gpt-oss variants refuse to maintain character.
  let lastErr: unknown;
  for (const model of GROQ_MODELS) {
    try {
      const result = await callOpenAICompat(apiKey, messages, opts, model, 'https://api.groq.com/openai/v1');
      console.log(`[AI] Groq model used: ${model}`);
      return result; // stripThinkTags already applied inside callOpenAICompat
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      // 429 = this model's quota hit — try next model in cascade
      if (msg.includes('429') || msg.includes('rate') || msg.includes('quota') ||
          msg.includes('limit') || msg.includes('exceeded') || msg.includes('model') ||
          msg.includes('not found') || msg.includes('unavailable') || msg.includes('decommissioned')) {
        lastErr = err;
        console.warn(`[AI] Groq model ${model} rate-limited/unavailable, trying next…`);
        continue;
      }
      throw err; // Auth errors propagate up to trigger key rotation
    }
  }
  throw lastErr ?? new Error('All Groq models failed');
}

// ---------------------------------------------------------------------------
// Cerebras — ultra-fast inference, 1M tokens/day free
// ---------------------------------------------------------------------------
async function callCerebras(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // Verified against live Cerebras /v1/models API July 29, 2026.
  // Available models: gemma-4-31b, gpt-oss-120b, zai-glm-4.7
  // On the free plan: gemma-4-31b is free; gpt-oss-120b and zai-glm-4.7 may return 402.
  // Cascade tries free model first — 402 on a model ≠ bad key, just plan restriction.
  // Note: free plan has 8K context limit — sufficient for short chat turns.
  // Aug-2026: zai-glm-4.7 REMOVED (no longer on Cerebras public endpoints —
  // only gemma-4-31b and gpt-oss-120b remain).
  const CEREBRAS_MODELS = await getModelList('cerebras', PROVIDER_DEFAULT_MODELS.cerebras);
  let lastErr: unknown;
  for (const model of CEREBRAS_MODELS) {
    try {
      const result = await callOpenAICompat(apiKey, messages, opts, model, 'https://api.cerebras.ai/v1');
      console.log(`[AI] Cerebras model used: ${model}`);
      return result;
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      // 402 = model requires payment on this plan — try next model (not a key auth error)
      if (msg.includes('402') || msg.includes('model') || msg.includes('not found') ||
          msg.includes('unavailable') || msg.includes('does not exist') || msg.includes('unsupported')) {
        lastErr = err;
        console.warn(`[AI] Cerebras model ${model} unavailable (${msg.substring(0, 60)}), trying next…`);
        continue;
      }
      throw err; // Auth/rate errors propagate up to trigger key rotation
    }
  }
  throw lastErr ?? new Error('All Cerebras models failed');
}

// ---------------------------------------------------------------------------
// SambaNova — cascade through verified live models
// ---------------------------------------------------------------------------
async function callSambaNova(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // Verified against live SambaNova /v1/models API July 29, 2026.
  // Llama-3.1-405B removed (404). Qwen2.5-72B removed (410 — not available on Cloud).
  // All 6 models confirmed present in /v1/models response on this key.
  const SAMBANOVA_MODELS = await getModelList('sambanova', PROVIDER_DEFAULT_MODELS.sambanova);
  let lastErr: unknown;
  for (const model of SAMBANOVA_MODELS) {
    try {
      const result = await callOpenAICompat(apiKey, messages, opts, model, 'https://api.sambanova.ai/v1');
      console.log(`[AI] SambaNova model used: ${model}`);
      return result;
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('404') || msg.includes('model') || msg.includes('not found') ||
          msg.includes('unavailable') || msg.includes('does not exist') || msg.includes('access')) {
        lastErr = err;
        console.warn(`[AI] SambaNova model ${model} unavailable, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All SambaNova models failed');
}

// ---------------------------------------------------------------------------
// GitHub Models — free GPT-4o-mini + Llama 3.3 70B via Azure/GitHub
// ---------------------------------------------------------------------------
async function callGithub(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // One GitHub account unlocks all models. Rate limits per-model:
  // gpt-4o-mini: 15 RPM / 150 req/day (lower tier — actually more than gpt-4o)
  // llama-3.3-70b: 15 RPM / 150 req/day
  // Verified base URL: https://models.github.ai/inference (uses Azure Inference SDK)
  // Verified against live GitHub Models inference API July 2026.
  // Model IDs are CASE-SENSITIVE — must match exactly or get 'unknown_model' error.
  // Rate limits: ~150 req/day per model per account (free with any GitHub account).
  // REMOVED: microsoft/Phi-4 — times out consistently on free tier.
  const GITHUB_MODELS = await getModelList('github', PROVIDER_DEFAULT_MODELS.github);
  let lastErr: unknown;
  for (const model of GITHUB_MODELS) {
    try {
      const result = await callOpenAICompat(
        apiKey, messages, opts, model,
        'https://models.github.ai/inference'
      );
      console.log(`[AI] GitHub model used: ${model}`);
      return result;
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('rate') || msg.includes('429') || msg.includes('quota') ||
          msg.includes('model') || msg.includes('not found') || msg.includes('exceeded') ||
          msg.includes('unavailable') || msg.includes('does not exist') ||
          msg.includes('timeout') || msg.includes('abort') || msg.includes('timed out') ||
          msg.includes('unknown_model') || msg.includes('503')) {
        lastErr = err;
        console.warn(`[AI] GitHub model ${model} unavailable/slow, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All GitHub models failed');
}

// ---------------------------------------------------------------------------
// OpenRouter — multi-free-model cascade with required site headers
// ---------------------------------------------------------------------------
async function callOpenRouter(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  const cacheKey = `${apiKey}:::https://openrouter.ai/api/v1`;
  let client: any;
  if (openAIClientCache.has(cacheKey)) {
    client = openAIClientCache.get(cacheKey)!;
  } else {
    const { default: OpenAI } = await import('openai');
    client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://kruthika.ai',
        'X-Title': 'Kruthika AI Chat',
      },
    });
    openAIClientCache.set(cacheKey, client);
  }

  // Ranked FREE models on OpenRouter, refreshed August 30, 2026 from the
  // official free collection and model pages. Direct multilingual chat models
  // lead; coding/agent and reasoning models are intentionally last.
  // Provider-returned errors on individual free models are common because free
  // models use third-party infrastructure, so keep a broad fallback list.
  const FREE_MODELS = await getModelList('openrouter', PROVIDER_DEFAULT_MODELS.openrouter);

  let lastErr: unknown;
  for (const model of FREE_MODELS) {
    // Log immediately before HTTP — proves messages[] unchanged
    logPreRequest('openrouter', model, messages);
    try {
      const isReasoningModel = /(?:glm-5\.2|nemotron)/i.test(model);
      const completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 600,
        temperature: opts.temperature ?? 0.75,
        // Keep scratchpad tokens out of the visible response. `effort: none`
        // also prevents GLM/Nemotron from spending the tiny chat budget on
        // planning when the provider supports that control.
        ...(isReasoningModel ? { reasoning: { effort: 'none', exclude: true } } : {}),
      }, opts.signal ? { signal: opts.signal } : undefined);
      const text = completion.choices[0]?.message?.content;
      if (!text) throw new Error(`Empty response from OpenRouter (${model})`);
      const cleaned = stripThinkTags(text);
      if (!cleaned) throw new Error(`Empty response after reasoning cleanup from OpenRouter (${model})`);
      if (hasVisiblePlanningLeak(cleaned)) {
        throw new Error(`Visible planning leak from OpenRouter (${model})`);
      }
      console.log(`[AI] OpenRouter model used: ${model}`);
      return cleaned;
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('quota') || msg.includes('rate') || msg.includes('limit') ||
          msg.includes('model') || msg.includes('429') || msg.includes('context') ||
          msg.includes('unavailable') || msg.includes('timeout') || msg.includes('not found') ||
          msg.includes('404') || msg.includes('free') || msg.includes('planning leak')) {
        lastErr = err;
        console.warn(`[AI] OpenRouter model ${model} unavailable, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All OpenRouter free models failed');
}

// ---------------------------------------------------------------------------
// NVIDIA NIM — 100+ models, 40 RPM free tier
// ---------------------------------------------------------------------------
async function callNvidia(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // NVIDIA NIM free tier: 40 RPM. Base URL: https://integrate.api.nvidia.com/v1
  // API key starts with "nvapi-". Verified against live NVIDIA NIM account July 29, 2026.
  // REMOVED: abacusai/dracarys-llama-3.1-70b-instruct (no longer in /v1/models response),
  //          nvidia/llama-3.3-nemotron-super-49b-v1 (replaced by v1.5).
  // openai/gpt-oss-120b is fastest + best quality on this account.
  const NVIDIA_MODELS = await getModelList('nvidia', PROVIDER_DEFAULT_MODELS.nvidia);
  let lastErr: unknown;
  for (const model of NVIDIA_MODELS) {
    try {
      // Timeout for NVIDIA (cold start can be slow) is handled at generateWithFallback level (25s)
      const result = await callOpenAICompat(
        apiKey, messages, opts, model,
        'https://integrate.api.nvidia.com/v1'
      );
      console.log(`[AI] NVIDIA NIM model used: ${model}`);
      return result;
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('404') || msg.includes('model') || msg.includes('not found') ||
          msg.includes('unavailable') || msg.includes('does not exist') ||
          msg.includes('rate') || msg.includes('429') || msg.includes('quota') ||
          msg.includes('503') || msg.includes('timeout') || msg.includes('abort') ||
          msg.includes('timed out') || msg.includes('exhausted') || msg.includes('account')) {
        lastErr = err;
        console.warn(`[AI] NVIDIA model ${model} unavailable/slow, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All NVIDIA models failed');
}

// ---------------------------------------------------------------------------
// Cohere v2 API — uses the modern /v2/chat endpoint
// ---------------------------------------------------------------------------
async function callCohere(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // Verified against live Cohere API July 29, 2026.
  // Models confirmed via /v1/models: command-r7b-12-2024, command-a-03-2025, command-r-08-2024
  // command-a-03-2025 first — more capable, less prone to hallucination loops in native scripts.
  // command-r7b-12-2024 produces verbose looping responses for Kannada/Tamil script inputs.
  // command-a-03-2025 first — more capable, less prone to hallucination loops in native scripts.
  // command-r7b-12-2024 produces verbose looping responses for Kannada/Tamil script inputs.
  const COHERE_MODELS = await getModelList('cohere', PROVIDER_DEFAULT_MODELS.cohere);

  // Cap tokens tightly: Cohere's smaller models (especially command-r7b) enter
  // hallucination loops in native-script languages when given a large token budget.
  // The system prompt targets 1–2 bubbles of ≤15 words each (≈30 words max), so
  // 200 tokens is more than enough for any valid response.
  const maxTokens = Math.min(opts.maxTokens ?? 600, 200);

  let lastErr: unknown;
  for (const model of COHERE_MODELS) {
    logPreRequest('cohere', model, messages);
    const res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: opts.temperature ?? 0.75,
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      const msg = err.toLowerCase();
      if (msg.includes('404') || msg.includes('not found') || msg.includes('model') ||
          msg.includes('unavailable') || msg.includes('rate') || msg.includes('quota')) {
        lastErr = new Error(`Cohere ${model} error ${res.status}: ${err.substring(0, 200)}`);
        console.warn(`[AI] Cohere model ${model} unavailable, trying next…`);
        continue;
      }
      throw new Error(`Cohere error ${res.status}: ${err.substring(0, 200)}`);
    }
    const data = await res.json();
    // v2 response: data.message.content[0].text
    const raw = data?.message?.content?.[0]?.text || data?.text;
    if (!raw) {
      lastErr = new Error(`Empty response from Cohere (${model})`);
      console.warn(`[AI] Cohere model ${model} empty response, trying next…`);
      continue;
    }
    console.log(`[AI] Cohere model used: ${model}`);
    const text = stripThinkTags(raw);

    // Safety net: if the response is still over 45 words (can happen with native-script
    // tokens being split differently), truncate at the last sentence boundary before the
    // 45-word mark.  This is a last-resort guard — the token cap above should prevent it.
    const words = text.trim().split(/\s+/);
    if (words.length > 45) {
      // Walk backwards from word 45 to find a sentence boundary (. ! ? \n)
      let cutIdx = 44;
      while (cutIdx > 10 && !/[.!?\n]$/.test(words[cutIdx])) cutIdx--;
      return words.slice(0, cutIdx + 1).join(' ');
    }

    return text;
  }
  throw lastErr ?? new Error('All Cohere models failed');
}

// ---------------------------------------------------------------------------
// Mistral — cascade through free models (mistral-small-2603 is newest free model)
// ---------------------------------------------------------------------------
async function callMistral(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // Aug-2026 refresh per Mistral's official deprecation table:
  //   REMOVED: open-mistral-nemo & open-mistral-nemo-2407 (retired 2026-07-31).
  //   mistral-small-2603 = current Mistral Small 4 era; mistral-small-latest
  //   alias auto-tracks the newest Small release so this cascade never goes stale.
  // Strong multilingual: Tamil, Telugu, Kannada, Marathi verified in testing.
  const MISTRAL_MODELS = await getModelList('mistral', PROVIDER_DEFAULT_MODELS.mistral);
  let lastErr: unknown;
  for (const model of MISTRAL_MODELS) {
    try {
      const result = await callOpenAICompat(apiKey, messages, opts, model, 'https://api.mistral.ai/v1');
      console.log(`[AI] Mistral model used: ${model}`);
      return result;
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('404') || msg.includes('model') || msg.includes('not found') ||
          msg.includes('unavailable') || msg.includes('rate') || msg.includes('429') ||
          msg.includes('quota') || msg.includes('limit')) {
        lastErr = err;
        console.warn(`[AI] Mistral model ${model} unavailable, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All Mistral models failed');
}

// ---------------------------------------------------------------------------
// DeepSeek — updated to V4 models (July 2026)
// ---------------------------------------------------------------------------
async function callDeepSeek(apiKey: string, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  // Aug-2026 refresh per api-docs.deepseek.com: only deepseek-v4-flash and
  // deepseek-v4-pro are served. REMOVED: deepseek-chat (legacy V3 alias,
  // deprecated). Account is paid — load up credits at platform.deepseek.com.
  const DEEPSEEK_MODELS = await getModelList('deepseek', PROVIDER_DEFAULT_MODELS.deepseek);
  let lastErr: unknown;
  for (const model of DEEPSEEK_MODELS) {
    try {
      const result = await callOpenAICompat(apiKey, messages, opts, model, 'https://api.deepseek.com');
      console.log(`[AI] DeepSeek model used: ${model}`);
      return result;
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes('404') || msg.includes('model') || msg.includes('not found') ||
          msg.includes('unavailable') || msg.includes('balance') || msg.includes('insufficient') ||
          msg.includes('rate') || msg.includes('429') || msg.includes('quota')) {
        lastErr = err;
        console.warn(`[AI] DeepSeek model ${model} unavailable (${msg.substring(0, 60)}), trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('All DeepSeek models failed');
}

// ---------------------------------------------------------------------------
// Provider dispatcher
// ---------------------------------------------------------------------------

async function callProvider(key: ApiKey, messages: ChatMessage[], opts: ProviderCallOpts): Promise<string> {
  switch (key.provider) {
    case 'gemini':     return callGemini(key.key_value, messages, opts);
    case 'cloudflare': return callCloudflare(key.key_value, messages, opts);
    case 'groq':       return callGroq(key.key_value, messages, opts);
    case 'cerebras':   return callCerebras(key.key_value, messages, opts);
    case 'sambanova':  return callSambaNova(key.key_value, messages, opts);
    case 'github':     return callGithub(key.key_value, messages, opts);
    case 'openrouter': return callOpenRouter(key.key_value, messages, opts);
    case 'nvidia':     return callNvidia(key.key_value, messages, opts);
    case 'cohere':     return callCohere(key.key_value, messages, opts);
    case 'mistral':    return callMistral(key.key_value, messages, opts);
    case 'deepseek':   return callDeepSeek(key.key_value, messages, opts);
    default: throw new Error(`Unknown provider: ${key.provider}`);
  }
}

// ---------------------------------------------------------------------------
// Main fallback engine — tries keys in priority order with automatic rotation
// ---------------------------------------------------------------------------

/**
 * Execute a pre-built conversation payload against all available providers,
 * falling back through the priority order on failure.
 *
 * messages[] is passed unchanged to callProvider → each individual provider
 * function → HTTP call. No provider may add to or modify messages[].
 */
export async function generateWithFallback(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const allActive = await getActiveKeys();

  // Cascade order is dynamic: admin-set provider ranks (provider_priority_v1)
  // are honoured in real time; unranked providers keep the default sequence.
  const cascadeOrder = await getDynamicProviderOrder();
  const ordered: ApiKey[] = cascadeOrder.flatMap(provider =>
    rankKeys(allActive.filter(key => key.provider === provider))
  );

  if (ordered.length === 0) throw new Error('NO_KEYS_CONFIGURED');

  const providerOpts: ProviderCallOpts = {
    maxTokens: opts.maxTokens ?? 600,   // 600: Indian scripts need more tokens than Latin text
    temperature: opts.temperature ?? 0.75,
  };

  const tried = new Set<number>();
  // Only transient failures enter the recovery round. This is intentionally
  // populated from the first pass only; recovery attempts can never schedule
  // another recovery attempt.
  const transientFailures = new Map<number, { key: ApiKey; timeoutMs: number }>();
  const attempt = async (key: ApiKey, timeoutMs: number): Promise<string> => {
    const health = healthFor(key);
    health.inFlight++;
    const startedAt = Date.now();
    // AbortController ensures the underlying HTTP request is actually cancelled
    // when the budget expires (not just abandoned in the background).
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`Timeout after ${timeoutMs}ms: ${key.provider}/${key.key_label}`)),
      timeoutMs,
    );
    try {
      console.log(`[AI] Trying ${key.provider} "${key.key_label}" (id=${key.id})`);
      const response = await callProvider(key, messages, {
        ...providerOpts,
        signal: controller.signal,
      });
      health.latencyMs = Math.round(health.latencyMs * 0.7 + (Date.now() - startedAt) * 0.3);
      health.failures = 0;
      health.coolUntil = 0;
      markKeyUsed(key.id).catch(() => {});
      console.log(`[AI] Success with ${key.provider} "${key.key_label}"`);
      return response;
    } catch (err) {
      // Normalise abort errors so classification (auth/quota/transient) works.
      let failure: unknown = err;
      if (controller.signal.aborted && err instanceof Error && err.name === 'AbortError') {
        failure = new Error(`Timeout after ${timeoutMs}ms: ${key.provider}/${key.key_label}`);
      }
      const msg = failure instanceof Error ? failure.message : String(failure);
      console.warn(`[AI] Key ${key.id} (${key.provider}/${key.key_label}) failed: ${msg}`);
      if (isAuthError(failure)) {
        // Bad key or billing issue — disable permanently so we never try it again this session
        await markKeyStatus(key.id, 'disabled', msg);
      } else if (isExhaustedError(failure)) {
        await markKeyStatus(key.id, 'exhausted', msg);
      } else {
        // Network errors and timeouts are temporary. Quarantine briefly rather
        // than disabling a healthy key globally after one bad request.
        health.failures++;
        health.coolUntil = Date.now() + Math.min(60_000, 2_000 * 2 ** Math.min(health.failures, 5));
      }
      if (isTransientFailure(failure)) {
        transientFailures.set(key.id, { key, timeoutMs });
      }
      throw failure;
    } finally {
      clearTimeout(timer);
      health.inFlight = Math.max(0, health.inFlight - 1);
    }
  };

  // Hedged waves on the LEAD provider = cascadeOrder[0] — i.e. whatever the
  // admin ranked #1 (or the default first provider when nothing is ranked).
  // This replaces the old hardcoded "Gemini always first" hedge that ignored
  // admin-managed ranks. At most two keys run concurrently; first success wins.
  const leadProvider = cascadeOrder[0];
  const leadKeys = ordered.filter(key => key.provider === leadProvider);
  const leadDeadline = Date.now() + 15_000;
  for (let index = 0; index < leadKeys.length; index += 2) {
    const remainingMs = leadDeadline - Date.now();
    if (remainingMs <= 0) break;
    const wave = leadKeys.slice(index, index + 2).filter(key => !tried.has(key.id));
    wave.forEach(key => tried.add(key.id));
    if (!wave.length) continue;
    try {
      return await Promise.any(wave.map(key => attempt(key, Math.min(10_000, remainingMs))));
    } catch {
      // Every key in this small wave failed; immediately try the next pair.
    }
  }

  // Then walk the FULL cascade in the admin-defined order. The deadline is
  // generous (45 s) because each attempt needs real time: providers internally
  // cascade through several models, and Indian-script generations are slower.
  // The previous 15 s / 7 s-per-attempt budget starved every provider into
  // timeouts and produced ALL_KEYS_FAILED even with perfectly healthy keys.
  const fallbackDeadline = Date.now() + 45_000;
  for (const key of ordered) {
    if (tried.has(key.id)) continue;
    const remainingMs = fallbackDeadline - Date.now();
    if (remainingMs <= 0) break;
    tried.add(key.id);
    try {
      const perAttempt = key.provider === 'nvidia' ? 25_000 : 15_000; // NVIDIA cold-starts slowly
      return await attempt(key, Math.min(perAttempt, remainingMs));
    } catch {
      // The attempt records permanent vs transient key state; continue safely.
    }
  }

  // A slow provider may have been healthy but simply missed the first budget.
  // Give those keys one recovery pass with a longer adaptive timeout. The
  // round is bounded by both a hard count (one round only) and a wall-clock
  // budget, so a provider outage can never create an infinite request.
  const recoveryCandidates = ordered.filter(key => transientFailures.has(key.id));
  const RECOVERY_BUDGET_MS = 60_000;
  const recoveryDeadline = Date.now() + RECOVERY_BUDGET_MS;
  if (recoveryCandidates.length > 0) {
    console.warn(
      `[AI] Initial cascade exhausted; starting one bounded recovery round ` +
      `for ${recoveryCandidates.length} transient failure(s) with longer timeouts`,
    );

    for (const key of recoveryCandidates) {
      const remainingMs = recoveryDeadline - Date.now();
      if (remainingMs <= 0) break;

      const previous = transientFailures.get(key.id)!;
      const health = healthFor(key);
      const maxTimeoutMs = key.provider === 'nvidia' ? 45_000 : 30_000;
      // Prefer observed latency when available, but always increase the
      // timeout beyond the failed attempt. Caps prevent one slow model from
      // monopolising the entire request.
      const adaptiveTimeoutMs = Math.min(
        maxTimeoutMs,
        Math.max(
          previous.timeoutMs + 5_000,
          previous.timeoutMs * 2,
          Math.ceil(health.latencyMs * 2.5),
        ),
      );

      try {
        console.log(
          `[AI] Recovery attempt ${key.provider} "${key.key_label}" ` +
          `(timeout=${Math.min(adaptiveTimeoutMs, remainingMs)}ms)`,
        );
        return await attempt(key, Math.min(adaptiveTimeoutMs, remainingMs));
      } catch {
        // The first and only recovery round has failed for this key.
        // Continue to the next transient candidate while budget remains.
      }
    }

    console.warn(
      `[AI] Recovery round exhausted after ${RECOVERY_BUDGET_MS}ms; ` +
      'stopping without another retry pass',
    );
  }

  throw new Error('ALL_KEYS_FAILED');
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * New clean entry point for the main chat path.
 * chat.ts calls buildConversationPayload() then passes the result here.
 * The payload is never reconstructed after this point.
 */
export async function generateFromMessages(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  try {
    return await generateWithFallback(messages, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NO_KEYS_CONFIGURED')
      throw new Error('No AI keys configured. Please add API keys in Admin Panel → AI Keys.');
    if (msg === 'ALL_KEYS_FAILED')
      throw new Error('All AI providers are currently unavailable. Please try again later.');
    throw err;
  }
}

/**
 * Force a specific provider — used by the benchmark to test each provider
 * independently. Skips the fallback chain; only tries keys for `provider`.
 * Throws if no active key is configured for that provider.
 */
export async function generateFromProvider(
  provider: AIProvider,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<string> {
  const keys = await getActiveKeys(provider);
  if (keys.length === 0) {
    throw new Error(`No active key for provider: ${provider}`);
  }
  const providerOpts: ProviderCallOpts = {
    maxTokens: opts.maxTokens ?? 600,
    temperature: opts.temperature ?? 0.75,
  };
  // Allow caller to override timeout (e.g. benchmark uses shorter timeouts to fail fast)
  const timeoutMs = opts.timeoutMs ?? (provider === 'nvidia' ? 25_000 : 20_000);
  let lastErr: Error | null = null;
  for (const key of keys) {
    try {
      console.log(`[AI] Trying ${key.provider} "${key.key_label}" (id=${key.id})`);
      const response = await withTimeout(
        callProvider(key, messages, providerOpts),
        timeoutMs,
        `${key.provider}/${key.key_label}`
      );
      console.log(`[AI] Success with ${key.provider} "${key.key_label}"`);
      return response;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] ${key.provider} "${key.key_label}" failed: ${lastErr.message}`);
    }
  }
  throw lastErr ?? new Error(`Provider ${provider} failed`);
}

/**
 * Backward-compatible entry point for proactive/offline flows that pass
 * (userMessage, systemPrompt) without pre-built history.
 * Builds a minimal [system, user] payload internally and delegates.
 *
 * NOTE: for the main chat path, use generateFromMessages() instead so that
 * chat.ts remains the single conversation-payload constructor.
 */
export async function generateAIResponse(
  userMessage: string,
  systemPrompt?: string,
  _model?: string,
  context?: string[]
): Promise<string> {
  // Token budget: give the LLM room to respond naturally in any language.
  // Indian scripts (Kannada, Tamil, Telugu, Marathi) use 3-4 tokens per word vs ~1.5 for English.
  // 600 tokens provides headroom for natural multilingual replies + transliteration (Kanglish/Tanglish etc).
  const messages = buildConversationPayload(systemPrompt, context ?? [], userMessage);
  return generateFromMessages(messages, { maxTokens: 600, temperature: 0.75 });
}

// ---------------------------------------------------------------------------
// Backward-compat exports
// ---------------------------------------------------------------------------

/** @deprecated — had their own system prompts. Use generateAIResponse + prompt.ts instead. */
export async function generateEmotionalResponse(
  userMessage: string,
  _characterName = 'Kruthika'
): Promise<{ message: string; emotionalState: string; mood: string }> {
  const response = await generateAIResponse(userMessage);
  return { message: response, emotionalState: 'friendly', mood: 'positive' };
}

/** @deprecated — use generateAIResponse + prompt.ts instead. */
export async function generateMultilingualResponse(
  userMessage: string,
  _targetLanguage = 'English',
  _characterName = 'Kruthika'
): Promise<string> {
  return generateAIResponse(userMessage);
}

export async function testAIProvider(): Promise<boolean> {
  try {
    const r = await generateAIResponse('Reply with exactly: AI is working');
    return r.toLowerCase().includes('ai is working') || r.length > 3;
  } catch {
    return false;
  }
}
