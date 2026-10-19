import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getTagsAdmin, createTag, isTagSlugAvailable, slugify, deleteTags, mergeTags } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const search = request.nextUrl.searchParams.get('search') || '';
    const tags = await getTagsAdmin(search);
    return NextResponse.json({ tags });
  } catch {
    return NextResponse.json({ error: 'Tag storage is not ready. Run database/10_taxonomy_management.sql against your MySQL database.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { name, slug: rawSlug, description, seo_title, seo_description } = body;
    const errors: Record<string, string> = {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) errors.name = 'Name is required.';
    const slug = rawSlug?.trim() ? slugify(rawSlug) : slugify(trimmedName);
    if (!slug) errors.slug = 'A valid slug is required.';
    if (Object.keys(errors).length) return NextResponse.json({ error: 'Fix the highlighted fields.', fields: errors }, { status: 400 });

    if (!(await isTagSlugAvailable(slug))) {
      return NextResponse.json({ error: 'That slug is already in use.', fields: { slug: 'Already in use.' } }, { status: 409 });
    }
    const id = await createTag({ name: trimmedName, slug, description: description?.trim() || null, seo_title: seo_title?.trim() || null, seo_description: seo_description?.trim() || null });
    return NextResponse.json({ id, slug });
  } catch (err: any) {
    const msg = err.message || 'Failed to create tag';
    if (msg.includes('Duplicate entry')) return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { ids, action, targetId } = await request.json();
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(id => Number.isInteger(Number(id)))) {
      return NextResponse.json({ error: 'Choose between 1 and 100 tags.' }, { status: 400 });
    }
    const selectedIds = [...new Set(ids.map(Number))];
    if (action === 'delete') { await deleteTags(selectedIds); return NextResponse.json({ ok: true }); }
    if (action === 'merge') {
      const to = Number(targetId);
      if (!Number.isInteger(to)) return NextResponse.json({ error: 'Choose a target tag to merge into.' }, { status: 400 });
      await mergeTags(selectedIds, to);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unsupported bulk action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk action failed.' }, { status: 500 });
  }
}
