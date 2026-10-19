import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getAuthorByIdAdmin, updateAuthor, isAuthorSlugAvailable, slugify, trashAuthors, type AuthorRole, type AuthorStatus } from '@/lib/blog-db';
import { validateAbsoluteHttpUrl, sanitizeCmsHtml } from '@/lib/cms-content';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const author = await getAuthorByIdAdmin(Number(id));
  if (!author) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ author });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    const existing = await getAuthorByIdAdmin(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const { name, display_name, slug: rawSlug, bio, avatar_url, cover_image_url, designation, company,
      website_url, social_links, location, expertise, is_verified, is_guest, status, role, permissions,
      seo_title, seo_description } = body;

    const errors: Record<string, string> = {};
    let slug: string | undefined;
    if (rawSlug !== undefined) {
      slug = slugify(rawSlug);
      if (!slug) errors.slug = 'A valid slug is required.';
      else if (!(await isAuthorSlugAvailable(slug, id))) errors.slug = 'Already in use.';
    }
    if (name !== undefined && !String(name).trim()) errors.name = 'Name is required.';
    // Designation and bio remain required for author credibility. Avatars are
    // optional and the public UI falls back to initials/default artwork.
    const effectiveDesignation = designation !== undefined ? designation : existing.designation;
    const effectiveBio = bio !== undefined ? bio : existing.bio;
    if (typeof effectiveDesignation !== 'string' || !effectiveDesignation.trim()) errors.designation = 'A designation/role title is required for SEO (E-E-A-T) credibility.';
    if (typeof effectiveBio !== 'string' || !effectiveBio.trim()) errors.bio = 'A bio is required — search engines use this to establish author expertise.';
    if (website_url !== undefined && website_url && !validateAbsoluteHttpUrl(website_url)) errors.website_url = 'Website must be a valid absolute URL.';
    const validRoles: AuthorRole[] = ['author', 'editor', 'admin'];
    if (role !== undefined && !validRoles.includes(role)) errors.role = 'Invalid role.';
    const validStatuses: AuthorStatus[] = ['active', 'inactive'];
    if (status !== undefined && !validStatuses.includes(status)) errors.status = 'Invalid status.';
    if (Object.keys(errors).length) return NextResponse.json({ error: 'Fix the highlighted fields.', fields: errors }, { status: 400 });

    await updateAuthor(id, {
      ...(slug !== undefined ? { slug } : {}),
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(display_name !== undefined ? { display_name: display_name?.trim() || null } : {}),
      ...(bio !== undefined ? { bio: sanitizeCmsHtml(bio) } : {}),
      ...(avatar_url !== undefined ? { avatar_url: avatar_url?.trim() || null } : {}),
      ...(cover_image_url !== undefined ? { cover_image_url: cover_image_url?.trim() || null } : {}),
      ...(designation !== undefined ? { designation: designation?.trim() || null } : {}),
      ...(company !== undefined ? { company: company?.trim() || null } : {}),
      ...(website_url !== undefined ? { website_url: website_url?.trim() || null } : {}),
      ...(social_links !== undefined ? { social_links: social_links && typeof social_links === 'object' ? social_links : {} } : {}),
      ...(location !== undefined ? { location: location?.trim() || null } : {}),
      ...(expertise !== undefined ? { expertise: Array.isArray(expertise) ? expertise.filter(Boolean) : [] } : {}),
      ...(is_verified !== undefined ? { is_verified: Boolean(is_verified) } : {}),
      ...(is_guest !== undefined ? { is_guest: Boolean(is_guest) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(permissions !== undefined ? { permissions: Array.isArray(permissions) ? permissions.filter(Boolean) : [] } : {}),
      ...(seo_title !== undefined ? { seo_title: seo_title?.trim() || null } : {}),
      ...(seo_description !== undefined ? { seo_description: seo_description?.trim() || null } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const msg = err.message || 'Failed to update author';
    if (msg.includes('Duplicate entry')) return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await trashAuthors([Number(id)]);
  return NextResponse.json({ ok: true });
}
