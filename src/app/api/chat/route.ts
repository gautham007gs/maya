import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/ai/flows/emotional-state-simulation';
import SecurityValidator from '@/lib/security-utils';
import { APISecurityManager } from '@/lib/api-security';
import MaximumSecurity from '@/lib/enhanced-security';
import { getMysqlClient } from '@/lib/mysql-client';
import { enforceChatQuotas } from '@/lib/chat-quota';
import { getClientIp, resolveOrMintSessionIdentity, attachSessionCookie } from '@/lib/session-identity';

// ── Load user memory from DB (best-effort; never blocks the chat response) ──
async function loadUserMemory(sessionId: string): Promise<{
  memoryContext: string;
  relationshipLevel: number;
  sentImages: string[];
  sentVoices: string[];
  userLanguage: string | null;
  episodicEvents: any[];
  userMemorySnapshot?: any;
  userTypeData?: any;
}> {
  try {
    if (!sessionId || sessionId.length > 64) {
      return { memoryContext: '', relationshipLevel: 0.1, sentImages: [], sentVoices: [], userLanguage: null, episodicEvents: [] };
    }
    const db = await getMysqlClient();
    const [rows]: any = await db.query(
      `SELECT user_name, facts, topics, relationship_level, message_count,
              shared_moments, attachment_lean, sent_images, sent_voices, user_language, episodic_events,
              consecutive_days, first_interaction, last_active_date, session_count
       FROM kruthika_user_memory WHERE session_id = ? LIMIT 1`,
      [sessionId]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return { memoryContext: '', relationshipLevel: 0.1, sentImages: [], sentVoices: [], userLanguage: null, episodicEvents: [] };
    }
    const row = rows[0];
    const parse = (v: any) => (v ? (typeof v === 'string' ? JSON.parse(v) : v) : null);
    const facts: string[]   = parse(row.facts)  ?? [];
    const topics: string[]  = parse(row.topics) ?? [];
    const episodicEvents: any[] = parse(row.episodic_events) ?? [];
    const parts: string[] = [];
    if (row.user_name)        parts.push(`name:${row.user_name}`);
    if (topics.length)        parts.push(`topics:${topics.slice(0, 5).join(',')}`);
    if (facts.length)         parts.push(`facts:${facts.slice(0, 5).join('; ')}`);
    if (row.attachment_lean)  parts.push(`vibe:${row.attachment_lean}`);
    if (row.message_count > 0) parts.push(`msgs:${row.message_count}`);
    if (row.user_language)     parts.push(`lang:${row.user_language}`);
    if (episodicEvents.length) parts.push(`recent:${episodicEvents.slice(-2).map((e: any) => e.event || e).join('; ')}`);

    const relLevel = Math.max(0, Math.min(1, parseFloat(row.relationship_level) || 0.1));
    const msgCount = parseInt(row.message_count, 10) || 0;
    const consecutiveDays = parseInt(row.consecutive_days, 10) || 0;

    return {
      memoryContext: parts.join(' | '),
      relationshipLevel: relLevel,
      sentImages: parse(row.sent_images) ?? [],
      sentVoices: parse(row.sent_voices) ?? [],
      userLanguage: row.user_language ?? null,
      episodicEvents,
      userMemorySnapshot: {
        messageCount: msgCount,
        consecutiveDays,
        firstInteraction: row.first_interaction ? Number(row.first_interaction) : null,
        lastActiveDate: row.last_active_date ?? null,
        sessionCount: parseInt(row.session_count, 10) || 1,
        relationshipLevel: relLevel,
        attachmentLean: row.attachment_lean ?? null,
        userName: row.user_name ?? null,
      },
      userTypeData: {
        dailyMessageCount: msgCount,
        relationshipLevel: relLevel,
        totalDaysActive: consecutiveDays,
      },
    };
  } catch {
    return { memoryContext: '', relationshipLevel: 0.1, sentImages: [], sentVoices: [], userLanguage: null, episodicEvents: [] };
  }
}

// ---------------------------------------------------------------------------
// Helper: IST-aware time-of-day bucket
// ---------------------------------------------------------------------------
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night' {
  const istHour = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    }),
    10,
  );
  if (istHour >= 5  && istHour < 12) return 'morning';
  if (istHour >= 12 && istHour < 17) return 'afternoon';
  if (istHour >= 17 && istHour < 21) return 'evening';
  if (istHour >= 21 && istHour < 24) return 'night';
  return 'late_night'; // 0–4
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // ── Security gate ────────────────────────────────────────────────────────
  const securityCheck = await APISecurityManager.secureAPIRoute(request, {
    allowedMethods: ['POST'],
    rateLimit: { requests: 60, window: 60000 }
  });
  if (securityCheck) return securityCheck;

  try {
    // Cap the raw body BEFORE JSON parsing — an attacker can otherwise send a
    // multi-megabyte body that must be fully parsed just to reach the history
    // bounds check. 64 KB comfortably fits message (≤2000) + 20×600 history.
    const MAX_BODY_BYTES = 64 * 1024;
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }
    const body = JSON.parse(rawBody);

    const postValidation = await MaximumSecurity.validatePostData(request, body);
    if (!postValidation.valid) {
      return NextResponse.json(
        { error: postValidation.error || 'Invalid request' },
        { status: 400 }
      );
    }

    const { message, conversationId, history, sessionLanguage, lite } = postValidation.sanitized;

    const validationResult = SecurityValidator.validateMessageInput(
      message,
      conversationId || 'anonymous',
      getClientIp(request),
    );

    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: validationResult.reason },
        { status: 400 }
      );
    }

    const sanitizedMessage = validationResult.sanitized!;

    // ── Identity: verified server-issued session cookie ONLY ────────────────
    // `conversationId` is a client-supplied UI label for conversation history —
    // it must NEVER select whose memory is loaded. The authoritative session id
    // comes from the signed cookie (minted by /api/memory on first contact).
    // An unverifiable session simply has no stored memory.
    const identity = resolveOrMintSessionIdentity(request);
    const sessionId = identity.sid || '';

    const clientIp = identity.ip;
    const quota = await enforceChatQuotas({
      sessionKey: sessionId || `ip:${clientIp}`,
      ip: clientIp,
    });
    if (!quota.allowed) {
      const headers: Record<string, string> = {};
      if (quota.retryAfterMs != null) headers['Retry-After'] = String(Math.ceil(quota.retryAfterMs / 1000));
      return NextResponse.json({ error: quota.reason }, { status: quota.status, headers });
    }

    // ── Load real user memory from DB (keyed by verified session id) ─────────
    const memory = await loadUserMemory(sessionId);

    // ── Bounded chat history ─────────────────────────────────────────────────
    // `history` is client-supplied — enforce strict, cheap bounds BEFORE any
    // per-item processing. Rejecting oversized arrays prevents a memory/CPU
    // abuse vector (an attacker sending a multi-million-element array would
    // otherwise force a full-array .filter() before the .slice(-20)).
    const historyResult = SecurityValidator.sanitizeHistory(history);
    if (!historyResult.valid) {
      return NextResponse.json(
        { error: historyResult.reason || 'Invalid history' },
        { status: 400 }
      );
    }
    const recentInteractions = historyResult.sanitized ?? [];

    const sessionMsgCount = recentInteractions.filter(m => m.startsWith('User:')).length;

    // ── Full brain simulation ─────────────────────────────────────────────────
    const aiResult = await generateResponse({
      userMessage:         sanitizedMessage,
      timeOfDay:           getTimeOfDay(),
      mood:                'present',
      recentInteractions,
      memoryContext:       memory.memoryContext,
      relationshipLevel:   memory.relationshipLevel,
      sessionId:           sessionId || undefined,
      alreadySentImages:   memory.sentImages,
      alreadySentVoices:   memory.sentVoices,
      userLanguage:        (sessionLanguage && typeof sessionLanguage === 'string' ? sessionLanguage : null) || memory.userLanguage || undefined,
      sessionMsgCount,
      userMemorySnapshot:  memory.userMemorySnapshot,
      userTypeData:        memory.userTypeData,
      lite:                Boolean(lite),
    } as any);

    let responseText: string;
    if (typeof aiResult.response === 'string') {
      responseText = aiResult.response;
    } else if (Array.isArray(aiResult.response) && aiResult.response.length > 0) {
      responseText = aiResult.response[0];
    } else {
      responseText = 'hey!';
    }

    console.log(`[Chat API] success in ${Date.now() - startTime}ms lite=${Boolean(lite)}`);
    const jsonResponse = NextResponse.json({
      response: responseText,
      multiPartResponse: aiResult.multiPartResponse || null,
      success: true,
      shouldSendMedia: aiResult.shouldSendMedia || false,
      mediaType: aiResult.mediaType || null,
      proactiveImageUrl: aiResult.proactiveImageUrl || null,
      followUpMessage: aiResult.followUpMessage || null,
      shouldSendVoice: (aiResult as any).shouldSendVoice || false,
      voiceUrl: (aiResult as any).voiceUrl || null,
      voiceText: (aiResult as any).voiceText || null,
    });
    attachSessionCookie(jsonResponse, identity);
    return jsonResponse;

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Chat API] error:', msg);

    if (msg.includes('No AI keys configured')) {
      return NextResponse.json(
        { error: 'AI not configured. Admin: please add API keys in the Admin Panel.' },
        { status: 503 }
      );
    }
    if (msg.includes('All AI providers')) {
      return NextResponse.json(
        { error: 'AI temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
