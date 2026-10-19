import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export async function GET() {
  return NextResponse.redirect(`${BASE_URL}/.well-known/security.txt`, 301);
}
