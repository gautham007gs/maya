import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, revokeAdminSessionByToken } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await revokeAdminSessionByToken(token);
  }

  const response = NextResponse.json({ success: true });

  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 0,
    path: '/'
  };

  response.cookies.set(SESSION_COOKIE, '', opts);
  return response;
}
