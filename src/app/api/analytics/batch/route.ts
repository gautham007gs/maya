
/**
 * POST /api/analytics/batch
 *
 * Accepts batches of analytics events from the client tracker.
 *
 * Security hardening (audit issues 5/13/15):
 *  - Session identity is taken ONLY from the signed HttpOnly session cookie.
 *    Client-supplied `sessionId`/`userId` fields are ignored entirely, so an
 *    attacker can no longer mint arbitrary identifiers to pollute analytics.
 *  - Timestamps are assigned server-side. Client `timestamp` is never used.
 *  - A strict event-type allowlist + per-field validation (type checks, size
 *    caps) reject garbage / oversized / unknown events.
 *  - Batches are capped in size and total payload; strings are capped.
 *  - A shared MySQL-backed rate limiter guards the endpoint across instances.
 *  - A short-lived dedup set drops replayed identical events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, db } from '@/lib/dbServer';
import MaximumSecurity from '@/lib/enhanced-security';
import { APISecurityManager } from '@/lib/api-security';
import { getMysqlClient } from '@/lib/mysql-client';
import { resolveOrMintSessionIdentity, attachSessionCookie } from '@/lib/session-identity';
import { sanitizeAnalyticsEvent, SanitizedAnalyticsEvent } from '@/lib/analytics-events';
import { redactMessageLogContent } from '@/lib/message-log-privacy';
import { getQuotaDateString } from '@/lib/quota-date';
import { checkRateLimit } from '@/lib/shared-rate-limiter';
import { mapWithConcurrency } from '@/lib/process-concurrency';

const MAX_BATCH_SIZE = 100;
const MAX_EVENT_COUNT_PER_MINUTE = 300;
const MAX_BATCH_BODY_BYTES = 200_000;

// Short-lived in-memory dedup for identical event fingerprints.
// Prevents replaying the same sanitized event many times within a window.
const dedupWindowMs = 60_000;
const dedupSeen = new Map<string, number>();
function isDuplicate(fingerprint: string): boolean {
  const now = Date.now();
  const last = dedupSeen.get(fingerprint);
  if (last && now - last < dedupWindowMs) return true;
  dedupSeen.set(fingerprint, now);
  if (dedupSeen.size > 10_000) {
    for (const [k, v] of dedupSeen) {
      if (now - v > dedupWindowMs) dedupSeen.delete(k);
    }
  }
  return false;
}

function fingerprint(event: SanitizedAnalyticsEvent, sid: string): string {
  return `${sid}:${event.eventType}:${JSON.stringify(event.eventData)}`;
}

export async function POST(request: NextRequest) {
  // Apply MAXIMUM security protection
  const enhancedSecurityCheck = await MaximumSecurity.secureRequest(request);
  if (enhancedSecurityCheck) return enhancedSecurityCheck;

  // Apply API security (bot detection, method check) — in-memory rate limit
  // kept as a cheap first gate; the shared DB limiter below is authoritative.
  const securityCheck = await APISecurityManager.secureAPIRoute(request, {
    allowedMethods: ['POST'],
    rateLimit: { requests: 200, window: 60000 }
  });
  if (securityCheck) return securityCheck;

  // Session identity comes exclusively from the signed cookie.
  const identity = resolveOrMintSessionIdentity(request);
  const sid = identity.sid!;
  const clientIp = identity.ip;

  try {
    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Reject oversized bodies before parsing.
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BATCH_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const rawText = await request.text();
    if (rawText.length > MAX_BATCH_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const events = Array.isArray(body?.events) ? body.events : [];
    if (events.length === 0) {
      return NextResponse.json({ error: 'No events provided' }, { status: 400 });
    }
    if (events.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: 'Batch size too large. Maximum 100 events per request.' }, { status: 400 });
    }

    // Validate + sanitise every event. Unknown/invalid events are dropped;
    // if MORE than 30% of the batch is garbage we treat it as a suspicious
    // attempt and reject the whole batch.
    const sanitized: SanitizedAnalyticsEvent[] = [];
    let rejected = 0;
    for (const raw of events) {
      const result = sanitizeAnalyticsEvent(raw);
      if (result.ok) sanitized.push(result.event);
      else rejected++;
    }
    if (sanitized.length === 0) {
      return NextResponse.json({ error: 'No valid events in batch' }, { status: 400 });
    }
    if (rejected / events.length > 0.3) {
      console.warn(`[Analytics] Rejected suspicious batch: ${rejected}/${events.length} invalid events from ip=${clientIp}`);
      return NextResponse.json({ error: 'Too many invalid events' }, { status: 400 });
    }

    // Weighted rate limit by sanitized event count (not HTTP request count).
    const eventWeight = Math.max(1, sanitized.length);
    const [ipRl, sessionRl] = await Promise.all([
      checkRateLimit('anl_ip', clientIp, { limit: MAX_EVENT_COUNT_PER_MINUTE, windowMs: 60_000, incrementBy: eventWeight }),
      checkRateLimit('anl_session', sid, { limit: MAX_EVENT_COUNT_PER_MINUTE, windowMs: 60_000, incrementBy: eventWeight }),
    ]);
    if (!ipRl.allowed || !sessionRl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: Math.max(ipRl.retryAfterMs, sessionRl.retryAfterMs) },
        { status: 429 }
      );
    }

    // Dedup identical events (same session, type, payload within 60s).
    const unique = sanitized.filter((e) => !isDuplicate(fingerprint(e, sid)));

    const results = await mapWithConcurrency(unique, 4, (event) => processEvent(event, sid, clientIp));

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    const response = NextResponse.json({
      success: true,
      processed: unique.length,
      successful,
      failed,
      sessionId: sid
    });
    attachSessionCookie(response, identity);
    return response;

  } catch (error: any) {
    console.error('Batch Analytics Error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch events' },
      { status: 500 }
    );
  }
}

async function processEvent(event: SanitizedAnalyticsEvent, sid: string, _clientIp: string) {
  const { eventType, eventData, timestamp } = event;
  const chatId = (eventData.chatId as string) || 'kruthika_chat';
  const nowIso = new Date(timestamp).toISOString();
  const today = getQuotaDateString(new Date(timestamp));

  try {
    switch (eventType) {
      case 'message_sent':
        const messageId = (eventData.messageId as string) || `msg_${timestamp}`;
        await db
          .from('messages_log')
          .insert({
            message_id: messageId.substring(0, 64),
            sender_type: (eventData.senderType as string) || 'user',
            chat_id: chatId,
            text_content: redactMessageLogContent((eventData.content as string) || ''),
            has_image: Boolean(eventData.hasImage),
            created_at: nowIso
          });

        await recordDailyActivity(sid, today, chatId).then(isNew =>
          updateDailyAnalytics(today, eventData.senderType === 'user' ? 1 : 0, 0, 0, isNew ? 1 : 0)
        );
        break;

      case 'session_start':
      case 'session_resume':
        await db
          .from('user_sessions')
          .upsert({
            session_id: sid.substring(0, 64),
            user_pseudo_id: sid.substring(0, 64),
            device_type: (eventData.deviceType as string) || null,
            browser: (eventData.browser as string) || null,
            country_code: (eventData.countryCode as string) || null,
            timezone: (eventData.timezone as string) || null,
            referrer: (eventData.referrer as string) || null,
            is_active: true,
            started_at: nowIso,
          });

        await db
          .from('daily_activity_log')
          .upsert({
            user_pseudo_id: sid.substring(0, 64),
            activity_date: today,
            chat_id: chatId
          });
        await recordDailyActivity(sid, today, chatId).then(isNew =>
          updateDailyAnalytics(today, 0, 0, 0, isNew ? 1 : 0)
        );
        break;

      case 'ad_interaction':
        // Record RAW interactions only. Revenue is NEVER derived from client
        // events — a client can trivially forge view/click counts, so any
        // $/impression formula would fabricate accounting truth. The revenue
        // source of record is Adsterra's own reporting API (/api/adsterra).
        await db
          .from('ad_interactions')
          .insert({
            session_id: sid.substring(0, 64),
            ad_type: ((eventData.adType as string) || 'unknown').substring(0, 128),
            ad_network: ((eventData.network as string) || 'unknown').substring(0, 128),
            action_type: eventData.action === 'click' ? 'click' : 'view',
            page_path: ((eventData.page as string) || '').substring(0, 500),
            user_country: ((eventData.countryCode as string) || null),
            device_type: ((eventData.deviceType as string) || null),
          });
        break;

      case 'image_shared':
        await db
          .from('messages_log')
          .insert({
            message_id: ((eventData.messageId as string) || `img_${timestamp}`).substring(0, 64),
            sender_type: 'user',
            chat_id: chatId,
            text_content: 'Image shared',
            has_image: true,
            created_at: nowIso
          });
        break;

      case 'page_view':
        await db.from('page_views').insert({
          session_id: sid.substring(0, 64),
          page_path: ((eventData.page as string) || '/').substring(0, 200),
          page_title: ((eventData.title as string) || '').substring(0, 200),
          referrer: ((eventData.referrer as string) || '').substring(0, 300)
        });
        break;

      case 'user_action':
        if (eventData.action === 'performance_metric') {
          const dur = (eventData.details as any)?.duration as number | undefined;
          await updateDailyAnalytics(today, 0, 0, dur || 0);
        }
        if (eventData.action === 'ai_response_time') {
          const duration = Number(eventData.durationMs);
          if (Number.isFinite(duration) && duration > 0 && duration < 10 * 60 * 1000) {
            try {
              const client = await getMysqlClient();
              await client.query(
                'INSERT INTO ai_response_times (session_id, duration_ms, created_at) VALUES (?, ?, ?)',
                [sid.substring(0, 64), Math.round(duration), nowIso],
              );
            } catch (err) {
              console.warn('[analytics/batch] ai_response_times insert skipped:', err instanceof Error ? err.message : err);
            }
          }
        }
        break;

      case 'cookie_consent':
        await db.from('cookie_consents').insert({
          session_id: sid.substring(0, 64),
          necessary: Boolean(eventData.necessary),
          analytics: Boolean(eventData.analytics),
          advertising: Boolean(eventData.advertising),
          personalization: Boolean(eventData.personalization),
          ai_learning: Boolean(eventData.aiLearning),
          intimacy_level: Boolean(eventData.intimacyLevel)
        });
        break;

      case 'journey_step':
        await db.from('user_journey_steps').insert({
          session_id: sid.substring(0, 64),
          step_name: ((eventData.stepName as string) || '').substring(0, 100),
          step_order: Number(eventData.stepOrder) || 0,
          page_path: ((eventData.pagePath as string) || '').substring(0, 200)
        });
        break;

      case 'session_update':
        await db
          .from('user_sessions')
          .update({
            ended_at: (eventData.endedAt as string) || null,
            duration_seconds: Number(eventData.durationSeconds) || 0,
            is_active: Boolean(eventData.isActive)
          })
          .eq('session_id', sid.substring(0, 64));
        break;

      case 'session_message_increment':
        await db.from('_rpc').rpc('increment_session_messages', {
          session_id_param: sid.substring(0, 64)
        });
        break;

      case 'user_analytics':
        await db.from('user_analytics').upsert({
          session_id: sid.substring(0, 64),
          user_pseudo_id: sid.substring(0, 64),
          country_code: (eventData.countryCode as string) || null,
          country_name: (eventData.countryName as string) || null,
          timezone: (eventData.timezone as string) || null,
          device_type: (eventData.deviceType as string) || null,
          browser: (eventData.browser as string) || null,
          os: (eventData.os as string) || null,
          screen_resolution: (eventData.screenResolution as string) || null,
          language: (eventData.language as string) || null
        });
        break;

      default:
        break;
    }

    return { success: true, eventType };
  } catch (error: any) {
    console.error(`Error processing ${eventType}:`, error);
    throw error;
  }
}

async function recordDailyActivity(userId: string, date: string, chatId: string): Promise<boolean> {
  try {
    const client = await getMysqlClient();
    const [result]: any = await client.query(
      `INSERT IGNORE INTO daily_activity_log (user_pseudo_id, activity_date, chat_id)
       VALUES (?, ?, ?)`,
      [userId.substring(0, 64), date, chatId]
    );
    return (result?.affectedRows ?? 0) === 1;
  } catch {
    return false;
  }
}

async function updateDailyAnalytics(date: string, messageCount: number = 0, errorCount: number = 0, responseTime: number = 0, newDau: number = 0) {
  try {
    const client = await getMysqlClient();
    await client.query(
      `INSERT INTO daily_analytics (date, dau, message_count, error_count, response_time, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         dau           = dau + VALUES(dau),
         message_count = message_count + VALUES(message_count),
         error_count   = error_count + VALUES(error_count),
         response_time = IF(VALUES(response_time) > 0, VALUES(response_time), response_time),
         updated_at    = VALUES(updated_at)`,
      [date, newDau, messageCount, errorCount, responseTime, new Date().toISOString().slice(0, 19).replace('T', ' ')]
    );
  } catch (error) {
    console.error('Error updating daily analytics:', error);
  }
}
