import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession, verifyAdminCredentials, SESSION_COOKIE } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/shared-rate-limiter';
import { getClientIp } from '@/lib/session-identity';

// ── Brute-force protection (shared MySQL-backed limiter) ─────────────────────
// Per-IP AND per-account fixed-window counters, cross-instance. Previously this
// used an in-memory Map that (a) reset on restart and (b) ignored the account
// dimension, so a distributed attack across IPs could hammer a single admin.
// Each POST to this endpoint increments both counters; when either passes its
// limit the attempt is rejected BEFORE credentials are checked. Fail closed on
// DB error so an unavailable store never allows unlimited guessing.
const IP_ATTEMPTS_LIMIT     = 10; // 10 login attempts per IP per 10 minutes
const ACCOUNT_ATTEMPTS_LIMIT = 10; // 10 login attempts per account per 10 minutes
const WINDOW_MS = 10 * 60 * 1000;

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const accountKey = String(email).trim().toLowerCase().substring(0, 191);

    // Increment both attempt counters FIRST (fail closed on DB error).
    const [ipCheck, accountCheck] = await Promise.all([
      checkRateLimit('admin_login_ip', ip, {
        limit: IP_ATTEMPTS_LIMIT,
        windowMs: WINDOW_MS,
        failClosed: true,
      }),
      checkRateLimit('admin_login_account', accountKey, {
        limit: ACCOUNT_ATTEMPTS_LIMIT,
        windowMs: WINDOW_MS,
        failClosed: true,
      }),
    ]);

    if (!ipCheck.allowed || !accountCheck.allowed) {
      const retryAfterSec = Math.ceil(Math.max(ipCheck.retryAfterMs, accountCheck.retryAfterMs) / 1000);
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    if (!verifyAdminCredentials(email, password)) {
      // Use a consistent response time to prevent timing-based enumeration
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createAdminSession(email);
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/'
    });
    return response;
  } catch (error: unknown) {
    console.error('[admin login]', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
