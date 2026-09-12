/**
 * Analytics event validation & sanitisation.
 *
 * Previously the /api/analytics/batch endpoint trusted client-supplied event
 * types, timestamps, session ids and arbitrary payload fields, which allowed
 * a single attacker to:
 *   - write arbitrary user-supplied values into analytics tables (pollution)
 *   - mint fake session/user identifiers at will
 *   - backdate events and skew DAU / revenue aggregations
 *
 * This module enforces, server-side:
 *   - a strict event-type allowlist (unknown types are rejected)
 *   - a schema for each allowed type with per-field type checks + size caps
 *   - server-side timestamps (client `timestamp` is ignored)
 *   - session identifiers that are ALWAYS derived from the verified session
 *     cookie, never from the request body
 */

const MAX_STRING = 500;
const MAX_SESSION_ID = 64;

export interface SanitizedAnalyticsEvent {
  eventType: string;
  eventData: Record<string, unknown>;
  timestamp: number;
}

/** Allowed event types — anything else is a suspicious/bogus event. */
export const ALLOWED_EVENT_TYPES = new Set<string>([
  'message_sent',
  'session_start',
  'session_resume',
  'session_update',
  'session_message_increment',
  'ad_interaction',
  'image_shared',
  'page_view',
  'user_action',
  'cookie_consent',
  'journey_step',
  'user_analytics',
]);

/** Numeric size cap for a single string field. */
export function capString(v: unknown, max = MAX_STRING): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.substring(0, max);
}

export function capNumber(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function capBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function pickString(data: Record<string, unknown>, keys: string[], max = MAX_STRING): string | undefined {
  for (const k of keys) {
    if (typeof data[k] === 'string' && data[k] !== '') return capString(data[k], max);
  }
  return undefined;
}

/**
 * Validate and sanitise a single raw event.
 * Returns { ok: true, event } when the event is acceptable, or
 * { ok: false, reason } when it must be dropped (and may count as suspicious).
 */
export function sanitizeAnalyticsEvent(raw: any): { ok: true; event: SanitizedAnalyticsEvent } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'event must be an object' };
  }
  const eventType = typeof raw.eventType === 'string' ? raw.eventType.trim() : '';
  if (!eventType) return { ok: false, reason: 'eventType required' };
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return { ok: false, reason: `unknown eventType "${eventType}"` };
  }
  const data = raw.eventData && typeof raw.eventData === 'object' && !Array.isArray(raw.eventData)
    ? raw.eventData as Record<string, unknown>
    : {};

  const ts = Date.now(); // server time — client `timestamp` is never trusted

  // Per-type field validation
  switch (eventType) {
    case 'message_sent': {
      const senderType = pickString(data, ['senderType']);
      if (senderType && senderType !== 'user' && senderType !== 'ai') {
        return { ok: false, reason: 'senderType must be user|ai' };
      }
      const chatId = pickString(data, ['chatId'], 64) || 'kruthika_chat';
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            messageId: pickString(data, ['messageId'], 64),
            senderType,
            chatId,
            content: pickString(data, ['content'], MAX_STRING),
            hasImage: capBool(data['hasImage']),
          },
          timestamp: ts,
        },
      };
    }
    case 'session_start':
    case 'session_resume':
    case 'session_update': {
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            deviceType: pickString(data, ['deviceType'], 30),
            browser: pickString(data, ['browser'], 60),
            countryCode: pickString(data, ['countryCode'], 5),
            timezone: pickString(data, ['timezone'], 60),
            referrer: pickString(data, ['referrer'], 300),
            endedAt: capNumber(data['endedAt'], 0),
            durationSeconds: capNumber(data['durationSeconds'], 0),
            isActive: capBool(data['isActive']),
          },
          timestamp: ts,
        },
      };
    }
    case 'ad_interaction': {
      const action = pickString(data, ['action'], 10);
      if (action && action !== 'view' && action !== 'click') {
        return { ok: false, reason: 'ad action must be view|click' };
      }
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            action,
            network: pickString(data, ['network'], 30) || 'unknown',
            adType: pickString(data, ['adType'], 30) || 'unknown',
          },
          timestamp: ts,
        },
      };
    }
    case 'image_shared':
      return {
        ok: true,
        event: {
          eventType,
          eventData: { messageId: pickString(data, ['messageId'], 64) },
          timestamp: ts,
        },
      };
    case 'page_view':
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            page: pickString(data, ['page'], 200) || '/',
            title: pickString(data, ['title'], 200),
            referrer: pickString(data, ['referrer'], 300),
          },
          timestamp: ts,
        },
      };
    case 'user_action': {
      const action = pickString(data, ['action'], 50);
      if (!action) return { ok: false, reason: 'user_action.action required' };
      const details = data['details'] && typeof data['details'] === 'object' && !Array.isArray(data['details'])
        ? data['details'] as Record<string, unknown>
        : {};
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            action,
            durationMs: capNumber(data['durationMs'], 0, 10 * 60 * 1000),
            details: { duration: capNumber(details['duration'], 0, 10 * 60 * 1000) },
          },
          timestamp: ts,
        },
      };
    }
    case 'cookie_consent':
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            necessary: capBool(data['necessary']),
            analytics: capBool(data['analytics']),
            advertising: capBool(data['advertising']),
            personalization: capBool(data['personalization']),
            aiLearning: capBool(data['aiLearning']),
            intimacyLevel: capBool(data['intimacyLevel']),
          },
          timestamp: ts,
        },
      };
    case 'journey_step':
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            stepName: pickString(data, ['stepName'], 100),
            stepOrder: capNumber(data['stepOrder'], 0, 100000),
            pagePath: pickString(data, ['pagePath'], 200),
          },
          timestamp: ts,
        },
      };
    case 'user_analytics':
      return {
        ok: true,
        event: {
          eventType,
          eventData: {
            countryCode: pickString(data, ['countryCode'], 5),
            countryName: pickString(data, ['countryName'], 80),
            timezone: pickString(data, ['timezone'], 60),
            deviceType: pickString(data, ['deviceType'], 30),
            browser: pickString(data, ['browser'], 60),
            os: pickString(data, ['os'], 40),
            screenResolution: pickString(data, ['screenResolution'], 30),
            language: pickString(data, ['language'], 20),
          },
          timestamp: ts,
        },
      };
    case 'session_message_increment':
      return {
        ok: true,
        event: { eventType, eventData: {}, timestamp: ts },
      };
    default:
      return { ok: false, reason: 'unknown eventType' };
  }
}

export const MAX_SESSION_ID_LEN = MAX_SESSION_ID;
