/**
 * POST /api/admin/sarvam-keys/test
 *
 * Tests a specific Sarvam key by making a real TTS call.
 * Body: { id: number, source: 'db' | 'env' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { verifyAdminSession } from '@/lib/admin-auth';

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const TEST_TEXT = 'हाँ, बताओ!'; // Short test phrase — minimal credit usage

// const MAX_KEYS = 20; // reserved for future key-count enforcement

function keyHash(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0') + key.slice(-6);
}

async function callTTS(apiKey: string): Promise<{ ok: true; latencyMs: number; durationSeconds: number } | { ok: false; error: string }> {
  const start = Date.now();
  try {
    const res = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        inputs: [TEST_TEXT],
        target_language_code: 'hi-IN',
        speaker: 'neha',
        model: 'bulbul:v3',
        pace: 1.0,
        speech_sample_rate: 22050,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const latencyMs = Date.now() - start;

    if (res.status === 402) return { ok: false, error: 'Credits exhausted (402) — key is used up' };
    if (res.status === 401) return { ok: false, error: 'Invalid API key (401)' };
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }

    const data = await res.json();
    const audioB64: string | undefined = data?.audios?.[0];
    if (!audioB64) return { ok: false, error: 'No audio in response' };

    // Estimate duration from WAV bytes
    const byteLength = Math.floor((audioB64.length * 3) / 4);
    const durationSeconds = parseFloat(((byteLength - 44) / (22050 * 2)).toFixed(1));

    return { ok: true, latencyMs, durationSeconds: Math.max(0, durationSeconds) };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Unknown error' };
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id, source } = body;

  if (!id || !source) return NextResponse.json({ error: 'id and source are required' }, { status: 400 });

  try {
    let apiKey: string | null = null;

    if (source === 'env') {
      const slot = Math.abs(parseInt(id, 10));
      const envVal = process.env[`SARVAM_API_KEY_${slot}`]?.trim();
      if (!envVal) return NextResponse.json({ ok: false, error: 'Env key not found' });
      apiKey = envVal;
    } else if (source === 'db') {
      const db = await getMysqlClient();
      const [rows]: any = await db.query(
        'SELECT key_value, is_exhausted FROM sarvam_admin_keys WHERE id = ?', [id]
      );
      if (!(rows as any[]).length) return NextResponse.json({ ok: false, error: 'Key not found' });
      const row = (rows as any[])[0];
      if (row.is_exhausted) return NextResponse.json({ ok: false, error: 'Key is already marked exhausted' });
      apiKey = row.key_value as string;
    } else {
      return NextResponse.json({ error: 'source must be db or env' }, { status: 400 });
    }

    if (!apiKey) return NextResponse.json({ ok: false, error: 'Could not retrieve key value' });

    const resolvedKey: string = apiKey;
    const result = await callTTS(resolvedKey);

    // If 402, mark exhausted in the right table
    if (!result.ok && result.error.includes('402')) {
      const db = await getMysqlClient();
      if (source === 'env') {
        const hash = keyHash(resolvedKey);
        await db.query(
          `INSERT INTO sarvam_api_keys (key_hash, key_prefix, is_exhausted, exhausted_at)
           VALUES (?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE is_exhausted = 1, exhausted_at = NOW()`,
          [hash, resolvedKey.slice(0, 6) + '…' + resolvedKey.slice(-8)]
        ).catch(() => {});
      } else {
        await db.query(
          'UPDATE sarvam_admin_keys SET is_exhausted = 1, exhausted_at = NOW() WHERE id = ?', [id]
        ).catch(() => {});
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
