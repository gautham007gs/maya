/**
 * Shared IndexNow utility — call from API routes to ping search engines
 * when content is created or updated.
 *
 * IndexNow is supported by Bing, Yandex, and (via Bing's relay) Google.
 * The key file must be served at: /<key>.txt → public/<key>.txt
 */

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://kruthika.fun').replace(/\/$/, '');
export const INDEX_NOW_KEY = 'e8f3d9a7b2c4f1e6d8a9c3b5f7e2d4a6';

/**
 * Submit one or more URLs to IndexNow for instant indexing.
 * Fire-and-forget safe — all errors are caught and logged.
 */
export async function pingIndexNow(urls: string[]): Promise<boolean> {
  if (!urls.length) return false;
  try {
    const payload = {
      host: new URL(BASE_URL).hostname,
      key: INDEX_NOW_KEY,
      keyLocation: `${BASE_URL}/${INDEX_NOW_KEY}.txt`,
      urlList: urls.slice(0, 10_000), // IndexNow max per request
    };
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    // 200 = submitted, 202 = accepted (async), both are success
    const ok = res.ok || res.status === 202;
    if (!ok) {
      console.warn('[IndexNow] Submission failed:', res.status, await res.text().catch(() => ''));
    }
    return ok;
  } catch (err) {
    console.error('[IndexNow] Error pinging search engines:', err);
    return false;
  }
}

/**
 * Build the full URL for a blog post slug.
 */
export function blogUrl(slug: string): string {
  return `${BASE_URL}/blog/${slug}`;
}
