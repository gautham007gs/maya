import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { updateCategory, isCategorySlugAvailable, slugify, trashCategories } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    const body = await request.json();
    const { name, slug: rawSlug, description, parent_id, seo_title, seo_description, color, icon } = body;

    const errors: Record<string, string> = {};
    let slug: string | undefined;
    if (rawSlug !== undefined) {
      slug = slugify(rawSlug);
      if (!slug) errors.slug = 'A valid slug is required.';
      else if (!(await isCategorySlugAvailable(slug, id))) errors.slug = 'Already in use.';
    }
    if (name !== undefined && !String(name).trim()) errors.name = 'Name is required.';
    if (parent_id !== undefined && parent_id !== null && Number(parent_id) === id) errors.parent_id = 'A category cannot be its own parent.';
    if (Object.keys(errors).length) return NextResponse.json({ error: 'Fix the highlighted fields.', fields: errors }, { status: 400 });

    await updateCategory(id, {
      ...(slug !== undefined ? { slug } : {}),
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
      ...(parent_id !== undefined ? { parent_id: parent_id ? Number(parent_id) : null } : {}),
      ...(seo_title !== undefined ? { seo_title: seo_title?.trim() || null } : {}),
      ...(seo_description !== undefined ? { seo_description: seo_description?.trim() || null } : {}),
      ...(color !== undefined ? { color: color?.trim() || null } : {}),
      ...(icon !== undefined ? { icon: icon?.trim() || null } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const msg = err.message || 'Failed to update category';
    if (msg.includes('Duplicate entry')) return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await trashCategories([Number(id)]);
  return NextResponse.json({ ok: true });
}
