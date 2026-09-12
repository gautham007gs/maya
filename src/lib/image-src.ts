/**
 * next/image source guard.
 *
 * `next/image` THROWS at render time when `src` is an absolute URL whose
 * hostname isn't listed in `next.config.js` → `images.remotePatterns`:
 *
 *   Error: Invalid src prop (https://…) on `next/image`, hostname "…" is not
 *   configured under images in your next.config.js
 *
 * On a server component that error isn't recoverable — it bubbles to the
 * nearest error boundary and the visitor gets the 500 page instead of the
 * article. Featured images and author avatars are editor-supplied
 * (`validateCmsMediaUrl` accepts ANY absolute http(s) URL), so any host the
 * config doesn't know about would take a published post down.
 *
 * `unoptimized` short-circuits the loader before that hostname check runs,
 * so a non-whitelisted image renders as a plain <img> instead of crashing
 * the page. Pass `unoptimized={!isOptimizableImageSrc(src)}` on every
 * next/image whose src comes from the CMS.
 *
 * Keep OPTIMIZABLE_HOST_PATTERNS in sync with next.config.js. Each entry
 * matches ONE subdomain level, exactly like Next's `*.example.com` wildcard —
 * being stricter than the config only costs optimization, while being looser
 * would reintroduce the crash.
 */

const OPTIMIZABLE_HOST_PATTERNS: RegExp[] = [
  /^[a-z0-9-]+\.googleapis\.com$/,
  /^[a-z0-9-]+\.googleusercontent\.com$/,
  /^[a-z0-9-]+\.cloudinary\.com$/,
  /^[a-z0-9-]+\.imgur\.com$/,
  /^[a-z0-9-]+\.unsplash\.com$/,
  /^[a-z0-9-]+\.pexels\.com$/,
  /^[a-z0-9-]+\.cdn\.kruthika\.fun$/,
  /^(?:www\.)?kruthika\.fun$/,
];

/** True when `next/image` can safely optimize this src (same-origin path or whitelisted host). */
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed) return false;

  // Same-origin path (`/uploads/…`). `//host/path` is protocol-relative, i.e.
  // remote — it must go through the hostname check below, not this branch.
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');

  try {
    const url = new URL(trimmed);
    // remotePatterns in next.config.js are https-only.
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return OPTIMIZABLE_HOST_PATTERNS.some(pattern => pattern.test(host));
  } catch {
    return false;
  }
}

/**
 * True when a src is safe to hand to `next/image` at all. An empty/whitespace
 * src throws its own error ("received an empty string"), and a `data:`/`blob:`
 * URL can't be optimized, so callers should skip the <Image> entirely.
 */
export function isRenderableImageSrc(src: string | null | undefined): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  return !/^(?:data|blob|javascript):/i.test(trimmed);
}
