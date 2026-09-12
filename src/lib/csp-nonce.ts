/**
 * Client-side access to the per-request Content-Security-Policy nonce.
 *
 * The nonce is generated in middleware (src/proxy.ts) and forwarded to the
 * app through the `x-nonce` request header. Next.js attaches it to its own
 * inline bootstrap scripts, but ad components create additional <script>
 * elements at runtime (document.createElement) — without the matching nonce
 * attribute those inline scripts are blocked by the nonce-based script-src,
 * which is exactly why ad slots rendered blank.
 *
 * The root layout reads `x-nonce` and emits it as:
 *   <meta name="csp-nonce" content="...">
 * so any client code can retrieve the value and stamp it onto scripts it
 * injects (external ad SDK scripts are also covered by the host allowlist in
 * buildCSP, but stamping the nonce is harmless and robust).
 *
 * IMPORTANT — no module-level caching:
 * A module-level `cachedNonce` variable persists across Next.js client-side
 * navigations (Turbopack reuses module instances). After navigation the page
 * gets a new nonce in its <meta> tag (new request = new nonce from middleware),
 * but ad components calling getCspNonce() would receive the old stale value.
 * Scripts stamped with that stale nonce are rejected by the new page's CSP,
 * producing "CSP inline" console errors and blank ad slots.
 * Reading directly from the DOM is fast (single querySelector) and always
 * correct — the browser caches the layout query itself.
 */

/** Return the current document's CSP nonce ('' if none is present). */
export function getCspNonce(): string {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]');
  return meta?.getAttribute('content') ?? '';
}

/**
 * Stamp the document's CSP nonce onto a dynamically-created script element so
 * it passes the nonce-based script-src policy. Returns the same element for
 * chaining.
 */
export function stampCspNonce(script: HTMLScriptElement): HTMLScriptElement {
  const nonce = getCspNonce();
  if (nonce) script.setAttribute('nonce', nonce);
  return script;
}
