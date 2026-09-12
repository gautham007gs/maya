import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const adminPasswordSalt = process.env.ADMIN_PASSWORD_SALT;
const sessionSecret = process.env.ADMIN_SESSION_SECRET;

const normalizeSessionExpiryMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    const dateMs = Date.parse(value);
    if (Number.isFinite(dateMs)) return dateMs;
  }
  if (value instanceof Date && !isNaN(value.getTime())) return value.getTime();
  return 0;
};

/**
 * P0-13: Plaintext-password guard. In production, a plaintext ADMIN_PASSWORD
 * (without ADMIN_PASSWORD_HASH + ADMIN_PASSWORD_SALT) is NOT acceptable — it is
 * only tolerated for local development. When this returns true, credentials
 * verification must fail closed so a production admin login can never succeed
 * against an unsalted password.
 */
export const isPlaintextPasswordOnly = (): boolean => {
  return Boolean(adminPassword) && !adminPasswordHash && !adminPasswordSalt;
};

export const hasUsableAdminConfig = (): boolean => {
  return Boolean(adminEmail && sessionSecret) && !(process.env.NODE_ENV === 'production' && isPlaintextPasswordOnly());
};

const hashPassword = (password: string, salt: string) => {
  return scryptSync(password, salt, 64).toString('hex');
};

const verifyPassword = (password: string) => {
  if (adminPasswordHash && adminPasswordSalt) {
    const hashed = hashPassword(password, adminPasswordSalt);
    const hashBuffer = Buffer.from(adminPasswordHash, 'hex');
    const compareBuffer = Buffer.from(hashed, 'hex');
    if (hashBuffer.length !== compareBuffer.length) {
      return false;
    }
    return timingSafeEqual(hashBuffer, compareBuffer);
  }

  if (adminPassword) {
    // Plaintext fallback is only allowed OUTSIDE production (P0-13).
    if (process.env.NODE_ENV === 'production') return false;
    const stored = Buffer.from(adminPassword);
    const provided = Buffer.from(password);
    if (stored.length !== provided.length) return false;
    return timingSafeEqual(stored, provided);
  }

  return false;
};

const signSession = (payload: string) => {
  if (!sessionSecret) {
    throw new Error('Missing ADMIN_SESSION_SECRET');
  }
  return createHmac('sha256', sessionSecret).update(payload).digest('hex');
};

// ── DB-backed session store (P0-14) ───────────────────────────────────────────
// Each issued admin session gets a random session_id persisted to `admin_sessions`.
// `verifyAdminSession` requires the row to be present AND not revoked/expired, so
// logout / forced revocation takes effect server-side even if the cookie's HMAC
// would otherwise remain valid for its TTL.
let sessionsTableReady = false;
let sessionsTablePromise: Promise<void> | null = null;

async function ensureSessionsTable(db: any): Promise<void> {
if (sessionsTableReady) return;
if (!sessionsTablePromise) {
  sessionsTablePromise = (async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
          session_id VARCHAR(191) NOT NULL PRIMARY KEY,
          email VARCHAR(191) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          expires_at_ms BIGINT NOT NULL DEFAULT 0,
          revoked_at TIMESTAMP NULL DEFAULT NULL,
          KEY idx_admin_sessions_email (email),
          KEY idx_admin_sessions_expires (expires_at),
          KEY idx_admin_sessions_expiry_ms (expires_at_ms)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await db.query(`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS expires_at_ms BIGINT NOT NULL DEFAULT 0`);
      sessionsTableReady = true;
    } catch (err) {
      console.warn('[AdminSession] Could not create admin_sessions table:', (err as Error).message);
    }
  })();
}
await sessionsTablePromise;
}

async function persistAdminSession(sessionId: string, email: string): Promise<void> {
const { getMysqlClient } = await import('./mysql-client');
const db = await getMysqlClient();
await ensureSessionsTable(db);
const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
const expiresAtMs = expiresAt.getTime();

await db.query(
  'INSERT INTO admin_sessions (session_id, email, created_at, expires_at, expires_at_ms) VALUES (?, ?, NOW(), ?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), expires_at_ms = VALUES(expires_at_ms), revoked_at = NULL',
  [sessionId, email, expiresAt, expiresAtMs]
);
}

/** Returns true when the row exists, is not revoked and not expired.
 * Returns null when the DB is unavailable so the signed cookie can still be
 * trusted during a transient outage. */
async function isAdminSessionActive(sessionId: string): Promise<boolean | null> {
try {
  const { getMysqlClient } = await import('./mysql-client');
  const db = await getMysqlClient();
  await ensureSessionsTable(db);
  const [rows]: any = await db.query(
    'SELECT revoked_at, expires_at_ms, expires_at FROM admin_sessions WHERE session_id = ? LIMIT 1',
    [sessionId]
  );
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const row = rows[0];
  const expiresAtMs = normalizeSessionExpiryMs(row.expires_at_ms ?? row.expires_at ?? 0);
  if (expiresAtMs > 0 && expiresAtMs <= Date.now()) return false;
  return !row.revoked_at;
} catch (err) {
  console.warn('[AdminSession] Revocation check failed, keeping signed session valid during transient DB outage:', (err as Error).message);
  return null;
}
}

/**
 * Create a signed admin session token AND persist its session_id server-side.
 * Throws when the DB write fails so the caller can refuse login — a session
 * that cannot be persisted cannot be revoked later.
 */
export const createAdminSession = async (email: string) => {
  if (!hasUsableAdminConfig()) {
    throw new Error('Admin auth is not configured (missing ADMIN_SESSION_SECRET / ADMIN_EMAIL, or plaintext ADMIN_PASSWORD in production)');
  }
  const sessionId = randomBytes(24).toString('hex');
  await persistAdminSession(sessionId, email);
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ email, exp, sid: sessionId });
  const signature = signSession(payload);
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
};

export const revokeAdminSessionByToken = async (token: string): Promise<void> => {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot < 1) return;
    const payload = decoded.substring(0, lastDot);
    const parsed = JSON.parse(payload) as { sid?: string };
    if (!parsed.sid) return;
    const { getMysqlClient } = await import('./mysql-client');
    const db = await getMysqlClient();
    await ensureSessionsTable(db);
    await db.query('UPDATE admin_sessions SET revoked_at = NOW() WHERE session_id = ? AND revoked_at IS NULL', [parsed.sid]);
  } catch {
    // best-effort revocation — the cookie is cleared client-side regardless
  }
};

export const verifyAdminSessionFromCookie = async (cookieValue: string | undefined) => {
  if (!cookieValue || !sessionSecret) return { isValid: false as const };
  const fakeRequest = { cookies: { get: () => ({ value: cookieValue }) } } as NextRequest;
  return verifyAdminSession(fakeRequest);
};

export const verifyAdminSession = async (request: NextRequest) => {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie || !sessionSecret) {
    return { isValid: false };
  }

  try {
    const decoded = Buffer.from(cookie, 'base64url').toString('utf-8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot < 1) return { isValid: false };
    const payload = decoded.substring(0, lastDot);
    const signature = decoded.substring(lastDot + 1);
    if (!payload || !signature) return { isValid: false };
    const expected = signSession(payload);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { isValid: false };
    }
    const parsed = JSON.parse(payload) as { email: string; exp: number; sid?: string };
    if (parsed.exp < Date.now()) {
      return { isValid: false };
    }
    // P0-14: server-side revocation check. Tokens without a sid (legacy cookies
    // issued before this change) are rejected — they cannot be revoked.
    if (!parsed.sid) {
      return { isValid: false };
    }
    const sessionStatus = await isAdminSessionActive(parsed.sid);
    if (sessionStatus === false) {
      return { isValid: false };
    }
    return { isValid: true, email: parsed.email };
  } catch {
    return { isValid: false };
  }
};

export const requireAdminAuth = async (request: NextRequest) => {
  const session = await verifyAdminSession(request);
  if (!session.isValid) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }
  return { authenticated: true };
};

export const verifyAdminCredentials = (email: string, password: string) => {
  if (!hasUsableAdminConfig()) {
    return false;
  }
  if (email.toLowerCase() !== adminEmail!.toLowerCase()) {
    return false;
  }
  return verifyPassword(password);
};
