/**
 * OneSignal External ID derivation.
 *
 * OneSignal identifies a device's user with a stable `external_user_id`
 * (external_id). We bind that identity to the server-issued signed session
 * cookie: the SAME browser session always resolves to the SAME external id,
 * and the server can compute the identical value later for cron targeting —
 * without storing anything extra.
 *
 * The value is derived via HMAC-SHA256 using COOKIE_SECRET so an external id
 * cannot be forged for a session id the client does not own (the session id
 * itself is a 256-bit random value, but defense-in-depth is cheap here).
 *
 * OneSignal external_user_id is limited to 64 chars — our format fits easily.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Max length OneSignal allows for external_user_id. */
const EXTERNAL_ID_MAX_LEN = 64;

/**
 * Derive the stable OneSignal external_id for a verified session id.
 * Deterministic: same input always produces the same output.
 */
export function deriveExternalId(sessionId: string): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing COOKIE_SECRET in production');
    }
    if (process.env.DEV_ONLY !== 'true') {
      throw new Error('Missing COOKIE_SECRET — set DEV_ONLY=true for local development only');
    }
  }
  const hash = createHmac('sha256', secret || 'dev-cookie-secret-local-only')
    .update(`onesignal:external_id:${sessionId}`)
    .digest('hex');
  const prefix = 'kruthika_';
  return (prefix + hash).slice(0, EXTERNAL_ID_MAX_LEN);
}

/** Validate that a client-supplied external id matches the derived value. */
export function isValidExternalId(sessionId: string, externalId: string | null | undefined): boolean {
  if (!externalId || typeof externalId !== 'string') return false;
  const expected = deriveExternalId(sessionId);
  if (externalId.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(externalId, 'utf8'), Buffer.from(expected, 'utf8'));
}
