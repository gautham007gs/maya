/**
 * Instagram In-App Browser (IAB) detection + compatibility utilities
 *
 * Instagram IAB restrictions:
 *  iOS  — window.open() returns null (blocked), no popunder, limited third-party cookies
 *  Android — Chrome Custom Tabs, more permissive, window.open may open in Chrome
 *
 * Adsterra formats compatible with Instagram IAB:
 *  ✅ Native banners, Standard banners, Social Bar, Direct Link (via anchor)
 *  ❌ Popunder, Interstitial (use window.open / popup APIs)
 */

export type IABPlatform = 'ios' | 'android' | 'other';

/** True if the current browser is Instagram's in-app browser */
export function isInstagramBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Instagram|Threads|IGWeb/i.test(ua);
}

/** True if the current browser is any in-app browser (Instagram, Facebook, Threads, TikTok, Twitter) */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Instagram|Threads|IGWeb|FBAN|FBAV|FB_IAB|FB4A|FBIOS|TwitterAndroid|TikTok|BytedanceWebview/i.test(ua);
}

/** Detect iOS vs Android within IAB */
export function getIABPlatform(): IABPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/**
 * Builds an Android intent:// URL that forces the system to open the URL in Chrome or default browser
 */
export function getAndroidIntentUrl(targetUrl?: string): string {
  if (typeof window === 'undefined') return '';
  const currentUrl = targetUrl || window.location.href;
  const noScheme = currentUrl.replace(/^https?:\/\//i, '');
  // Using action=android.intent.action.VIEW with package=com.android.chrome and fallback URL
  return `intent://${noScheme}#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end;`;
}

/**
 * Builds a generic Android intent without specific package so default system browser opens
 */
export function getGenericAndroidIntentUrl(targetUrl?: string): string {
  if (typeof window === 'undefined') return '';
  const currentUrl = targetUrl || window.location.href;
  const noScheme = currentUrl.replace(/^https?:\/\//i, '');
  return `intent://${noScheme}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end;`;
}

/**
 * Open a URL safely in Instagram IAB.
 *
 * iOS IAB: window.open() is blocked → use a real <a> element click.
 *          Instagram iOS opens external <a target="_blank"> links in Safari.
 * Android IAB: Chrome Custom Tabs handles window.open fine but anchor is safer.
 */
export function openUrlInIAB(url: string): void {
  if (typeof document === 'undefined') return;

  // Create a real anchor element — IAB handles this by opening Safari/Chrome
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup after a short delay
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 300);
}

/**
 * Open a URL — automatically uses the IAB-safe method when in Instagram browser,
 * otherwise uses standard window.open.
 */
export function openAdUrl(url: string): void {
  if (!url) return;

  if (isInstagramBrowser() || isInAppBrowser()) {
    openUrlInIAB(url);
  } else {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    // Fallback if window.open is blocked
    if (!w) openUrlInIAB(url);
  }
}

/** True if the current environment should skip popunder/popup ad scripts */
export function shouldSkipPopupAds(): boolean {
  return isInstagramBrowser() || isInAppBrowser();
}
