import { NextRequest, NextResponse } from 'next/server';
import { getPublishedPostBySlug } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

// GET /api/blog/posts/[slug] — single published post
export async function GET(_request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ post });
}
