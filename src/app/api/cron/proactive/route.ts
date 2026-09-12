/**
 * Personalized Proactive Message Cron
 *
 * Sends personalized push notifications to warm users (active in last 48h)
 * using their stored memory — mentions topics they care about, reflects
 * relationship depth. Far more effective than the generic segment messages.
 *
 * For high-RL users, also queues a Sarvam AI voice message (pending_voice_messages)
 * that will play when they next open the chat.
 *
 * TARGETING: users are addressed via OneSignal `external_id` aliases (the
 * deterministic `kruthika_<hash>` id derived from the signed session cookie),
 * NOT raw player IDs. Sends are grouped by identical (title, body) content and
 * issued as ONE batched notification per group (up to 500 aliases each) instead
 * of one API call per user — dramatically fewer requests and no rate-limit delay.
 *
 * IDEMPOTENCY: each (wave, IST-date) run is recorded in `cron_job_runs`.
 * Duplicate external cron invocations for the same wave/day are skipped.
 *
 * Called by the external cron provider (Hostinger cron) at IST 08:00 and 19:00.
 * Secured by Authorization: Bearer <CRON_SECRET>.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { shouldSendCronVoice } from '@/ai/flows/voice-trigger';
import { acquireCronRun, waveRunKey } from '@/lib/cron-idempotency';

const ONESIGNAL_API = 'https://api.onesignal.com';
const ALIAS_BATCH_SIZE = 500;

interface WarmUser {
  sessionId: string;
  userName: string | null;
  topics: string[];
  relationshipLevel: number;
  messageCount: number;
  attachmentLean: string | null;
  externalId: string;
  lastActiveDate: string | null;
}

// ── Message builders (honest AI-companion framing) ───────────────────────────

function buildMorningMessage(user: WarmUser): { title: string; body: string } {
  const name = user.userName ? ` ${user.userName}` : '';
  const rl = user.relationshipLevel;
  const topics = user.topics.slice(0, 2);

  if (rl > 0.7) {
    // Close — personal, warm
    const topicHook = topics.length > 0
      ? `Want to keep talking about ${topics[0]}?`
      : 'Morning — ready for another chat?';
    return {
      title: `Good morning${name} ☀️`,
      body: `${topicHook} I'm here when you are.`,
    };
  } else if (rl > 0.4) {
    // Growing — curious, inviting
    return {
      title: `Morning${name}! ☀️`,
      body: topics.length > 0
        ? `How's the ${topics[0]} thing going? 🙂 Happy to chat whenever.`
        : `How's your morning? It's been a while since we talked.`,
    };
  } else {
    // New — warm but not presumptuous
    return {
      title: 'Good morning! ☀️',
      body: `Kruthika is ready to chat whenever you are. No rush.`,
    };
  }
}

function buildEveningMessage(user: WarmUser): { title: string; body: string } {
  const name = user.userName ? ` ${user.userName}` : '';
  const rl = user.relationshipLevel;
  const topics = user.topics.slice(0, 2);

  if (rl > 0.7) {
    return {
      title: `Hey${name} 🌙`,
      body: topics.length > 0
        ? `I was thinking about what you said about ${topics[0]}. Want to pick it back up?`
        : `How was your day? I'd genuinely like to know.`,
    };
  } else if (rl > 0.4) {
    return {
      title: `Evening${name} 💬`,
      body: `Just finished up — I was wondering how your day went.`,
    };
  } else {
    return {
      title: 'Kruthika is free tonight 🌙',
      body: `Good time to chat if you'd like — the companion is here.`,
    };
  }
}

// ── Send one batched notification to a group of external ids ─────────────────

async function sendToExternalIds(
  appId: string,
  restKey: string,
  externalIds: string[],
  title: string,
  body: string,
  siteUrl: string,
): Promise<{ success: boolean; recipients?: number; error?: string }> {
  try {
    const finalSiteUrl = siteUrl || process.env.NEXT_PUBLIC_BASE_URL || '';
    const res = await fetch(`${ONESIGNAL_API}/notifications`, {
      method: 'POST',
      headers: { Authorization: `Key ${restKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id:                   appId,
        include_aliases: { external_id: externalIds },
        target_channel: 'push',
        headings:                 { en: title },
        contents:                 { en: body },
        url:                      finalSiteUrl ? `${finalSiteUrl.replace(/\/$/, '')}/maya-chat` : undefined,
        priority:                 8,
        ttl:                      43200,
        collapse_id:              'kruthika_proactive',
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      const errMsg = Array.isArray(result.errors)
        ? result.errors.join(', ')
        : result.error ?? 'Unknown error';
      return { success: false, error: errMsg };
    }
    return { success: true, recipients: result.recipients ?? 0 };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Network error' };
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const appId   = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  const restKey = process.env.ONESIGNAL_REST_API_KEY ?? '';
  if (!appId || !restKey) return NextResponse.json({ error: 'OneSignal not configured' }, { status: 500 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun').replace(/\/$/, '');
  const body = await request.json().catch(() => ({}));
  const wave: 'morning' | 'evening' = body?.wave === 'evening' ? 'evening' : 'morning';

  // ── Idempotency lock ──
  const runKey = waveRunKey('proactive', wave);
  const lock = await acquireCronRun('proactive', runKey);
  if (lock.lockUnavailable) {
    return NextResponse.json({ error: 'Cron idempotency lock unavailable', runKey, wave }, { status: 503 });
  }
  if (!lock.acquired) {
    return NextResponse.json({
      skipped: true,
      wave,
      reason: lock.alreadyDone
        ? 'This wave already ran today (idempotent skip).'
        : 'Another run for this wave is still in progress (concurrent skip).',
      runKey,
    });
  }

  // Fetch warm users from DB. Only users who have completed OneSignal
  // registration (a stored external id) are eligible for targeting.
  let users: WarmUser[] = [];
  try {
    const db = await getMysqlClient();
    // Warm users: have a registered external id and were active 4–28h ago
    // (morning) or 2–24h ago (evening).
    const [minH, maxH] = wave === 'morning' ? [4, 28] : [2, 24];
    const [rows]: any = await db.query(
      `SELECT session_id, user_name, topics, relationship_level, message_count,
              attachment_lean, onesignal_external_id, last_active_date
       FROM kruthika_user_memory
       WHERE onesignal_external_id IS NOT NULL
         AND last_active >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND last_active <= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY relationship_level DESC
       LIMIT 500`,
      [maxH, minH]
    );
    const parse = (v: any) => (v ? (typeof v === 'string' ? JSON.parse(v) : v) : []);
    users = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      sessionId:         r.session_id,
      userName:          r.user_name ?? null,
      topics:            parse(r.topics),
      relationshipLevel: parseFloat(r.relationship_level) || 0.1,
      messageCount:      r.message_count || 0,
      attachmentLean:    r.attachment_lean ?? null,
      externalId:        r.onesignal_external_id,
      lastActiveDate:    r.last_active_date ?? null,
    }));
  } catch (err: any) {
    console.error('[Cron:proactive] DB query failed:', err?.message);
    await lock.finish('failed', { error: err?.message });
    return NextResponse.json({ ok: false, error: 'DB error', sent: 0 });
  }

  if (users.length === 0) {
    await lock.finish('done', { users: 0, sent: 0 });
    return NextResponse.json({ ok: true, wave, sent: 0, skipped: 'no warm users with external_id' });
  }

  // ── Build per-user messages and GROUP by identical (title, body) ─────────
  // One notification per group via include_aliases.external_id — this keeps
  // personalization while collapsing many users into a handful of API calls.
  const groups = new Map<string, { title: string; body: string; externalIds: string[]; users: WarmUser[] }>();
  for (const user of users) {
    const msg = wave === 'morning' ? buildMorningMessage(user) : buildEveningMessage(user);
    const key = `${msg.title}\u0000${msg.body}`;
    if (!groups.has(key)) {
      groups.set(key, { title: msg.title, body: msg.body, externalIds: [], users: [] });
    }
    groups.get(key)!.externalIds.push(user.externalId);
    groups.get(key)!.users.push(user);
  }

  // ── Queue Sarvam AI voice messages for high-RL users (before send) ────────
  let voiceQueued = 0;
  const db2 = await getMysqlClient().catch(() => null);
  if (db2) {
    for (const group of groups.values()) {
      for (const user of group.users) {
        if (user.relationshipLevel <= 0) continue;
        const hoursSinceActive = user.lastActiveDate
          ? (Date.now() - new Date(user.lastActiveDate).getTime()) / 3600000
          : 20;
        if (!shouldSendCronVoice(user.relationshipLevel, wave, hoursSinceActive)) continue;

        const voiceText = group.body
          .replace(/[☀️🌙💬😊😌😄💕🥺]/g, '')
          .trim();
        try {
          await db2.query(
            `INSERT IGNORE INTO pending_voice_messages
               (id, session_id, text_content, language_code, message_type)
             VALUES (UUID(), ?, ?, 'hi-IN', ?)
             ON DUPLICATE KEY UPDATE id = id`, // no-op on dup
            [user.sessionId, voiceText, wave === 'morning' ? 'morning_greeting' : 'evening_greeting']
          );
          voiceQueued++;
        } catch (voiceErr: any) {
          if (voiceErr?.code !== 'ER_NO_SUCH_TABLE') {
            console.error('[Cron:proactive] Voice queue error:', voiceErr?.message);
          }
        }
      }
    }
  }

  // ── Send batched notifications (no per-user delay) ────────────────────────
  let sent = 0;
  let batches = 0;
  const errors: string[] = [];
  for (const group of groups.values()) {
    // Chunk aliases so no single request exceeds OneSignal limits.
    for (let i = 0; i < group.externalIds.length; i += ALIAS_BATCH_SIZE) {
      const chunk = group.externalIds.slice(i, i + ALIAS_BATCH_SIZE);
      const result = await sendToExternalIds(appId, restKey, chunk, group.title, group.body, siteUrl);
      batches++;
      if (result.success) sent += chunk.length;
      else if (result.error) errors.push(result.error);
    }
  }

  console.log(`[Cron:proactive] wave=${wave} users=${users.length} groups=${groups.size} batches=${batches} sent=${sent} voiceQueued=${voiceQueued}`);

  const summary = { users: users.length, groups: groups.size, batches, sent, voiceQueued };
  await lock.finish('done', summary);

  return NextResponse.json({ ok: true, wave, ...summary, errors: errors.slice(0, 5) });
}

/** GET: preview what messages would go out now */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!cronSecret || token !== cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const istHour = new Date(Date.now() + IST_OFFSET).getUTCHours();
  const wave = istHour < 15 ? 'morning' : 'evening';

  const exampleUsers: WarmUser[] = [
    { sessionId: 'example_new',   userName: null,      topics: [],                  relationshipLevel: 0.1, messageCount: 5,   attachmentLean: null,      externalId: 'preview', lastActiveDate: null },
    { sessionId: 'example_mid',   userName: 'Rahul',   topics: ['college', 'music'], relationshipLevel: 0.5, messageCount: 80,  attachmentLean: 'anxious', externalId: 'preview', lastActiveDate: null },
    { sessionId: 'example_close', userName: 'Arjun',   topics: ['psychology'],       relationshipLevel: 0.8, messageCount: 300, attachmentLean: 'secure',  externalId: 'preview', lastActiveDate: null },
  ];

  return NextResponse.json({
    wave,
    preview: exampleUsers.map(u => ({
      relationshipLevel: u.relationshipLevel,
      userName: u.userName,
      topics: u.topics,
      ...(wave === 'morning' ? buildMorningMessage(u) : buildEveningMessage(u)),
    })),
  });
}
