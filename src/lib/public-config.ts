/**
 * Client-side public configuration reader.
 *
 * The only sanctioned way for browser code to read public config rows
 * (ad settings, AI profile, global status, demo contacts, media assets,
 * notification banner). It hits /api/public-config, which enforces a
 * server-side row-level allowlist — the generic /api/db proxy no longer
 * exposes app_configurations to unauthenticated callers.
 */

export interface PublicConfigResult {
  data: Record<string, any>;
  ok: boolean;
}

let inFlightConfigPromise: Promise<PublicConfigResult> | null = null;
let cachedConfigResult: { result: PublicConfigResult; expiresAt: number } | null = null;

export async function fetchPublicConfig(force = false): Promise<PublicConfigResult> {
  const now = Date.now();
  if (!force && cachedConfigResult && cachedConfigResult.expiresAt > now) {
    return cachedConfigResult.result;
  }
  if (!force && inFlightConfigPromise) {
    return inFlightConfigPromise;
  }

  inFlightConfigPromise = (async () => {
    try {
      const response = await fetch('/api/public-config', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) {
        return { data: {}, ok: false };
      }
      const res = { data: (payload?.data as Record<string, any>) || {}, ok: true };
      cachedConfigResult = { result: res, expiresAt: Date.now() + 10000 };
      return res;
    } catch {
      return { data: {}, ok: false };
    } finally {
      inFlightConfigPromise = null;
    }
  })();

  return inFlightConfigPromise;
}

/** Parse a possibly double-stringified JSON column value. */
export function parseStoredConfig<T>(value: any): T | null {
  let parsed: any = value;
  while (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return null; }
  }
  return (parsed && typeof parsed === 'object' ? parsed : null) as T | null;
}
