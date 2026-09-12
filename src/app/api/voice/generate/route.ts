/**
 * POST /api/voice/generate
 *
 * Generates a Sarvam AI voice message from text.
 *
 * Security layers:
 *  1. Session ownership comes ONLY from the verified signed session cookie
 *     (server-issued, HttpOnly) — a client-supplied `sessionId` in the body is
 *     never trusted as ownership proof.
 *  2. The verified session id is validated against kruthika_user_memory in DB
 *     (proves caller is a real user session, not an anonymous scraper)
 *  3. Shared MySQL-backed IP rate limiting: 15 requests/hour per IP
 *     (cross-instance, not bypassable by rotating the in-memory bucket)
 *  4. Per-session daily quota: 8 voice generates/day (tracked in DB via
 *     voice_quota table, survives restarts, not bypassable client-side)
 *
 * Request body:
 *   { text: string, language?: string, mood?: VoiceMood }
 *
 * Response:
 *   { audioDataUrl: string, durationSeconds: number, languageCode: string }
 *   or { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateVoice } from '@/lib/voice-router';
import type { VoiceMood } from '@/lib/elevenlabs-tts';
import { getMysqlClient } from '@/lib/mysql-client';
import { resolveSessionIdentity } from '@/lib/session-identity';
import { checkRateLimit } from '@/lib/shared-rate-limiter';

// ── Session validation (DB-backed, proves real user) ─────────────────────────
// Short cache so repeated rapid calls don't hit DB each time
const SESSION_CACHE_TTL = 5 * 60 * 1000; // 5 min
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
    // DB is down — fail closed, do not allow unauthenticated access
    return { valid: false, dbDown: true };
  }
}

// ── Per-session daily quota (DB-backed) ───────────────────────────────────────
const SESSION_DAILY_LIMIT = 8;
const MAX_VOICE_TEXT_CHARS = 1500;

async function checkAndIncrementQuota(sessionId: string): Promise<{ allowed: boolean; dbDown: boolean }> {
  try {
    const db = await getMysqlClient();
    const today = new Date().toISOString().slice(0, 10);

    const [updateResult]: any = await db.query(
      `UPDATE voice_quota SET count = count + 1
       WHERE session_id = ? AND quota_date = ? AND count < ?`,
      [sessionId, today, SESSION_DAILY_LIMIT]
    );

    if ((updateResult?.affectedRows ?? 0) === 1) {
      return { allowed: true, dbDown: false };
    }

    const [insertResult]: any = await db.query(
      `INSERT INTO voice_quota (session_id, quota_date, count)
       SELECT ?, ?, 1 FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM voice_quota WHERE session_id = ? AND quota_date = ? AND count >= ?
       )`,
      [sessionId, today, sessionId, today, SESSION_DAILY_LIMIT]
    );

    if ((insertResult?.affectedRows ?? 0) === 1) {
      return { allowed: true, dbDown: false };
    }

    return { allowed: false, dbDown: false };
  } catch {
    return { allowed: false, dbDown: true };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 0. Session ownership: the ONLY authoritative identity is the verified
  //    signed session cookie. A client-supplied `sessionId` in the body is
  //    never trusted as ownership proof (audit issue 15).
  const identity = resolveSessionIdentity(request);
  const sessionId = identity.sid;
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session not recognized' },
      { status: 403 }
    );
  }
  const clientIp = identity.ip;

  // 1. IP rate limit — shared MySQL-backed limiter (cross-instance), 15/hr.
  const ipRl = await checkRateLimit('voice_ip', clientIp, { limit: 15, windowMs: 60 * 60 * 1000 });
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: 'Too many voice requests — try again later', retryAfter: Math.ceil(ipRl.retryAfterMs / 1000) },
      { status: 429 }
    );
  }

  // 2. Parse body
  let body: { text?: string; language?: string; mood?: VoiceMood };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text, language, mood } = body;

  // 3. Validate session is real (DB check, cached) — keyed on the verified sid.
  const { valid: validSession, dbDown: sessionDbDown } = await isValidSession(sessionId);
  if (sessionDbDown) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable — please try again shortly' },
      { status: 503 }
    );
  }
  if (!validSession) {
    return NextResponse.json(
      { error: 'Session not recognized' },
      { status: 403 }
    );
  }

  // 4. Text validation
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (text.length > MAX_VOICE_TEXT_CHARS) {
    return NextResponse.json(
      { error: `text too long — maximum ${MAX_VOICE_TEXT_CHARS} characters` },
      { status: 400 }
    );
  }

  // 5. Per-session daily quota
  const { allowed: withinQuota, dbDown: quotaDbDown } = await checkAndIncrementQuota(sessionId);
  if (quotaDbDown) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable — please try again shortly' },
      { status: 503 }
    );
  }
  if (!withinQuota) {
    return NextResponse.json(
      { error: 'Daily voice limit reached — come back tomorrow' },
      { status: 429 }
    );
  }

  // 6. Generate TTS (ElevenLabs → Sarvam fallback via voice-router)
  const result = await generateVoice(text.trim(), language ?? 'hi', 250, mood);

  if (!result) {
    return NextResponse.json(
      { error: 'Voice generation failed — API unavailable or all keys exhausted' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    audioDataUrl:    result.audioDataUrl,
    durationSeconds: result.durationSeconds,
    languageCode:    result.languageCode ?? null,
    provider:        result.provider,
  });
}
