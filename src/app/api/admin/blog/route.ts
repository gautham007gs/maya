import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getPostsAdminPage, getCategories, createPost, slugify, estimateReadingStats, updatePostLifecycle, permanentlyDeletePosts, emptyTrashPosts, duplicatePost, getPostByIdAdmin, invalidateBlogCache } from '@/lib/blog-db';
import { pingIndexNow, blogUrl } from '@/lib/indexnow';
import type { SchemaType } from '@/lib/blog-db';
import { sanitizeCmsFaqItems, sanitizeCmsHtml, validateAbsoluteHttpUrl, validateCmsFieldLimits, validateCmsMediaUrl, validatePublishFields, validateScheduledFields } from '@/lib/cms-content';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

export const dynamic = 'force-dynamic';

/** Keep public pages and the sitemap consistent after a CMS mutation. */
async function refreshPublicBlog(slugs: string[] = []): Promise<void> {
  await invalidateBlogCache();
  for (const slug of new Set(slugs.filter(Boolean))) {
    await invalidateBlogCache(slug);
    revalidatePath(`/blog/${slug}`);
  }
  revalidatePath('/blog');
  revalidatePath('/sitemap.xml');
  revalidatePath('/llms.txt');
  revalidatePath('/rss.xml');
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const exportCsv = params.get('export') === 'csv';

  // Any DB hiccup here used to throw unhandled and surface as a bare 500 —
  // the CMS list page would show "Failed to load posts" with no explanation
  // even though Overview (a different, simpler query) kept working. Catch it
  // and return a real, actionable error message instead.
  try {
    const result = await getPostsAdminPage({
      page: Number(params.get('page')) || 1,
      perPage: exportCsv ? 100 : Number(params.get('perPage')) || 20,
      search: params.get('search') || '',
      status: (params.get('status') as any) || 'all',
      categoryId: params.get('category') ? Number(params.get('category')) : undefined,
      sort: (params.get('sort') as any) || 'updated',
      direction: (params.get('direction') as any) || 'desc',
    });
    if (exportCsv) {
      const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const headers = ['ID', 'Title', 'Slug', 'Status', 'Author', 'Category', 'Published date', 'Updated at', 'Words', 'Reading time'];
      const body = result.posts.map(post => [
        post.id, post.title, post.slug, post.status, post.author, post.category_name,
        post.date_published, post.updated_at, post.word_count, post.reading_time_minutes,
      ].map(escape).join(',')).join('\n');
      return new NextResponse([headers.map(escape).join(','), body].filter(Boolean).join('\n'), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="blog-posts.csv"' },
      });
    }
    const categories = await getCategories();
    return NextResponse.json({ ...result, categories });
  } catch (err: any) {
    console.error('[api/admin/blog GET] failed:', err);
    return NextResponse.json(
      {
        error: 'Could not load posts right now — the database connection may be busy. Try again in a moment.',
        posts: [], total: 0, page: 1, perPage: 20, totalPages: 1,
        counts: { draft: 0, review: 0, scheduled: 0, published: 0, archived: 0, trash: 0 },
        categories: [],
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      title, slug: rawSlug, excerpt, content, author, author_title,
      category_id, status, featured_image, featured_image_alt, featured_image_caption, schema_type,
      tags, seo_title, seo_description, seo_keywords, long_tail_keywords,
      og_image, canonical_url, noindex, faq_items,
      date_published, date_modified, scheduled_at, scheduled_timezone,
    } = body;

    const fallbackTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Untitled draft';
    const nextTitle = fallbackTitle;
    const slug = rawSlug?.trim() ? slugify(rawSlug) : slugify(nextTitle);
    const normalizedSlug = slug || 'untitled-draft';
    // Auto-fill SEO title/description from the title/excerpt instead of
    // hard-requiring the writer to fill a separate field before publishing.
    const effectiveSeoTitle = fitSeoTitle(
      typeof seo_title === 'string' && seo_title.trim() ? seo_title : nextTitle,
      nextTitle,
    );
    const effectiveSeoDescription = fitMetaDescription(
      typeof seo_description === 'string' && seo_description.trim() ? seo_description : excerpt,
      'Read this Kruthika AI article for practical insights, context, and helpful guidance.',
    );
    const fieldErrors = validateCmsFieldLimits({
      title: nextTitle, slug: normalizedSlug, excerpt, seo_title: effectiveSeoTitle, seo_description: effectiveSeoDescription, featured_image_alt,
    });
    const validationErrors: Record<string, string> = { ...fieldErrors };
    if (typeof featured_image === 'string' && featured_image.trim() && !validateCmsMediaUrl(featured_image)) {
      validationErrors.featured_image = 'Use a valid absolute image URL or a same-origin /uploads image path.';
    }
    if (typeof canonical_url === 'string' && canonical_url.trim() && !validateAbsoluteHttpUrl(canonical_url)) {
      validationErrors.canonical_url = 'Canonical URL must be a valid absolute HTTP(S) URL.';
    }

    const publishErrors = validatePublishFields({
      title: nextTitle, slug: normalizedSlug, excerpt, author, category_id, featured_image, featured_image_alt,
      seo_title: effectiveSeoTitle, seo_description: effectiveSeoDescription, canonical_url,
    });
    const scheduleErrors = validateScheduledFields({ status, date_published, scheduled_at });
    const draftWarnings = [
      !title?.trim() ? 'Add a title so the draft is easy to identify.' : null,
      !slug?.trim() ? 'Set a readable slug before publishing.' : null,
      !excerpt?.trim() ? 'Add an excerpt so search snippets stay useful.' : null,
      !author?.trim() ? 'Add an author name for stronger E-E-A-T signals.' : null,
      !category_id ? 'Choose a category before publishing.' : null,
      !featured_image?.trim() ? 'Add a featured image before publishing.' : null,
      !featured_image_alt?.trim() ? 'Add featured image alt text before publishing.' : null,
    ].filter((warning): warning is string => Boolean(warning));

    if (status === 'published') {
      Object.assign(validationErrors, publishErrors);
    }
    if (status === 'scheduled') {
      Object.assign(validationErrors, scheduleErrors);
    }
    if (Object.keys(validationErrors).length) {
      const message = status === 'published'
        ? 'Complete the publishing checklist.'
        : 'Fix the highlighted fields before saving.';
      return NextResponse.json({ error: message, fields: validationErrors }, { status: 400 });
    }
    const { wordCount, readingTimeMinutes } = estimateReadingStats(content || '');

    const validSchemaTypes: SchemaType[] = ['BlogPosting','Article','NewsArticle','TechArticle','FAQPage','HowTo'];
    const schemaType: SchemaType = validSchemaTypes.includes(schema_type) ? schema_type : 'BlogPosting';

    const finalStatus = status === 'published' ? 'published' : status === 'scheduled' ? 'scheduled' : status === 'review' ? 'review' : 'draft';

    const id = await createPost({
      slug: normalizedSlug,
      title: nextTitle,
      excerpt: excerpt?.trim() || null,
      content: sanitizeCmsHtml(content),
      author: author?.trim() || 'Editorial Team',
      author_title: author_title?.trim() || null,
      category_id: category_id ? Number(category_id) : null,
      status: finalStatus,
      featured_image: featured_image?.trim() || null,
      featured_image_alt: featured_image_alt?.trim() || null,
      featured_image_caption: featured_image_caption?.trim() || null,
      schema_type: schemaType,
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      seo_title: effectiveSeoTitle || null,
      seo_description: effectiveSeoDescription || null,
      seo_keywords: seo_keywords?.trim() || null,
      long_tail_keywords: Array.isArray(long_tail_keywords) ? long_tail_keywords : [],
      og_image: og_image?.trim() || null,
      canonical_url: canonical_url?.trim() || null,
      noindex: Boolean(noindex),
      faq_items: sanitizeCmsFaqItems(faq_items),
      word_count: wordCount,
      reading_time_minutes: readingTimeMinutes,
      date_published: (finalStatus === 'scheduled' ? date_published : date_published || new Date().toISOString().split('T')[0]) || null,
      date_modified: date_modified || new Date().toISOString().split('T')[0],
      scheduled_at: finalStatus === 'scheduled' ? (scheduled_at || null) : null,
      scheduled_timezone: finalStatus === 'scheduled' ? (scheduled_timezone || 'Asia/Kolkata') : null,
    } as any);

    // ── Auto-ping search engines and bust ISR cache on publish ────────────
    if (finalStatus === 'published') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
      // Invalidate ISR caches immediately (don't wait for 60s revalidate)
      await refreshPublicBlog([normalizedSlug]);
      // Ping IndexNow (Bing + Google relay) — fire and forget
      pingIndexNow([blogUrl(normalizedSlug), `${baseUrl}/blog`]).catch(() => {});
    }

    return NextResponse.json({ id, slug: normalizedSlug, warnings: draftWarnings });
  } catch (err: any) {
    const msg = err.message || 'Failed to create post';
    if (msg.includes('Duplicate entry')) return NextResponse.json({ error: 'A post with that slug already exists' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { ids, action } = await request.json();

    if (action === 'empty_trash') {
      const deleted = await emptyTrashPosts();
      return NextResponse.json({ ok: true, deleted });
    }

    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(id => Number.isInteger(Number(id)))) {
      return NextResponse.json({ error: 'Choose between 1 and 100 posts.' }, { status: 400 });
    }
    const selectedIds = [...new Set(ids.map(Number))];
    // Preserve the old public URLs before a lifecycle change or deletion.
    const affectedPosts = await Promise.all(selectedIds.map(getPostByIdAdmin));
    const affectedSlugs = affectedPosts.flatMap(post => post?.slug ? [post.slug] : []);
    const affectsPublic = affectedPosts.some(post => post?.status === 'published') || action === 'published';
    const lifecycleActions = new Set(['draft', 'review', 'scheduled', 'published', 'archived', 'trash', 'restore']);
    if (action === 'duplicate') {
      const created = await Promise.all(selectedIds.map(duplicatePost));
      return NextResponse.json({ ok: true, created: created.filter(Boolean).length });
    }
    if (action === 'delete') {
      await permanentlyDeletePosts(selectedIds);
      if (affectsPublic) await refreshPublicBlog(affectedSlugs);
      return NextResponse.json({ ok: true });
    }
    if (!lifecycleActions.has(action)) return NextResponse.json({ error: 'Unsupported bulk action.' }, { status: 400 });
    await updatePostLifecycle(selectedIds, action === 'restore' ? 'draft' : action);
    if (affectsPublic) await refreshPublicBlog(affectedSlugs);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk action failed.' }, { status: 500 });
  }
}
