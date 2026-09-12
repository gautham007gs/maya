/**
 * User Activity Tagging — OneSignal
 *
 * Sets tags on the OneSignal user profile so the cron job can accurately
 * segment users by activity level and target re-engagement messages correctly.
 *
 * Tags set:
 *   last_chat_date  — ISO date of most recent chat (yyyy-MM-dd)
 *   chat_count      — lifetime message count (capped at 9999)
 *   user_type       — 'new' | 'casual' | 'regular' | 'power'
 *   device_type     — 'mobile' | 'tablet' | 'desktop'
 *   language        — 'en' | 'hi' (detected from browser)
 *   subscribed_at   — ISO date of first subscription (set once)
 */

import { setUserTag, getIsInitialized } from '@/lib/onesignal';

/* ─── Storage keys ───────────────────────────────────────── */

const CHAT_COUNT_KEY = 'kruthika_total_chat_count';
const SUBSCRIBED_AT_KEY = 'kruthika_subscribed_at';

/* ─── Helpers ────────────────────────────────────────────── */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w <= 480) return 'mobile';
  if (w <= 1024) return 'tablet';
  return 'desktop';
}

function detectLanguage(): string {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language?.slice(0, 2)?.toLowerCase() ?? 'en';
  return ['hi', 'en', 'ta', 'te', 'kn', 'ml', 'bn', 'mr'].includes(lang) ? lang : 'en';
}

function getUserType(count: number): string {
  if (count <= 5) return 'new';
  if (count <= 20) return 'casual';
  if (count <= 100) return 'regular';
  return 'power';
}

/* ─── Main: track a sent chat message ───────────────────── */

let tagUpdateDebounce: ReturnType<typeof setTimeout> | null = null;

export function trackChatMessage(): void {
  if (typeof window === 'undefined') return;

  // Update local count immediately
  const rawCount = parseInt(localStorage.getItem(CHAT_COUNT_KEY) || '0', 10);
  const newCount = Math.min(rawCount + 1, 9999);
  localStorage.setItem(CHAT_COUNT_KEY, String(newCount));

  // Debounce the OneSignal tag writes (avoid hammering on every keystroke)
  if (tagUpdateDebounce) clearTimeout(tagUpdateDebounce);
  tagUpdateDebounce = setTimeout(async () => {
    if (!getIsInitialized()) return; // Don't attempt if OneSignal isn't ready

    const tags: Record<string, string> = {
      last_chat_date: todayISO(),
      chat_count: String(newCount),
      user_type: getUserType(newCount),
      device_type: detectDevice(),
      language: detectLanguage(),
    };

    // Set subscribed_at once on first ever chat
    if (!localStorage.getItem(SUBSCRIBED_AT_KEY)) {
      const today = todayISO();
      localStorage.setItem(SUBSCRIBED_AT_KEY, today);
      tags.subscribed_at = today;
    }

    // Fire all tag updates in parallel
    await Promise.allSettled(
      Object.entries(tags).map(([key, val]) => setUserTag(key, val))
    );
  }, 2000);
}

/* ─── Set subscription date tag on permission grant ─────── */

export async function trackNotificationSubscribed(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!getIsInitialized()) return;

  const today = todayISO();
  if (!localStorage.getItem(SUBSCRIBED_AT_KEY)) {
    localStorage.setItem(SUBSCRIBED_AT_KEY, today);
  }

  await Promise.allSettled([
    setUserTag('subscribed_at', localStorage.getItem(SUBSCRIBED_AT_KEY) ?? today),
    setUserTag('device_type', detectDevice()),
    setUserTag('language', detectLanguage()),
  ]);
}

/* ─── Set page view tag (call on app load) ───────────────── */

export async function trackPageView(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!getIsInitialized()) return;

  await Promise.allSettled([
    setUserTag('last_seen_date', todayISO()),
    setUserTag('device_type', detectDevice()),
  ]);
}
