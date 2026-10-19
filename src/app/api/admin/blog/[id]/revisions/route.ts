import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getPostByIdAdmin, getRevisionById, getPostRevisions, restoreRevision } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) return NextResponse.json({ error: 'Invalid post id.' }, { status: 400 });
  if (!await getPostByIdAdmin(postId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    return NextResponse.json({ revisions: await getPostRevisions(postId) });
  } catch {
    return NextResponse.json(
      { error: 'Revision storage is not available. Run database/07_cms_publishing_upgrade.sql first.' },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const postId = Number(id);
  const { revisionId } = await request.json();
  if (!Number.isInteger(postId) || !Number.isInteger(Number(revisionId))) {
    return NextResponse.json({ error: 'A valid post and revision are required.' }, { status: 400 });
  }

  try {
    const revision = await getRevisionById(postId, Number(revisionId));
    if (!revision) return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
    await restoreRevision(postId, revision, session.email || 'Admin');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Revision storage is not available. Run database/07_cms_publishing_upgrade.sql first.' },
      { status: 503 },
    );
  }
}