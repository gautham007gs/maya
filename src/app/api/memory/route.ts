import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import SecureCookieManager, { MEMORY_COOKIE } from '@/lib/secure-cookies';
import { deriveExternalId, isValidExternalId } from '@/lib/onesignal-identity';
import { checkRateLimit } from '@/lib/shared-rate-limiter';
import { getClientIp } from '@/lib/session-identity';
import { getQuotaDateString } from '@/lib/quota-date';
import {
  resolveInstallationIdentity,
  attachInstallationCookie,
} from '@/lib/installation-identity';
import { MAX_MEMORY_BODY_BYTES, validateMemoryPayload } from '@/lib/memory-validation';

// Schema is managed by database migrations — no DDL on request paths.

export async function GET(request: NextRequest) {
  // The ONLY authoritative identity is the server-issued signed session cookie.
  // Client-supplied identifiers (query params, bodies) are never trusted.
  let sid = SecureCookieManager.getVerifiedSessionId(request.cookies.get(MEMORY_COOKIE)?.value);
  let hadValidCookie = Boolean(sid);

  if (!sid) {
    // No valid session yet — mint a fresh server-side identity and persist it
    // as a signed cookie. This new ID has no stored memory yet.
    sid = SecureCookieManager.generateSessionId();
  }

  try {
    const db = await getMysqlClient();
    // SELECT memory row. Some older DB installs may be missing the
    // onesignal_external_id column; detect that and add it if needed so the
    // read operation doesn't fail. This is safe to run on every request but
    // only executes DDL when the column is absent.
    const ensureOnesignalColumn = async () => {
      try {
        const [colRes]: any = await db.query(
          `SELECT COUNT(1) as c FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'kruthika_user_memory'
             AND COLUMN_NAME = 'onesignal_external_id'`
        );
        const count = Number(colRes?.[0]?.c ?? colRes?.c ?? 0);
        if (count === 0) {
          await db.query("ALTER TABLE kruthika_user_memory ADD COLUMN onesignal_external_id VARCHAR(64) DEFAULT NULL");
          console.info('[Memory] Added missing column onesignal_external_id to kruthika_user_memory');
        }
      } catch (e) {
        console.warn('[Memory] ensureOnesignalColumn failed', e instanceof Error ? e.message : e);
      }
    };

    // Try the select; on known missing-column error, create the column then retry.
    let rows: any;
    try {
      const res: any = await db.query(
        `SELECT user_name, facts, topics, relationship_level, message_count,
                shared_moments, consecutive_days, first_interaction,
                emotional_patterns, attachment_lean, onesignal_player_id,
                onesignal_external_id, last_active_date,
                session_count, sent_images, sent_voices, user_language, typing_style, episodic_events
         FROM kruthika_user_memory WHERE session_id = ? LIMIT 1`,
        [sid]
      );
      rows = res[0];
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('Unknown column') || (err && err.code === 'ER_BAD_FIELD_ERROR')) {
        console.warn('[Memory] missing column onesignal_external_id — attempting to add it');
        await ensureOnesignalColumn();
        const res2: any = await db.query(
          `SELECT user_name, facts, topics, relationship_level, message_count,
                  shared_moments, consecutive_days, first_interaction,
                  emotional_patterns, attachment_lean, onesignal_player_id,
                  onesignal_external_id, last_active_date,
                  session_count, sent_images, sent_voices, user_language, typing_style, episodic_events
           FROM kruthika_user_memory WHERE session_id = ? LIMIT 1`,
          [sid]
        );
        rows = res2[0];
      } else {
        throw err;
      }
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      const installation = resolveInstallationIdentity(request);
      const empty = NextResponse.json({
        ok: true,
        memory: null,
        externalId: deriveExternalId(installation.iid),
      });
      if (!hadValidCookie) {
        SecureCookieManager.setCookie(empty, MEMORY_COOKIE, sid, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
      }
      if (!installation.hadValidCookie) {
        attachInstallationCookie(empty, installation.iid);
      }
      return empty;
    }
    const row = rows[0];
    const parse = (v: any) => (v ? (typeof v === 'string' ? JSON.parse(v) : v) : null);

    const installation = resolveInstallationIdentity(request);
    const respBody = {
      ok: true,
      // Stable OneSignal external id — tied to long-lived installation cookie (MED-039).
      externalId: deriveExternalId(installation.iid),
      memory: {
        userName:           row.user_name,
        facts:              parse(row.facts) ?? [],
        topics:             parse(row.topics) ?? [],
        relationshipLevel:  parseFloat(row.relationship_level) || 0.1,
        messageCount:       row.message_count || 0,
        sharedMoments:      parse(row.shared_moments) ?? [],
        consecutiveDays:    row.consecutive_days || 0,
        firstInteraction:   row.first_interaction ? Number(row.first_interaction) : null,
        emotionalPatterns:  parse(row.emotional_patterns) ?? [],
        attachmentLean:     row.attachment_lean ?? null,
        onesignalPlayerId:  row.onesignal_player_id ?? null,
        onesignalExternalId: row.onesignal_external_id ?? null,
        lastActiveDate:     row.last_active_date ?? null,
        sessionCount:       row.session_count || 1,
        sentImages:         parse(row.sent_images) ?? [],
        sentVoices:         parse(row.sent_voices) ?? [],
        userLanguage:       row.user_language ?? null,
        typingStyle:        row.typing_style ?? null,
        episodicEvents:     parse(row.episodic_events) ?? [],
      }
    };

    const res = NextResponse.json(respBody);
    if (!hadValidCookie) {
      SecureCookieManager.setCookie(res, MEMORY_COOKIE, sid, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    }
    if (!installation.hadValidCookie) {
      attachInstallationCookie(res, installation.iid);
    }
    return res;
  } catch (err: any) {
    console.error('[Memory] GET error:', err?.message);
    return NextResponse.json({ ok: false, memory: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rl = await checkRateLimit('memory_post', clientIp, { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_MEMORY_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
    }

    const rawText = await request.text();
    if (rawText.length > MAX_MEMORY_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const validated = validateMemoryPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
    }

    const {
      userName, facts, topics, relationshipLevel, messageCount,
      sharedMoments, consecutiveDays, firstInteraction,
      emotionalPatterns, attachmentLean, onesignalPlayerId, onesignalExternalId, sessionCount,
      sentImages, sentVoices, userLanguage, typingStyle, episodicEvents,
    } = validated.data;

    let sidVal = SecureCookieManager.getVerifiedSessionId(request.cookies.get(MEMORY_COOKIE)?.value);
    let hadValidCookie = Boolean(sidVal);

    if (!sidVal) {
      sidVal = SecureCookieManager.generateSessionId();
    }

    let storedExternalId: string | null = null;
    if (onesignalExternalId && isValidExternalId(sidVal, onesignalExternalId)) {
      storedExternalId = onesignalExternalId;
    } else if (onesignalExternalId) {
      console.warn('[Memory] Ignoring mismatched onesignalExternalId from client.');
    }

    const db = await getMysqlClient();

    const today = getQuotaDateString();

    await db.query(
      `INSERT INTO kruthika_user_memory
         (session_id, user_name, facts, topics, relationship_level, message_count,
          shared_moments, consecutive_days, first_interaction,
          emotional_patterns, attachment_lean, onesignal_player_id, onesignal_external_id, last_active_date,
          session_count, sent_images, sent_voices, user_language, typing_style, episodic_events)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_name            = COALESCE(VALUES(user_name), user_name),
         facts                = VALUES(facts),
         topics               = VALUES(topics),
         relationship_level   = GREATEST(COALESCE(relationship_level, 0.1), VALUES(relationship_level)),
         message_count        = GREATEST(COALESCE(message_count, 0), VALUES(message_count)),
         shared_moments       = VALUES(shared_moments),
         consecutive_days     = GREATEST(COALESCE(consecutive_days, 0), VALUES(consecutive_days)),
         first_interaction    = COALESCE(first_interaction, VALUES(first_interaction)),
         emotional_patterns   = VALUES(emotional_patterns),
         attachment_lean      = COALESCE(VALUES(attachment_lean), attachment_lean),
         onesignal_player_id  = COALESCE(VALUES(onesignal_player_id), onesignal_player_id),
         onesignal_external_id = COALESCE(VALUES(onesignal_external_id), onesignal_external_id),
         last_active_date     = VALUES(last_active_date),
         session_count        = GREATEST(COALESCE(session_count, 1), VALUES(session_count)),
         sent_images          = COALESCE(VALUES(sent_images), sent_images),
         sent_voices          = COALESCE(VALUES(sent_voices), sent_voices),
         user_language        = COALESCE(VALUES(user_language), user_language),
         typing_style         = COALESCE(VALUES(typing_style), typing_style),
         episodic_events      = COALESCE(VALUES(episodic_events), episodic_events),
         last_active          = CURRENT_TIMESTAMP`,
      [
        sidVal,
        userName || null,
        JSON.stringify(facts || []),
        JSON.stringify(topics || []),
        Math.max(0, Math.min(1, relationshipLevel || 0.1)),
        messageCount || 0,
        JSON.stringify(sharedMoments || []),
        consecutiveDays || 0,
        firstInteraction || null,
        JSON.stringify(emotionalPatterns || []),
        attachmentLean || null,
        onesignalPlayerId || null,
        storedExternalId,
        today,
        Math.max(1, sessionCount || 1),
        JSON.stringify(sentImages || []),
        JSON.stringify(sentVoices || []),
        userLanguage || null,
        typingStyle || null,
        JSON.stringify(episodicEvents || []),
      ]
    );
    const res = NextResponse.json({ ok: true });
    if (!hadValidCookie) {
      SecureCookieManager.setCookie(res, MEMORY_COOKIE, sidVal, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    }
    return res;
  } catch (err: any) {
    console.error('[Memory] POST error:', err?.message);
    return NextResponse.json({ ok: false });
  }
}

/**
 * GET /api/memory/warm-users
 * Internal: returns users with a registered OneSignal external id active in
 * last 48h for personalized proactive sends.
 * Secured by CRON_SECRET in Authorization header.
 */
export async function PUT(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getMysqlClient();
    const hoursBack = 48;
    const [rows]: any = await db.query(
      `SELECT session_id, user_name, topics, relationship_level, message_count,
              attachment_lean, onesignal_external_id, last_active_date
       FROM kruthika_user_memory
       WHERE onesignal_external_id IS NOT NULL
         AND last_active >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY last_active DESC
       LIMIT 200`,
      [hoursBack]
    );
    const parse = (v: any) => (v ? (typeof v === 'string' ? JSON.parse(v) : v) : []);
    const users = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      sessionId:         r.session_id,
      userName:          r.user_name,
      topics:            parse(r.topics),
      relationshipLevel: parseFloat(r.relationship_level) || 0.1,
      messageCount:      r.message_count || 0,
      attachmentLean:    r.attachment_lean,
      externalId:        r.onesignal_external_id,
      lastActiveDate:    r.last_active_date,
    }));
    return NextResponse.json({ ok: true, users });
  } catch (err: any) {
    console.error('[Memory] PUT/warm-users error:', err?.message);
    return NextResponse.json({ ok: false, users: [] });
  }
}
