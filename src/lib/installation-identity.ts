/**
 * Long-lived anonymous installation identity (MED-039/040).
 * Separate from the 24h session cookie — stable across session rotations for OneSignal.
 */

import 'server-only';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import SecureCookieManager from './secure-cookies';

export const INSTALLATION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-kruthika_iid' : 'kruthika_iid';

const INSTALLATION_MAX_AGE_SEC = 365 * 24 * 60 * 60;

export function hashIpForQuota(ip: string): string {
  return createHash('sha256').update(`quota:${ip}`).digest('hex').slice(0, 32);
}

export function getVerifiedInstallationId(
  cookieValue: string | undefined | null,
): string | null {
  return SecureCookieManager.getVerifiedSessionId(cookieValue);
}

export function mintInstallationId(): string {
  return SecureCookieManager.generateSessionId();
}

export function resolveInstallationIdentity(request: NextRequest): {
  iid: string;
  hadValidCookie: boolean;
} {
  const existing = getVerifiedInstallationId(
    request.cookies.get(INSTALLATION_COOKIE)?.value,
  );
  if (existing) return { iid: existing, hadValidCookie: true };
  return { iid: mintInstallationId(), hadValidCookie: false };
}

export function attachInstallationCookie(
  response: NextResponse,
  iid: string,
): void {
  SecureCookieManager.setCookie(response, INSTALLATION_COOKIE, iid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: INSTALLATION_MAX_AGE_SEC,
  });
}
