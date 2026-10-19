/**
 * POST /api/admin/ai-health/test
 * Body: { provider: string }
 * Live-pings a provider using its best available key (env fallback or first active DB key).
 * Returns: { ok, latencyMs, modelUsed, error }
 *
 * Unlike /api/admin/api-keys/test (which tests a specific key by ID),
 * this tests a PROVIDER — picking whatever key the provider currently has
 * and running through the actual model cascade to find which model responds.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { verifyAdminSession } from '@/lib/admin-auth';
import { PROVIDER_ORDER, PROVIDER_DEFAULT_MODELS, type AIProvider } from '@/ai/multi-provider';
import { getModelList } from '@/lib/provider-models';

const ENV_KEY_MAP: Partial<Record<AIProvider, string>> = {
  groq: 'GROQ_API_KEY', cerebras: 'CEREBRAS_API_KEY', sambanova: 'SAMBANOVA_API_KEY',
  gemini: 'GEMINI_API_KEY', github: 'GITHUB_TOKEN', openrouter: 'OPENROUTER_API_KEY',
  nvidia: 'NVIDIA_API_KEY', mistral: 'MISTRAL_API_KEY', cohere: 'COHERE_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
};

// Minimal probe message for all providers
const PROBE_MSG = [{ role: 'user' as const, content: 'Reply with exactly one word: OK' }];
const PROBE_TOKENS = 8;

async function probeProvider(
  provider: AIProvider,
  keyValue: string,
): Promise<{ ok: boolean; latencyMs: number; modelUsed?: string; error?: string }> {
  const t0 = Date.now();
  const ms = () => Date.now() - t0;

  try {
    // ── Gemini ──────────────────────────────────────────────────────────────
    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: keyValue });
      // Use the exact same cascade order as callGemini in multi-provider.ts
      const MODELS = [
        'gemini-flash-latest',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-3-flash-preview',
      ];
      let lastErr = '';
      for (const model of MODELS) {
        try {
          const r = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: 'Reply OK' }] }],
            config: { maxOutputTokens: PROBE_TOKENS },
          });
          if (r.text) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          lastErr = (e.message ?? String(e)).substring(0, 200);
          if (/401|403|invalid.api.key|permission|unauthorized/i.test(lastErr)) {
            return { ok: false, latencyMs: ms(), error: lastErr };
          }
        }
      }
      return { ok: false, latencyMs: ms(), error: lastErr || 'All Gemini models failed' };
    }

    // ── Cohere ──────────────────────────────────────────────────────────────
    if (provider === 'cohere') {
      const MODELS = ['command-r7b-12-2024', 'command-a-03-2025', 'command-r-08-2024'];
      for (const model of MODELS) {
        const res = await fetch('https://api.cohere.com/v2/chat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.message?.content?.[0]?.text || d?.text) {
            return { ok: true, latencyMs: ms(), modelUsed: model };
          }
        }
        const txt = await res.text().catch(() => '');
        if (/401|403|unauthorized|invalid.api.key/i.test(txt)) {
          return { ok: false, latencyMs: ms(), error: `Auth error: ${txt.substring(0, 120)}` };
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All Cohere models failed' };
    }

    // ── OpenRouter ───────────────────────────────────────────────────────────
    if (provider === 'openrouter') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({
        apiKey: keyValue,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://kruthika.ai', 'X-Title': 'Kruthika AI Chat' },
      });
      // Probe the same ranked list used by chat, including any admin override.
      // Keep this short so the health check stays quick and avoids reasoning-only
      // models unless the higher-ranked direct-chat models are unavailable.
      const FREE_PROBE = (await getModelList('openrouter', PROVIDER_DEFAULT_MODELS.openrouter)).slice(0, 4);
      for (const model of FREE_PROBE) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          const txt = r.choices[0]?.message?.content;
          if (txt) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('invalid') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
          // Provider error on this model — try next
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All OpenRouter free models unavailable' };
    }

    // ── Groq cascade ─────────────────────────────────────────────────────────
    if (provider === 'groq') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: 'https://api.groq.com/openai/v1' });
      const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      for (const model of MODELS) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          if (r.choices[0]?.message?.content) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All Groq models failed' };
    }

    // ── Mistral cascade ───────────────────────────────────────────────────────
    if (provider === 'mistral') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: 'https://api.mistral.ai/v1' });
      const MODELS = ['mistral-small-2603', 'open-mistral-nemo'];
      for (const model of MODELS) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          if (r.choices[0]?.message?.content) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All Mistral models failed' };
    }

    // ── DeepSeek cascade ──────────────────────────────────────────────────────
    if (provider === 'deepseek') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: 'https://api.deepseek.com' });
      const MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat'];
      for (const model of MODELS) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          if (r.choices[0]?.message?.content) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
          // Insufficient balance / model not found — try next
        }
      }
      return { ok: false, latencyMs: ms(), error: 'DeepSeek: all models failed (check account balance)' };
    }

    // ── NVIDIA cascade ────────────────────────────────────────────────────────
    if (provider === 'nvidia') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: 'https://integrate.api.nvidia.com/v1' });
      const MODELS = ['openai/gpt-oss-120b', 'meta/llama-3.3-70b-instruct'];
      for (const model of MODELS) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          if (r.choices[0]?.message?.content) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All NVIDIA models failed' };
    }

    // ── GitHub Models ─────────────────────────────────────────────────────────
    if (provider === 'github') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: 'https://models.github.ai/inference' });
      const MODELS = ['openai/gpt-4o-mini', 'meta/Llama-3.3-70B-Instruct'];
      for (const model of MODELS) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          if (r.choices[0]?.message?.content) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All GitHub models failed / rate limited' };
    }

    // ── Cerebras ──────────────────────────────────────────────────────────────
    if (provider === 'cerebras') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: 'https://api.cerebras.ai/v1' });
      const MODELS = ['gemma-4-31b', 'gpt-oss-120b'];
      for (const model of MODELS) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          if (r.choices[0]?.message?.content) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('402') || msg.includes('403') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All Cerebras models failed' };
    }

    // ── SambaNova ─────────────────────────────────────────────────────────────
    if (provider === 'sambanova') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: 'https://api.sambanova.ai/v1' });
      const MODELS = ['Meta-Llama-3.3-70B-Instruct', 'gemma-4-31B-it'];
      for (const model of MODELS) {
        try {
          const r = await client.chat.completions.create({ model, messages: PROBE_MSG, max_tokens: PROBE_TOKENS });
          if (r.choices[0]?.message?.content) return { ok: true, latencyMs: ms(), modelUsed: model };
        } catch (e: any) {
          const msg = (e.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
            return { ok: false, latencyMs: ms(), error: e.message?.substring(0, 200) };
          }
        }
      }
      return { ok: false, latencyMs: ms(), error: 'All SambaNova models failed' };
    }

    return { ok: false, latencyMs: ms(), error: `Unknown provider: ${provider}` };
  } catch (err: any) {
    return { ok: false, latencyMs: ms(), error: (err.message ?? String(err)).substring(0, 300) };
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { provider } = body;

  if (!provider || !PROVIDER_ORDER.includes(provider as AIProvider)) {
    return NextResponse.json({ error: 'Valid provider name required' }, { status: 400 });
  }

  // Resolve key: prefer first active DB key, fall back to env
  let keyValue: string | null = null;
  try {
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      `SELECT key_value FROM api_keys WHERE provider = ? AND status = 'active' ORDER BY priority ASC LIMIT 1`,
      [provider]
    );
    if (Array.isArray(rows) && rows[0]?.key_value) {
      keyValue = rows[0].key_value;
    }
  } catch {}

  if (!keyValue) {
    const envVar = ENV_KEY_MAP[provider as AIProvider];
    if (envVar) keyValue = process.env[envVar] ?? null;
  }

  if (!keyValue) {
    return NextResponse.json({ ok: false, latencyMs: 0, error: 'No key configured for this provider' });
  }

  // 15 s timeout per provider test
  const testPromise = probeProvider(provider as AIProvider, keyValue);
  const timeoutPromise = new Promise<{ ok: false; latencyMs: number; error: string }>(resolve =>
    setTimeout(() => resolve({ ok: false, latencyMs: 15000, error: 'Timeout after 15s' }), 15000)
  );

  const result = await Promise.race([testPromise, timeoutPromise]);
  return NextResponse.json(result);
}
