/**
 * Trusted host validation for the reverse proxy layer.
 *
 * The proxy previously reflected the client-controlled `x-forwarded-host` and
 * `Origin` headers straight back into `Host`, `X-Forwarded-Host`, `Origin` and
 * `Access-Control-Allow-Origin`. That let any visitor:
 *   - set `x-forwarded-host: evil.com` and receive an ACAO reflecting
 *     `https://evil.com` (credential-bearing cross-origin reads), and
 *   - poison `Host`/`Origin` for Server Action validation.
 *
 * The proxy now ONLY ever forwards / reflects a host when it matches this
 * trusted allowlist. Everything else is dropped and the real request Host is
 * used instead.
 */

const PRODUCTION_HOSTS = new Set(['kruthika.fun', 'www.kruthika.fun']);

const DEV_HOSTS = new Set(['localhost:5000', '127.0.0.1:5000', 'localhost', '127.0.0.1']);

// Wildcard suffix (preview tunnels). Leading dot is significant.
const TRUSTED_SUFFIXES = ['.monkeycode-ai.live'];

const isProd = process.env.NODE_ENV === 'production';

/**
 * Normalise a raw host value: strip scheme, lower-case, trim trailing dots,
 * drop any port we do not expect for that host.
 */
function normalizeHost(raw: string): string {
  let h = (raw || '').trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, '');
  h = h.split('/')[0];
  h = h.split('?')[0];
  h = h.split('#')[0];
  h = h.replace(/\.$/, '');
  return h;
}

/**
 * Returns true only when the host is one of the app's own trusted origins
 * (or an allowed preview-tunnel hostname).
 */
export function isTrustedHost(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost || '');
  if (!host) return false;

  // The canonical production domain is ALWAYS trusted, regardless of NODE_ENV.
  if (PRODUCTION_HOSTS.has(host)) return true;

  // In production, nothing else is trusted.
  if (isProd) return false;

  // Dev: allow the canonical dev hosts + preview tunnel suffixes.
  if (DEV_HOSTS.has(host)) return true;
  for (const suffix of TRUSTED_SUFFIXES) {
    if (host.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * Resolve the effective public host for a request.
 * The client-supplied X-Forwarded-Host is only honoured when it is trusted;
 * otherwise the real Host header (the source of truth) wins.
 */
export function resolveTrustedHost(requestHost: string | null, forwardedHost: string | null): string | null {
  const realHost = normalizeHost(requestHost || '');
  const fwd = normalizeHost(forwardedHost || '');

  if (fwd && isTrustedHost(fwd)) return fwd;
  if (realHost && isTrustedHost(realHost)) return realHost;
  // Neither is trusted — return the real host anyway so routing still works,
  // but callers must NOT reflect it into CORS/Origin headers.
  return realHost || null;
}

export function normalizeForwardedProto(proto: string | null | undefined): 'http' | 'https' {
  return proto && (proto === 'http' || proto.startsWith('http')) ? (proto.startsWith('https') ? 'https' : 'http') : 'https';
}

export default {
  isTrustedHost,
  resolveTrustedHost,
  normalizeForwardedProto,
};
