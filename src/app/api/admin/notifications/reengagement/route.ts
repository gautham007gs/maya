import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getMysqlClient } from '@/lib/mysql-client';

const ONESIGNAL_API = 'https://api.onesignal.com';

// Re-engagement templates with honest AI-companion framing. Kruthika is a
// conversational AI — copy reflects real capabilities (continue the chat, new
// conversation starters, saved history) instead of fake feelings, urgency or
// guilt-tripping.
const RE_ENGAGEMENT_TEMPLATES = [
  {
    id: 'continue_chat',
    label: '💬 Continue Chat',
    title: 'Pick up where you left off 💬',
    message: 'Your saved chat is ready whenever you have a minute. Continue the thread or start something new.',
    emoji: '💬',
  },
  {
    id: 'voice_message',
    label: '🎵 Voice Chat',
    title: 'Try a different kind of chat 🎙️',
    message: 'Send a voice message and see how Kruthika responds. Your conversation is ready when you are.',
    emoji: '🎵',
  },
  {
    id: 'thinking_of_you',
    label: '💭 Catch Up',
    title: 'A small moment for yourself 💭',
    message: 'Your conversation history is still here. Drop in for a thoughtful question, a quick laugh, or a quiet chat.',
    emoji: '💭',
  },
  {
    id: 'new_conversation',
    label: '✨ New Conversation',
    title: 'What should we talk about next? ✨',
    message: 'Try a fresh topic with Kruthika today — ask for an idea, share what is on your mind, or continue an old thread.',
    emoji: '✨',
  },
  {
    id: 'saved_history',
    label: '🔖 Saved History',
    title: 'Your conversation is still here 🔖',
    message: 'Nothing you saved in your chat has gone anywhere. Open it when you feel like picking up the conversation.',
    emoji: '🔖',
  },
  {
    id: 'quiet_moment',
    label: '🟢 Available',
    title: 'A quiet chat is available 🟢',
    message: 'No pressure to stay — Kruthika is here if a few minutes of conversation would feel good.',
    emoji: '🟢',
  },
  {
    id: 'new_story',
    label: '✨ New Ideas',
    title: 'One new idea to explore ✨',
    message: 'Open Kruthika for a fresh conversation starter, or bring any thought you have been carrying today.',
    emoji: '✨',
  },
  {
    id: 'check_in',
    label: '💬 Check In',
    title: 'How are you doing today? 💬',
    message: 'Take a minute to check in with yourself. Kruthika can help you reflect, brainstorm, or simply listen.',
    emoji: '💬',
  },
  {
    id: 'goodnight',
    label: '🌙 Good Night',
    title: 'A softer way to end the day 🌙',
    message: 'If your mind is still busy, open a calm conversation with Kruthika before you put your phone down.',
    emoji: '🌙',
  },
  {
    id: 'good_morning',
    label: '☀️ Good Morning',
    title: 'Start with one good question ☀️',
    message: 'Open Kruthika for a fresh thought, a little planning, or an easy conversation to begin the day.',
    emoji: '☀️',
  },
];

// ── Audience presets ─────────────────────────────────────────────────────────
// type 'all'        → every subscribed device (included_segments: ['Subscribed Users'])
// type 'inactive'   → users whose last OneSignal session was > inactiveHours ago
// type 'external_ids' → exact set of external_ids (stable kruthika_<hash> ids)
// type 'tags'       → OneSignal tag filters
type Audience =
  | { type: 'all' }
  | { type: 'inactive'; inactiveHours: number }
  | { type: 'external_ids'; externalIds: string[] }
  | { type: 'tags'; tags: { key: string; relation: string; value: string }[] };

const DEFAULT_AUDIENCE: Audience = { type: 'all' };

function parseAudience(raw: any): Audience {
  if (!raw || typeof raw !== 'object') return DEFAULT_AUDIENCE;
  switch (raw.type) {
    case 'inactive': {
      const hours = Number(raw.inactiveHours) || 24;
      return { type: 'inactive', inactiveHours: Math.max(1, Math.min(720, hours)) };
    }
    case 'external_ids': {
      const ids = Array.isArray(raw.externalIds)
        ? raw.externalIds.filter((i: any) => typeof i === 'string' && i.trim()).map((i: string) => i.trim())
        : [];
      return { type: 'external_ids', externalIds: ids };
    }
    case 'tags': {
      const tags = Array.isArray(raw.tags) ? raw.tags.filter((t: any) => t?.key && t?.value) : [];
      return { type: 'tags', tags };
    }
    case 'all':
    default:
      return { type: 'all' };
  }
}

/** Approximate the number of recipients an audience would reach. */
async function estimateAudience(audience: Audience): Promise<{ count: number | null; source: string }> {
  switch (audience.type) {
    case 'all': {
      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
      const restApiKey = process.env.ONESIGNAL_REST_API_KEY ?? '';
      if (!appId || !restApiKey) return { count: null, source: 'onesignal-unconfigured' };
      try {
        const res = await fetch(`${ONESIGNAL_API}/apps/${appId}`, {
          headers: { Authorization: `Key ${restApiKey}` },
          next: { revalidate: 60 },
        });
        if (!res.ok) return { count: null, source: 'onesignal-error' };
        const data = await res.json();
        return { count: data.messageable_players ?? data.players ?? null, source: 'onesignal-players' };
      } catch {
        return { count: null, source: 'onesignal-error' };
      }
    }
    case 'inactive': {
      // Estimate from our own memory table: users who registered with OneSignal
      // (stored external id) and haven't been active recently.
      try {
        const db = await getMysqlClient();
        const [rows]: any = await db.query(
          `SELECT COUNT(*) AS c FROM kruthika_user_memory
           WHERE onesignal_external_id IS NOT NULL
             AND last_active < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
          [audience.inactiveHours]
        );
        const count = Array.isArray(rows) ? Number(rows[0]?.c) || 0 : null;
        return { count, source: 'db-memory-approx' };
      } catch {
        return { count: null, source: 'db-error' };
      }
    }
    case 'external_ids':
      return { count: audience.externalIds.length, source: 'explicit-list' };
    case 'tags':
      // OneSignal does not expose a public estimate endpoint for tag filters.
      return { count: null, source: 'unknown-tags' };
  }
}

/** Build the OneSignal targeting block for an audience. */
function buildTargeting(audience: Audience): Record<string, any> {
  switch (audience.type) {
    case 'inactive':
      return {
        filters: [{ field: 'last_session', relation: '>', hours_ago: String(audience.inactiveHours) }],
      };
    case 'external_ids':
      return {
        include_aliases: { external_id: audience.externalIds },
        target_channel: 'push',
      };
    case 'tags':
      return {
        filters: audience.tags.map(t => ({ field: 'tag', key: t.key, relation: t.relation || '=', value: t.value })),
      };
    case 'all':
    default:
      return { included_segments: ['Subscribed Users'], target_channel: 'push' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json({ templates: RE_ENGAGEMENT_TEMPLATES });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { templateId, customTitle, customMessage, imageUrl, iconUrl, url, audience, confirm } = body;

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY ?? '';

    if (!appId || !restApiKey) {
      return NextResponse.json(
        { error: 'OneSignal credentials not configured.' },
        { status: 500 }
      );
    }

    // Find template or use custom
    const template = RE_ENGAGEMENT_TEMPLATES.find(t => t.id === templateId);
    const title = customTitle?.trim() || template?.title || 'Kruthika 💕';
    const message = customMessage?.trim() || template?.message;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const parsedAudience = parseAudience(audience);
    if (parsedAudience.type === 'external_ids' && parsedAudience.externalIds.length === 0) {
      return NextResponse.json({ error: 'Provide at least one external id.' }, { status: 400 });
    }
    if (parsedAudience.type === 'tags' && parsedAudience.tags.length === 0) {
      return NextResponse.json({ error: 'Provide at least one tag filter.' }, { status: 400 });
    }

    const estimate = await estimateAudience(parsedAudience);

    // ── Confirmation gate ──
    // The re-engagement endpoint previously sent to ALL subscribers with a
    // single click. Now it requires an explicit confirmation: a first call
    // returns the estimated audience size; the actual send only happens when
    // `confirm: true` is supplied.
    if (confirm !== true) {
      return NextResponse.json({
        needsConfirmation: true,
        audience: parsedAudience.type,
        estimatedRecipients: estimate.count,
        estimateSource: estimate.source,
        message: `Estimated ${estimate.count ?? 'unknown'} recipient(s). Re-submit with "confirm": true to send.`,
      });
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun').replace(/\/$/, '');
    const targetUrl = url?.trim() || `${siteUrl}/maya-chat`;

    const payload: Record<string, any> = {
      app_id: appId,
      ...buildTargeting(parsedAudience),
      target_channel: 'push',
      headings: { en: title },
      contents: { en: message },
      url: targetUrl,
      web_push_topic: 'kruthika_reengagement',
    };

    if (imageUrl?.trim()) {
      payload.big_picture = imageUrl.trim();
      payload.chrome_web_image = imageUrl.trim();
    }

    if (iconUrl?.trim()) {
      payload.chrome_web_icon = iconUrl.trim();
      payload.firefox_icon = iconUrl.trim();
    }

    const response = await fetch(`${ONESIGNAL_API}/notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${restApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      const errMsg = Array.isArray(result.errors)
        ? result.errors.join(', ')
        : result.error ?? 'Failed to send';
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      notificationId: result.id,
      recipients: result.recipients ?? 0,
      templateUsed: template?.label ?? 'Custom',
      audience: parsedAudience.type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
