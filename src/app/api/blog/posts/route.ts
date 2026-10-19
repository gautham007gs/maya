import { NextResponse } from 'next/server';
import { getPublishedPosts } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

// GET /api/blog/posts — public listing of all published DB posts
export async function GET() {
  const posts = await getPublishedPosts();
  return NextResponse.json({ posts });
}
