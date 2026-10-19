import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { isSlugAvailable, slugify } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('slug') ?? '';
  const excludeId = searchParams.get('exclude') ? Number(searchParams.get('exclude')) : undefined;

  const slug = slugify(raw);
  if (!slug) return NextResponse.json({ available: false, slug: '' });

  const available = await isSlugAvailable(slug, excludeId);
  return NextResponse.json({ available, slug });
}
