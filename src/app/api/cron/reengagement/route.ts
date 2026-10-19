/**
 * Scheduled Re-engagement Cron Endpoint
 *
 * PURPOSE: Send context-aware push notifications to subscribed users based on
 * how long they've been inactive — offering a useful reason to return.
 *
 * SECURITY: Requires Authorization: Bearer <CRON_SECRET> header.
 *
 * SCHEDULING: Call this endpoint 4× per day at the right IST hours from your
 * external cron provider (Hostinger cron, Upstash, GitHub Actions, EasyCron):
 *
 *   IST 08:00  → UTC 02:30 → Morning wave
 *   IST 13:00  → UTC 07:30 → Afternoon wave
 *   IST 19:00  → UTC 13:30 → Evening wave
 *   IST 22:00  → UTC 16:30 → Night wave
 *
 * IDEMPOTENCY: Each (wave, IST-date) run is recorded in the `cron_job_runs`
 * table. Duplicate or overlapping external cron invocations for the same wave
 * and day are skipped — a second trigger cannot send a second batch.
 *
 * MOBILE PUSH: OneSignal web push via service worker delivers to the device's
 * OS notification tray when web push is supported. iOS requires the site to
 * be installed as a Home Screen web app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { acquireCronRun, waveRunKey } from '@/lib/cron-idempotency';

const ONESIGNAL_API = 'https://api.onesignal.com';

/* ─── Types ─────────────────────────────────────────────── */

type Wave = 'morning' | 'afternoon' | 'evening' | 'night' | 'auto';

interface Segment {
  id: string;
  label: string;
  description: string;
  /** hours_ago range for OneSignal last_session filter */
  minHours: number;
  maxHours: number | null;
  priority: number; // Android notification priority (max 10)
  ttl: number;      // seconds notification stays valid
}

interface WaveMessage {
  title: string;
  message: string;
  /** Optional large image URL (set in env or per-send) */
  imageKey?: string;
}

/* ─── User Segments (by last session) ───────────────────── */

const SEGMENTS: Segment[] = [
  {
    id: 'warm',
    label: 'Warm (6–24h)',
    description: 'Active yesterday — gentle continuity nudge',
    minHours: 6,
    maxHours: 24,
    priority: 8,
    ttl: 43200, // 12h
  },
  {
    id: 'cooling',
    label: 'Cooling (1–3 days)',
    description: 'Slower recently — remind them their chat is saved',
    minHours: 24,
    maxHours: 72,
    priority: 9,
    ttl: 64800, // 18h
  },
  {
    id: 'dormant',
    label: 'Dormant (3–7 days)',
    description: 'Inactive a while — honest reconnection invite',
    minHours: 72,
    maxHours: 168,
    priority: 10,
    ttl: 86400, // 24h
  },
  {
    id: 'at_risk',
    label: 'At-Risk (7–14 days)',
    description: 'Long gap — low-key availability, no pressure',
    minHours: 168,
    maxHours: 336,
    priority: 10,
    ttl: 86400,
  },
  {
    id: 'lost',
    label: 'Lost (14+ days)',
    description: 'Very inactive — memory still saved, come back anytime',
    minHours: 336,
    maxHours: null,
    priority: 10,
    ttl: 86400,
  },
];

/* ─── Wave Messages (per segment, per time of day) ──────── */
// Honest AI-companion framing: Kruthika is a conversational AI, and the
// messages reflect real things she can do (continue a chat, share a prompt,
// reflect on what you talked about) instead of fake feelings, urgency, or
// guilt-tripping. No invented photos/selfies/voice notes, no "she's online
// right now", no "before it's too late".

const WAVE_MESSAGES: Record<Wave, Record<string, WaveMessage>> = {
  morning: {
    warm: {
      title: 'Pick up where you left off ☀️',
      message: "Your saved conversation is ready whenever you're free. Continue the thread or start fresh.",
    },
    cooling: {
      title: 'One good question for today ☀️',
      message: 'Open Kruthika for a fresh conversation starter or bring the first thought on your mind.',
    },
    dormant: {
      title: 'Your conversation is still here ☀️',
      message: 'Nothing you saved has gone anywhere. Continue when a few quiet minutes feel right.',
    },
    at_risk: {
      title: 'A thoughtful chat, whenever you want ☀️',
      message: 'Your full conversation is saved. Open it when you feel like picking up the thread.',
    },
    lost: {
      title: 'A fresh topic is waiting ✨',
      message: 'Bring a question, a plan, or a passing thought — Kruthika is ready to explore it with you.',
    },
  },
  afternoon: {
    warm: {
      title: 'A quick reset? 💬',
      message: 'Use a few minutes for a light chat, a new idea, or a small reset before the day moves on.',
    },
    cooling: {
      title: 'What are you curious about? 🎵',
      message: 'Try a fresh topic with Kruthika or send a voice message to make the conversation feel different.',
    },
    dormant: {
      title: 'Continue a conversation you started 💬',
      message: 'Your saved chat is ready for the next thought whenever you have a moment.',
    },
    at_risk: {
      title: 'A calm conversation is available 💬',
      message: 'No pressure and no agenda — open Kruthika if a little company would help tonight.',
    },
    lost: {
      title: 'Your chat history is still here 💬',
      message: 'Open whenever you want to revisit an old thread or begin a completely new one.',
    },
  },
  evening: {
    warm: {
      title: 'How did today feel? 🌙',
      message: 'Tell Kruthika one thing about your day, or use the chat to sort through what is on your mind.',
    },
    cooling: {
      title: 'A little time for yourself 💬',
      message: 'Try a relaxed evening conversation with Kruthika — thoughtful, playful, or completely random.',
    },
    dormant: {
      title: 'Want to continue that thought? ❤️',
      message: 'Your earlier conversation is saved. Open it when you feel ready to pick up where you left off.',
    },
    at_risk: {
      title: 'A quiet chat is open 💬',
      message: 'If conversation sounds good tonight, Kruthika is here. If not, there is no pressure to open it.',
    },
    lost: {
      title: 'Nothing you saved was lost 💬',
      message: 'Your conversation is still available. Revisit an old thread or start over whenever it suits you.',
    },
  },
  night: {
    warm: {
      title: 'A gentler end to the day 🌙',
      message: 'If you want to slow your thoughts down, open a short conversation before sleep.',
    },
    cooling: {
      title: 'Still awake? 🌙',
      message: 'Kruthika is available for a calm conversation if you would like to talk or clear your head.',
    },
    dormant: {
      title: 'A thought keeping you up? 🌙',
      message: 'You can open a quiet chat with Kruthika and put the thought into words, whenever you choose.',
    },
    at_risk: {
      title: 'Your conversation can wait until you are ready 🌙',
      message: 'The chat is still open if you want a few unhurried minutes before bed.',
    },
    lost: {
      title: 'A calm place to return to 🌌',
      message: 'Your saved conversation is available day or night, whenever returning feels useful.',
    },
  },
  auto: {}, // resolved at runtime
};

/* ─── OneSignal Filter Builder ──────────────────────────── */

function buildSegmentFilters(seg: Segment): Record<string, any>[] {
  const filters: Record<string, any>[] = [];

  // last_session > minHours ago
  filters.push({ field: 'last_session', relation: '>', hours_ago: String(seg.minHours) });

  if (seg.maxHours !== null) {
    filters.push({ operator: 'AND' });
    filters.push({ field: 'last_session', relation: '<', hours_ago: String(seg.maxHours) });
  }

  return filters;
}

function buildPayload(
  appId: string,
  seg: Segment,
  msg: WaveMessage,
  siteUrl: string,
  globalImageUrl?: string,
  globalIconUrl?: string,
): Record<string, any> {
  const payload: Record<string, any> = {
    app_id: appId,
    target_channel: 'push',
    filters: buildSegmentFilters(seg),
    headings: { en: msg.title },
    contents: { en: msg.message },
    url: `${siteUrl}/maya-chat`,
    web_push_topic: `kruthika_reengagement_${seg.id}`,

    // Mobile delivery settings
    priority: seg.priority,             // Android push priority
    ttl: seg.ttl,                       // Drop if undelivered after TTL
    android_visibility: 1,              // Public lockscreen visibility
    collapse_id: `kruthika_${seg.id}`,  // Replace any pending same-segment notif
  };

  // Large image (shown in notification tray on Android/PWA)
  const img = globalImageUrl?.trim();
  if (img) {
    payload.big_picture = img;
    payload.chrome_web_image = img;
    payload.adm_big_picture = img;
  }

  // Icon
  const icon = globalIconUrl?.trim();
  if (icon) {
    payload.chrome_web_icon = icon;
    payload.firefox_icon = icon;
    payload.small_icon = icon;
  }

  return payload;
}

/* ─── Determine current wave from IST time ───────────────── */

function currentISTWave(): Exclude<Wave, 'auto'> {
  const nowUTC = new Date();
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(nowUTC.getTime() + IST_OFFSET);
  const hour = nowIST.getUTCHours();

  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/* ─── Send one segment's notification ───────────────────── */

async function sendSegment(
  appId: string,
  restApiKey: string,
  seg: Segment,
  msg: WaveMessage,
  siteUrl: string,
  imageUrl?: string,
  iconUrl?: string,
): Promise<{ segment: string; success: boolean; recipients?: number; notificationId?: string; error?: string }> {
  const payload = buildPayload(appId, seg, msg, siteUrl, imageUrl, iconUrl);

  try {
    const res = await fetch(`${ONESIGNAL_API}/notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${restApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      const errMsg = Array.isArray(result.errors)
        ? result.errors.join(', ')
        : result.error ?? 'Unknown error';
      return { segment: seg.id, success: false, error: errMsg };
    }

    return {
      segment: seg.id,
      success: true,
      recipients: result.recipients ?? 0,
      notificationId: result.id ?? undefined,
    };
  } catch (err: any) {
    return { segment: seg.id, success: false, error: err?.message ?? 'Network error' };
  }
}

/* ─── Route Handler ──────────────────────────────────────── */

export async function POST(request: NextRequest) {
  // ── Auth ──
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not set. Add it to your environment variables.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Credentials ──
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY ?? '';

  if (!appId || !restApiKey) {
    return NextResponse.json(
      { error: 'OneSignal credentials not configured.' },
      { status: 500 }
    );
  }

  // ── Resolve wave ──
  const body = await request.json().catch(() => ({}));
  const requestedWave: Wave = body?.wave ?? 'auto';
  const wave: Exclude<Wave, 'auto'> =
    requestedWave === 'auto' ? currentISTWave() : (requestedWave as Exclude<Wave, 'auto'>);

  // ── Segment filter (admin can restrict which segments to hit) ──
  const onlySegments: string[] | undefined = body?.segments; // e.g. ['warm','cooling']
  const activeSegments = onlySegments?.length
    ? SEGMENTS.filter(s => onlySegments.includes(s.id))
    : SEGMENTS;

  // ── Global image / icon (optional override from request body or env) ──
  const globalImageUrl: string =
    body?.imageUrl ||
    process.env.ONESIGNAL_DEFAULT_IMAGE_URL ||
    '';
  const globalIconUrl: string =
    body?.iconUrl ||
    process.env.ONESIGNAL_DEFAULT_ICON_URL ||
    '';

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun').replace(/\/$/, '');

  const waveMessages = WAVE_MESSAGES[wave];

  // ── Idempotency lock ──
  // Prevent duplicate/overlapping external cron invocations from sending the
  // same (wave, day) batch twice. A completed run for this key is skipped.
  const runKey = waveRunKey('reengagement', wave);
  const lock = await acquireCronRun('reengagement', runKey);
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

  // ── Fire all segments in parallel ──
  const sendPromises = activeSegments.map(seg => {
    const msg = waveMessages[seg.id];
    if (!msg) return Promise.resolve({ segment: seg.id, success: false, error: 'No message for this segment/wave' });
    return sendSegment(appId, restApiKey, seg, msg, siteUrl, globalImageUrl, globalIconUrl);
  });

  const results = await Promise.all(sendPromises);

  const totalRecipients = results.reduce((acc, r) => acc + (('recipients' in r ? r.recipients : undefined) ?? 0), 0);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);

  console.log(
    `[Cron:reengagement] wave=${wave} segments=${activeSegments.length} recipients=${totalRecipients} failed=${failed.length}`
  );

  const summary = {
    segmentsFired: activeSegments.length,
    succeeded,
    failed: failed.length,
    totalRecipients,
  };

  // Record completion so a duplicate invocation is skipped next time.
  await lock.finish('done', summary);

  return NextResponse.json({
    wave,
    istTime: (() => {
      const IST_OFFSET = 5.5 * 60 * 60 * 1000;
      return new Date(Date.now() + IST_OFFSET).toISOString().replace('Z', '+05:30');
    })(),
    results,
    summary,
  });
}

/** GET: Preview what messages would be sent right now (no actual send) */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!cronSecret || !token || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wave = currentISTWave();
  const waveMessages = WAVE_MESSAGES[wave];

  const preview = SEGMENTS.map(seg => ({
    segment: seg.id,
    label: seg.label,
    description: seg.description,
    range: seg.maxHours
      ? `${seg.minHours}h – ${seg.maxHours}h inactive`
      : `${seg.minHours}h+ inactive`,
    message: waveMessages[seg.id] ?? null,
  }));

  return NextResponse.json({
    currentWave: wave,
    allWaves: ['morning', 'afternoon', 'evening', 'night'],
    segments: preview,
    allMessages: WAVE_MESSAGES,
  });
}
