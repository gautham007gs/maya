/**
 * Central AI request guard.
 *
 * Every path that calls an LLM (AI spend) must pass through here:
 *   1. Identity resolution — verified signed session cookie, or per-IP fallback.
 *   2. Quota enforcement — per-session daily, per-IP hourly, global budget.
 *      All fail CLOSED when the DB is unavailable.
 *   3. Input caps — bounded message length and chat history.
 *
 * Works in BOTH contexts:
 *   - API routes: pass the NextRequest to `resolveAiGuardIdentity(req)`.
 *   - Server actions: omit the request — cookies()/headers() are read from the
 *     Next.js server-action context (Next 16 returns async cookies()/headers()).
 *
 * This closes the "server-action guard bypass" hole: previously
 * sendMessage / generateOfflineMessage / generateProactiveMessage called the AI
 * provider directly without any quota or rate-limit gate.
 */

import 'server-only';
import { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import SecureCookieManager, { MEMORY_COOKIE } from './secure-cookies';
import { getClientIp } from './session-identity';
import { enforceChatQuotas, type ChatQuotaResult } from './chat-quota';
import SecurityValidator from './security-utils';

// Threat-detection regexes mirroring SecurityValidator's private patterns, so
// this guard applies the same SQLi/XSS screening without double-counting
// SecurityValidator's own per-request rate limiter.
const SQLI_PATTERN = /(\b(SELECT|UNION|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|DECLARE)\b|--|\bOR\s+1\s*=\s*1\b)/i;
const XSS_PATTERN = /(<script[\s>]|javascript:|\bon\w+\s*=|<\s*iframe|<object|<embed|expression\s*\(|vbscript:)/i;

export interface AiGuardIdentity {
  /** Verified server-issued session id, or null for anonymous/IP users. */
  sid: string | null;
  /** Resolved client IP (proxy-aware). */
  ip: string;
  /** Quota key: session id when verified, otherwise `ip:<ip>`. */
  sessionKey: string;
}

/**
 * Resolve identity for a request. Pass the NextRequest from an API route, or
 * nothing from a server action (reads the server-action cookie/header context).
 */
export async function resolveAiGuardIdentity(req?: NextRequest): Promise<AiGuardIdentity> {
  if (req) {
    const sid = SecureCookieManager.getVerifiedSessionId(req.cookies.get(MEMORY_COOKIE)?.value);
    const ip = getClientIp(req);
    return { sid, ip, sessionKey: sid || `ip:${ip}` };
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const sid = SecureCookieManager.getVerifiedSessionId(cookieStore.get(MEMORY_COOKIE)?.value);
  const ip = getClientIp({ headers: headerStore });
  return { sid, ip, sessionKey: sid || `ip:${ip}` };
}

/**
 * Enforce all AI spend quotas for one request. Returns allowed=true only when
 * every check passes. Fails CLOSED on DB errors.
 */
export async function enforceAiRequestGuard(identity: AiGuardIdentity): Promise<ChatQuotaResult> {
  return enforceChatQuotas({ sessionKey: identity.sessionKey, ip: identity.ip });
}

/**
 * Validate + bound a user-supplied message. Mirrors the /api/chat route's
 * checks so server actions apply the same input caps before hitting the LLM.
 */
export function validateAiMessage(message: unknown): {
  isValid: boolean;
  reason?: string;
  sanitized?: string;
} {
  if (typeof message !== 'string') {
    return { isValid: false, reason: 'Message must be a string.' };
  }
  if (message.length > 2000) {
    return { isValid: false, reason: 'Message too long. Maximum 2000 characters.' };
  }
  if (message.trim().length === 0) {
    return { isValid: false, reason: 'Message cannot be empty.' };
  }
  if (SQLI_PATTERN.test(message)) {
    return { isValid: false, reason: 'Invalid input detected.' };
  }
  if (XSS_PATTERN.test(message)) {
    return { isValid: false, reason: 'Invalid input detected.' };
  }
  return { isValid: true, sanitized: message };
}

/** Bound a client-supplied chat history array (same rules as the chat route). */
export function sanitizeAiHistory(history: unknown): string[] {
  const result = SecurityValidator.sanitizeHistory(history);
  return result.valid ? (result.sanitized ?? []) : [];
}

export default {
  resolveAiGuardIdentity,
  enforceAiRequestGuard,
  validateAiMessage,
  sanitizeAiHistory,
};
