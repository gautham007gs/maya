import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import {
  getAuthorsAdmin, createAuthor, isAuthorSlugAvailable, slugify,
  setAuthorsStatus, trashAuthors, restoreAuthors, permanentlyDeleteAuthors,
  type AuthorRole, type AuthorStatus,
} from '@/lib/blog-db';
import { validateAbsoluteHttpUrl, sanitizeCmsHtml } from '@/lib/cms-content';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const params = request.nextUrl.searchParams;
    const result = await getAuthorsAdmin({
      search: params.get('search') || '',
      status: (params.get('status') as any) || 'all',
      page: Number(params.get('page')) || 1,
      perPage: Number(params.get('perPage')) || 20,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Author storage is not ready. Run database/10_taxonomy_management.sql against your MySQL database.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { name, display_name, slug: rawSlug, bio, avatar_url, cover_image_url, designation, company,
      website_url, social_links, location, expertise, is_verified, is_guest, status, role, permissions,
      seo_title, seo_description } = body;

    const errors: Record<string, string> = {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) errors.name = 'Name is required.';
    const slug = rawSlug?.trim() ? slugify(rawSlug) : slugify(trimmedName);
    if (!slug) errors.slug = 'A valid slug is required.';
    // Designation and bio feed E-E-A-T signals. An avatar is optional: the
    // public author UI has a deterministic initials/default-avatar fallback.
    if (typeof designation !== 'string' || !designation.trim()) errors.designation = 'A designation/role title is required for SEO (E-E-A-T) credibility.';
    if (typeof bio !== 'string' || !bio.trim()) errors.bio = 'A bio is required — search engines use this to establish author expertise.';
    if (website_url && typeof website_url === 'string' && website_url.trim() && !validateAbsoluteHttpUrl(website_url)) {
      errors.website_url = 'Website must be a valid absolute URL.';
    }
    const validRoles: AuthorRole[] = ['author', 'editor', 'admin'];
    if (role !== undefined && !validRoles.includes(role)) errors.role = 'Invalid role.';
    const validStatuses: AuthorStatus[] = ['active', 'inactive'];
    if (status !== undefined && !validStatuses.includes(status)) errors.status = 'Invalid status.';
    if (Object.keys(errors).length) return NextResponse.json({ error: 'Fix the highlighted fields.', fields: errors }, { status: 400 });

    if (!(await isAuthorSlugAvailable(slug))) {
      return NextResponse.json({ error: 'That slug is already in use.', fields: { slug: 'Already in use.' } }, { status: 409 });
    }

    const id = await createAuthor({
      slug, name: trimmedName, display_name: display_name?.trim() || null,
      bio: typeof bio === 'string' ? sanitizeCmsHtml(bio) : null,
      avatar_url: avatar_url?.trim() || null, cover_image_url: cover_image_url?.trim() || null,
      designation: designation?.trim() || null, company: company?.trim() || null,
      website_url: website_url?.trim() || null,
      social_links: social_links && typeof social_links === 'object' ? social_links : {},
      location: location?.trim() || null,
      expertise: Array.isArray(expertise) ? expertise.filter(Boolean) : [],
      is_verified: Boolean(is_verified), is_guest: Boolean(is_guest),
      status: status || 'active', role: role || 'author',
      permissions: Array.isArray(permissions) ? permissions.filter(Boolean) : [],
      seo_title: seo_title?.trim() || null, seo_description: seo_description?.trim() || null,
    });
    return NextResponse.json({ id, slug });
  } catch (err: any) {
    const msg = err.message || 'Failed to create author';
    if (msg.includes('Duplicate entry')) return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { ids, action } = await request.json();
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(id => Number.isInteger(Number(id)))) {
      return NextResponse.json({ error: 'Choose between 1 and 100 authors.' }, { status: 400 });
    }
    const selectedIds = [...new Set(ids.map(Number))];
    if (action === 'active' || action === 'inactive') { await setAuthorsStatus(selectedIds, action); return NextResponse.json({ ok: true }); }
    if (action === 'trash') { await trashAuthors(selectedIds); return NextResponse.json({ ok: true }); }
    if (action === 'restore') { await restoreAuthors(selectedIds); return NextResponse.json({ ok: true }); }
    if (action === 'delete') { await permanentlyDeleteAuthors(selectedIds); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: 'Unsupported bulk action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk action failed.' }, { status: 500 });
  }
}
