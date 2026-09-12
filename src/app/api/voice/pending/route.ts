import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { generateProactiveVoiceRouted } from '@/lib/voice-router';
import { resolveSessionIdentity } from '@/lib/session-identity';
import { checkRateLimit } from '@/lib/shared-rate-limiter';

const SESSION_CACHE_TTL = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 5;
const sessionValidCache = new Map<string, { valid: boolean; ts: number }>();

async function isValidSession(sessionId: string): Promise<{ valid: boolean; dbDown: boolean }> {
  const cached = sessionValidCache.get(sessionId);
  if (cached && Date.now() - cached.ts < SESSION_CACHE_TTL) return { valid: cached.valid, dbDown: false };

  try {
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      'SELECT 1 FROM kruthika_user_memory WHERE session_id = ? LIMIT 1',
      [sessionId]
    );
    const valid = Array.isArray(rows) && rows.length > 0;
    sessionValidCache.set(sessionId, { valid, ts: Date.now() });
    return { valid, dbDown: false };
  } catch {
    return { valid: false, dbDown: true };
  }
}

function retryDelayMinutes(attemptCount: number): number {
  return Math.min(60, Math.pow(2, Math.max(0, attemptCount - 1)));
}

export async function GET(request: NextRequest) {
  const identity = resolveSessionIdentity(request);
  const sessionId = identity.sid;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session not recognized' }, { status: 403 });
  }

  const [ipRl, sessionRl] = await Promise.all([
    checkRateLimit('vpoll_ip', identity.ip, { limit: 30, windowMs: 60_000 }),
    checkRateLimit('vpoll_session', sessionId, { limit: 20, windowMs: 60_000 }),
  ]);
  if (!ipRl.allowed || !sessionRl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { valid: validSession, dbDown: sessionDbDown } = await isValidSession(sessionId);
  if (sessionDbDown) {
    // Pending proactive voice is optional. Do not make a transient database
    // outage look like a broken chat session; polling resumes after recovery.
    return NextResponse.json({ voices: [], deferred: true }, {
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
    });
  }
  if (!validSession) {
    return NextResponse.json({ error: 'Session not recognized' }, { status: 403 });
  }

  try {
    const db = await getMysqlClient();

    const [rows]: any = await db.query(
      `SELECT id, text_content, language_code, message_type, created_at,
              COALESCE(attempt_count, 0) AS attempt_count,
              next_retry_at
       FROM pending_voice_messages
       WHERE session_id = ?
         AND is_delivered = 0
         AND expires_at > NOW()
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         AND COALESCE(attempt_count, 0) < ?
       ORDER BY created_at ASC
       LIMIT 3`,
      [sessionId, MAX_RETRY_ATTEMPTS]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ voices: [] });
    }

    const voices = [];
    for (const row of rows) {
      const ttsResult = await generateProactiveVoiceRouted(row.text_content, row.language_code);

      if (ttsResult) {
        voices.push({
          id: row.id,
          text: row.text_content,
          audioDataUrl: ttsResult.audioDataUrl,
          durationSeconds: ttsResult.durationSeconds,
          languageCode: ttsResult.languageCode,
          messageType: row.message_type,
        });

        await db.query(
          'UPDATE pending_voice_messages SET is_delivered = 1 WHERE id = ?',
          [row.id]
        ).catch((e: Error) => console.error('[VoicePending] Mark delivered error:', e?.message));
      } else {
        const nextAttempt = (row.attempt_count ?? 0) + 1;
        const delayMin = retryDelayMinutes(nextAttempt);
        await db.query(
          `UPDATE pending_voice_messages
           SET attempt_count = ?, last_attempt_at = NOW(),
               next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
           WHERE id = ?`,
          [nextAttempt, delayMin, row.id]
        ).catch((e: Error) => console.error('[VoicePending] Retry schedule error:', e?.message));
        console.warn(`[VoicePending] TTS failed for ${row.id} — retry in ${delayMin}m (attempt ${nextAttempt})`);
      }
    }

    return NextResponse.json({ voices });
  } catch (err: unknown) {
    console.error('[VoicePending] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ voices: [], error: 'Internal error' }, { status: 500 });
  }
}
