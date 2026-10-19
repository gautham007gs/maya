import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { verifyAdminSession } from '@/lib/admin-auth';
import { decryptSecret } from '@/lib/key-encryption';
import { invalidateKeysCache, PROVIDER_META } from '@/ai/multi-provider';

async function testKey(provider: string, keyValue: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  const ms = () => Date.now() - start;
  try {
    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: keyValue });
      // Cascade through models — availability varies; any successful response confirms key validity.
      const GEMINI_PROBE_MODELS = [
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
      for (const model of GEMINI_PROBE_MODELS) {
        try {
          const r = await ai.models.generateContent({
            model,
            contents: 'Reply OK',
            config: { maxOutputTokens: 5 },
          });
          if (r.text) return { ok: true, latencyMs: ms() };
        } catch (e: any) {
          lastErr = e.message?.substring(0, 200) ?? String(e);
          // Auth errors — fail immediately, no point trying other models
          if (/401|403|invalid.api.key|api_key|permission/i.test(lastErr)) throw new Error(lastErr);
          // Model-not-found / quota — try next model
        }
      }
      throw new Error(lastErr || 'All Gemini probe models failed');
    }

    if (provider === 'cohere') {
      // Cohere v2 API
      const res = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'command-r', messages: [{ role: 'user', content: 'Reply OK' }], max_tokens: 5 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 100)}`);
      return { ok: true, latencyMs: ms() };
    }

    if (provider === 'openrouter') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({
        apiKey: keyValue,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://kruthika.ai', 'X-Title': 'Kruthika AI Chat' },
      });
      const r = await client.chat.completions.create({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [{ role: 'user', content: 'Reply OK' }],
        max_tokens: 5,
      });
      if (!r.choices[0]?.message?.content) throw new Error('Empty response');
      return { ok: true, latencyMs: ms() };
    }

    // OpenAI-compatible providers — use PROVIDER_META as single source of truth
    const meta = PROVIDER_META[provider as keyof typeof PROVIDER_META];
    if (meta && meta.baseUrl) {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: keyValue, baseURL: meta.baseUrl });
      const r = await client.chat.completions.create({
        model: meta.model,
        messages: [{ role: 'user', content: 'Reply OK' }],
        max_tokens: 5,
      });
      if (!r.choices[0]?.message?.content) throw new Error('Empty response');
      return { ok: true, latencyMs: ms() };
    }

    return { ok: false, latencyMs: ms(), error: `Unknown provider: ${provider}` };
  } catch (err: any) {
    return { ok: false, latencyMs: ms(), error: err.message?.substring(0, 200) };
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const db = await getMysqlClient();
    const [rows] = await db.query(`SELECT provider, key_value FROM api_keys WHERE id = ?`, [Number(id)]);
    const key = Array.isArray(rows) ? (rows as any[])[0] : null;
    if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    // Decrypt only at point of use — never store/log the plaintext.
    let plainKey: string;
    try {
      plainKey = decryptSecret(key.key_value);
    } catch (decErr: any) {
      return NextResponse.json({ error: `Failed to decrypt key: ${decErr.message}` }, { status: 500 });
    }
    const result = await testKey(key.provider, plainKey);
    if (result.ok) {
      await db.query(`UPDATE api_keys SET status = 'active', error_count = 0, last_error = NULL WHERE id = ?`, [Number(id)]);
      invalidateKeysCache();
    } else {
      await db.query(`UPDATE api_keys SET last_error = ? WHERE id = ?`, [result.error?.substring(0, 500), Number(id)]);
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
