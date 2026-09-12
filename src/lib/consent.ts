/**
 * Central consent state — single source of truth for analytics, ads, and personalization.
 */

export const COOKIE_CONSENT_KEY = 'kruthika_cookie_consent_v3';
export const CONSENT_VERSION = 4;
export const CONSENT_TTL_DAYS = 365;

export type ConsentChoice = 'pending' | 'accepted' | 'rejected';

export interface ConsentPreferences {
  version: number;
  choice: ConsentChoice;
  necessary: boolean;
  analytics: boolean;
  advertising: boolean;
  personalization: boolean;
  aiLearning: boolean;
  intimacyLevel: boolean;
  timestamp: string;
  expiresAt: string;
}

const EMPTY: ConsentPreferences = {
  version: CONSENT_VERSION,
  choice: 'pending',
  necessary: true,
  analytics: false,
  advertising: false,
  personalization: false,
  aiLearning: false,
  intimacyLevel: false,
  timestamp: '',
  expiresAt: '',
};

function buildPreferences(choice: ConsentChoice): ConsentPreferences {
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + CONSENT_TTL_DAYS);
  const granted = choice === 'accepted';
  return {
    version: CONSENT_VERSION,
    choice,
    necessary: true,
    analytics: granted,
    advertising: granted,
    personalization: granted,
    aiLearning: granted,
    intimacyLevel: granted,
    timestamp: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

function parseRaw(raw: string | null): ConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences> & { accepted?: boolean };
    if (typeof parsed.version === 'number' && parsed.version !== CONSENT_VERSION) {
      return null;
    }
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      return null;
    }
    if (parsed.choice === 'accepted' || parsed.choice === 'rejected' || parsed.choice === 'pending') {
      return { ...EMPTY, ...parsed, necessary: true };
    }
    if (typeof parsed.accepted === 'boolean') {
      return buildPreferences(parsed.accepted ? 'accepted' : 'rejected');
    }
    if (parsed.analytics !== undefined || parsed.advertising !== undefined) {
      const granted = Boolean(parsed.analytics || parsed.advertising);
      return { ...EMPTY, ...parsed, choice: granted ? 'accepted' : 'rejected', necessary: true };
    }
  } catch {
    return null;
  }
  return null;
}

export function getConsentFromStorage(): ConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const ls = parseRaw(localStorage.getItem(COOKIE_CONSENT_KEY));
    if (ls) return ls;
    const match = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${COOKIE_CONSENT_KEY}=`));
    if (!match) return null;
    const val = decodeURIComponent(match.split('=')[1] || '');
    if (val === '1') return buildPreferences('accepted');
    if (val === '0') return buildPreferences('rejected');
    return parseRaw(val);
  } catch {
    return null;
  }
}

export function hasConsentDecision(): boolean {
  const c = getConsentFromStorage();
  return c?.choice === 'accepted' || c?.choice === 'rejected';
}

export function isAdvertisingAllowed(): boolean {
  return getConsentFromStorage()?.advertising === true;
}

export function isAnalyticsAllowed(): boolean {
  return getConsentFromStorage()?.analytics === true;
}

/** Server-side consent read from request cookies (no window/localStorage). */
export function getConsentFromRequestCookies(
  getCookie: (name: string) => string | undefined,
): ConsentPreferences | null {
  const raw = getCookie(COOKIE_CONSENT_KEY);
  if (!raw) return null;
  if (raw === '1') return buildPreferences('accepted');
  if (raw === '0') return buildPreferences('rejected');
  try {
    return parseRaw(decodeURIComponent(raw));
  } catch {
    return parseRaw(raw);
  }
}

export function isAdvertisingAllowedOnRequest(
  getCookie: (name: string) => string | undefined,
): boolean {
  return getConsentFromRequestCookies(getCookie)?.advertising === true;
}

export function saveConsent(choice: ConsentChoice): ConsentPreferences {
  const prefs = buildPreferences(choice);
  if (typeof window === 'undefined') return prefs;
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
    const exp = new Date(prefs.expiresAt);
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(JSON.stringify(prefs))}; expires=${exp.toUTCString()}; path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch { /* ignore */ }
  return prefs;
}

export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    document.cookie = `${COOKIE_CONSENT_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  } catch { /* ignore */ }
}
