import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import {
  getCategoriesAdmin, createCategory, isCategorySlugAvailable, slugify,
  trashCategories, restoreCategories, permanentlyDeleteCategories, mergeCategories,
} from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const params = request.nextUrl.searchParams;
    const categories = await getCategoriesAdmin({
      search: params.get('search') || '',
      includeTrashed: params.get('trashed') === 'true',
    });
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ error: 'Category storage is not ready. Run database/10_taxonomy_management.sql against your MySQL database.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { name, slug: rawSlug, description, parent_id, seo_title, seo_description, color, icon } = body;
    const errors: Record<string, string> = {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) errors.name = 'Name is required.';
    const slug = rawSlug?.trim() ? slugify(rawSlug) : slugify(trimmedName);
    if (!slug) errors.slug = 'A valid slug is required.';
    if (parent_id !== undefined && parent_id !== null && Number(parent_id) < 1) errors.parent_id = 'Invalid parent category.';
    if (Object.keys(errors).length) return NextResponse.json({ error: 'Fix the highlighted fields.', fields: errors }, { status: 400 });

    if (!(await isCategorySlugAvailable(slug))) {
      return NextResponse.json({ error: 'That slug is already in use.', fields: { slug: 'Already in use.' } }, { status: 409 });
    }
    const id = await createCategory({
      name: trimmedName, slug, description: description?.trim() || null,
      parent_id: parent_id ? Number(parent_id) : null,
      seo_title: seo_title?.trim() || null, seo_description: seo_description?.trim() || null,
      color: color?.trim() || null, icon: icon?.trim() || null,
    });
    return NextResponse.json({ id, slug });
  } catch (err: any) {
    const msg = err.message || 'Failed to create category';
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
      return NextResponse.json({ error: 'Choose between 1 and 100 categories.' }, { status: 400 });
    }
    const selectedIds = [...new Set(ids.map(Number))];
    if (action === 'trash') { await trashCategories(selectedIds); return NextResponse.json({ ok: true }); }
    if (action === 'restore') { await restoreCategories(selectedIds); return NextResponse.json({ ok: true }); }
    if (action === 'delete') { await permanentlyDeleteCategories(selectedIds); return NextResponse.json({ ok: true }); }
    if (action === 'merge') {
      const to = Number(targetId);
      if (!Number.isInteger(to)) return NextResponse.json({ error: 'Choose a target category to merge into.' }, { status: 400 });
      await mergeCategories(selectedIds, to);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unsupported bulk action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk action failed.' }, { status: 500 });
  }
}
