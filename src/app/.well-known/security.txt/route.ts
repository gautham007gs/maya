import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export async function GET() {
  const content = `# RFC 9116 Security Disclosure File
# https://securitytxt.org/
Contact: mailto:security@kruthika.fun
Contact: ${BASE_URL}/contact
Expires: 2027-12-31T23:59:59.000Z
Preferred-Languages: en, hi
Canonical: ${BASE_URL}/.well-known/security.txt
Policy: ${BASE_URL}/legal/privacy
Acknowledgments: ${BASE_URL}/about
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
