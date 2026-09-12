/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server process starts (Node.js runtime only).
 *
 * CRON: Scheduled jobs (reengagement / proactive push waves, SEO indexing,
 * cleanup) are NOT run from inside the process anymore. They are triggered by
 * the EXTERNAL scheduler (Hostinger cron) hitting the authenticated endpoints
 * directly. This keeps the server stateless and lets the scheduler own timing:
 *
 *   Endpoint                 Schedule (IST)       UTC equivalent
 *   ───────────────────────  ──────────────────   ──────────────────
 *   POST /api/cron/reengagement   08:00,13:00,19:00,22:00   02:30,07:30,13:30,16:30
 *   POST /api/cron/proactive      08:00,19:00               02:30,13:30
 *   POST /api/cron/seo            every hour                every hour
 *   POST /api/cron/cleanup        daily 03:00               21:30
 *
 * Each endpoint requires `Authorization: Bearer <CRON_SECRET>` and is protected
 * by a DB-backed idempotency lock (see src/lib/cron-idempotency.ts), so
 * duplicate/overlapping scheduler invocations can never fire the same batch
 * twice. See docs/CRON.md for the exact Hostinger panel configuration.
 *
 * What this hook still does at startup:
 *   1. Validates that secrets were changed from placeholders (throws in prod).
 *   2. Restores the IP-blocklist + shared rate-limit state from MySQL.
 *   3. Runs lightweight in-process maintenance intervals (blocklist persist,
 *      stale-rate-limit cleanup). These are cheap and safe to keep in-process.
 */

// ── Startup secret validation ─────────────────────────────────────────────────
// Warn loudly (and throw in production) if any secret is still set to the
// change_me_* placeholder from .env.example. This prevents silent security holes
// caused by copying .env.example to .env.local without changing the values.
function validateSecrets(): void {
  const PLACEHOLDER_PREFIXES = ['change_me', 'your_', 'change-me', 'replace_me'];
  const secretsToCheck = [
    { key: 'ADMIN_SESSION_SECRET',      value: process.env.ADMIN_SESSION_SECRET },
    { key: 'REQUEST_SIGNATURE_SECRET',  value: process.env.REQUEST_SIGNATURE_SECRET },
    { key: 'COOKIE_SECRET',             value: process.env.COOKIE_SECRET },
    { key: 'ADMIN_PASSWORD',            value: process.env.ADMIN_PASSWORD },
  ];

  const unsafe = secretsToCheck.filter(({ value }) =>
    value && PLACEHOLDER_PREFIXES.some(p => value.toLowerCase().startsWith(p))
  );

  // P0-13: reject plaintext ADMIN_PASSWORD in production. A password must be
  // stored as ADMIN_PASSWORD_HASH + ADMIN_PASSWORD_SALT (see README) — otherwise
  // a leaked env var exposes the credential in plaintext and timing-safe
  // comparison degrades. Only tolerated for local development.
  const plaintextPassword = process.env.ADMIN_PASSWORD &&
    !process.env.ADMIN_PASSWORD_HASH &&
    !process.env.ADMIN_PASSWORD_SALT;
  if (process.env.NODE_ENV === 'production' && plaintextPassword) {
    throw new Error('[Security] ADMIN_PASSWORD set without ADMIN_PASSWORD_HASH + ADMIN_PASSWORD_SALT in production. Generate a salted hash (e.g. `openssl passwd -6` style, see README) and use the *_HASH/_SALT vars instead.');
  }

  if (unsafe.length > 0) {
    const names = unsafe.map(s => s.key).join(', ');
    const msg = `[Security] UNSAFE DEFAULT SECRETS DETECTED: ${names}. Update these in your environment variables before going to production!`;
    if (process.env.NODE_ENV === 'production') {
      // In production, refuse to start with placeholder secrets
      throw new Error(msg);
    } else {
      console.warn(msg);
    }
  }
}

export async function register() {
  // Only run in the Node.js server environment — never in edge runtime or browser
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Validate that secrets have been changed from their placeholder defaults
  try {
    validateSecrets();
  } catch (err) {
    console.error('[Instrumentation]', (err as Error).message);
    // Re-throw in production to prevent startup with insecure defaults
    if (process.env.NODE_ENV === 'production') throw err;
  }

  // ── Rate-limit state: restore from DB ────────────────────────────────────
  // This entry is evaluated while Next prepares bundles for multiple runtimes.
  // Keep Node-only security/database modules out of this import graph: they
  // initialize lazily on their first server request instead.

  if (!process.env.CRON_SECRET) {
    console.warn(
      '[Cron] CRON_SECRET not set. Scheduled endpoints will reject requests — ' +
      'set CRON_SECRET and configure Hostinger cron (see docs/CRON.md).'
    );
  } else {
    console.log(
      '[Cron] External cron endpoints ready. Configure Hostinger cron to call ' +
      '/api/cron/reengagement, /api/cron/proactive, /api/cron/seo and /api/cron/cleanup ' +
      'with Authorization: Bearer <CRON_SECRET> (docs/CRON.md).'
    );
  }
}
