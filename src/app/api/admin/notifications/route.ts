import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';

const ONESIGNAL_API = 'https://api.onesignal.com';

function getCredentials() {
  return {
    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
    restApiKey: process.env.ONESIGNAL_REST_API_KEY ?? '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      message,
      url,
      segment,
      externalIds,
      tags,
      imageUrl,    // large notification image
      iconUrl,     // small icon (overrides default)
      sendAfter,   // optional ISO 8601 UTC delivery time
    } = body;

    const { appId, restApiKey } = getCredentials();

    if (!appId || !restApiKey) {
      return NextResponse.json(
        {
          error:
            'OneSignal credentials not configured. Set NEXT_PUBLIC_ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY.',
        },
        { status: 500 }
      );
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    let scheduledAt: string | undefined;
    if (sendAfter !== undefined && sendAfter !== null && String(sendAfter).trim()) {
      const parsed = new Date(String(sendAfter));
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Schedule time must be a valid date.' }, { status: 400 });
      }
      if (parsed.getTime() <= Date.now() + 30_000) {
        return NextResponse.json({ error: 'Schedule time must be at least 30 seconds in the future.' }, { status: 400 });
      }
      scheduledAt = parsed.toISOString();
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun').replace(/\/$/, '');
    const targetUrl = url?.trim() || `${siteUrl}/maya-chat`;

    const payload: Record<string, any> = {
      app_id: appId,
      target_channel: 'push',
      headings: { en: title?.trim() || 'Kruthika 💕' },
      contents: { en: message.trim() },
      url: targetUrl,
      web_push_topic: 'kruthika_message',
    };

    // Image support — large image below the notification text
    if (imageUrl?.trim()) {
      payload.big_picture = imageUrl.trim();
      payload.chrome_web_image = imageUrl.trim();
      payload.adm_big_picture = imageUrl.trim();
      payload.amazon_big_picture = imageUrl.trim();
    }

    // Small icon override
    if (iconUrl?.trim()) {
      payload.chrome_web_icon = iconUrl.trim();
      payload.firefox_icon = iconUrl.trim();
    }

    if (scheduledAt) payload.send_after = scheduledAt;

    // Targeting
    if (segment === 'external_ids' && Array.isArray(externalIds) && externalIds.length > 0) {
      payload.include_aliases = { external_id: externalIds };
      payload.target_channel = 'push';
    } else if (segment === 'tags' && Array.isArray(tags) && tags.length > 0) {
      payload.filters = tags.map((t: { key: string; relation: string; value: string }) => ({
        field: 'tag',
        key: t.key,
        relation: t.relation || '=',
        value: t.value,
      }));
    } else {
      payload.included_segments = ['Subscribed Users'];
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
        : result.error ?? 'Failed to send notification';
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      notificationId: result.id,
      recipients: result.recipients ?? 0,
      scheduled: Boolean(scheduledAt),
      scheduledAt: scheduledAt ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appId, restApiKey } = getCredentials();

    if (!appId || !restApiKey) {
      return NextResponse.json({ configured: false, subscribers: 0 });
    }

    const res = await fetch(`${ONESIGNAL_API}/apps/${appId}`, {
      headers: { Authorization: `Key ${restApiKey}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ configured: true, subscribers: 0 });
    }

    const data = await res.json();
    return NextResponse.json({
      configured: true,
      subscribers: data.messageable_players ?? data.players ?? 0,
      appName: data.name ?? '',
    });
  } catch {
    return NextResponse.json({ configured: false, subscribers: 0 });
  }
}
