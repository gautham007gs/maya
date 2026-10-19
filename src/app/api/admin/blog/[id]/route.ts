import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getPostByIdAdmin, updatePost, slugify, estimateReadingStats, createPostRevision, savePostRedirect, updatePostLifecycle, deletePost, invalidateBlogCache } from '@/lib/blog-db';
import { pingIndexNow, blogUrl } from '@/lib/indexnow';
import type { SchemaType } from '@/lib/blog-db';
import { sanitizeCmsFaqItems, sanitizeCmsHtml, validateAbsoluteHttpUrl, validateCmsFieldLimits, validateCmsMediaUrl, validatePublishFields, validateScheduledFields } from '@/lib/cms-content';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

export const dynamic = 'force-dynamic';

/** Revalidate both old and new public URLs after an edit, move, or removal. */
async function refreshPublicBlog(slugs: string[]): Promise<void> {
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

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const post = await getPostByIdAdmin(Number(id));
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ post });
  } catch (err: any) {
    console.error('[api/admin/blog/[id] GET] failed:', err);
    return NextResponse.json({ error: 'Could not load this post right now. Try again in a moment.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title, slug: rawSlug, excerpt, content, author, author_title,
       category_id, status, featured_image, featured_image_alt, featured_image_caption, schema_type,
      tags, seo_title, seo_description, seo_keywords, long_tail_keywords,
      og_image, og_title, og_description, twitter_title, twitter_description,
      canonical_url, noindex, faq_items,
      date_published, date_modified, scheduled_at, scheduled_timezone,
    } = body;

    const validSchemaTypes: SchemaType[] = ['BlogPosting','Article','NewsArticle','TechArticle','FAQPage','HowTo'];
    if (schema_type !== undefined && !validSchemaTypes.includes(schema_type)) {
      return NextResponse.json({ error: 'Invalid schema type.' }, { status: 400 });
    }

    const existing = await getPostByIdAdmin(Number(id));
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const finalStatus = status !== undefined ? (['published', 'scheduled', 'review', 'archived', 'trash'].includes(status) ? status : 'draft') : undefined;
    const resultingStatus = finalStatus ?? existing.status;
    const hasTitleField = Object.prototype.hasOwnProperty.call(body, 'title');
    if (hasTitleField && (typeof title !== 'string' || !title.trim())) {
      return NextResponse.json({ error: 'Title is required when provided.' }, { status: 400 });
    }
    const finalSlug = rawSlug !== undefined ? (slugify(rawSlug) || slugify(typeof title === 'string' && title.trim() ? title : existing.title)) : undefined;
    const normalizedTitle = typeof title === 'string' && title.trim() ? title.trim() : existing.title;
    const normalizedExcerpt = typeof excerpt === 'string' && excerpt.trim() ? excerpt.trim() : (excerpt === undefined ? existing.excerpt : '');
    // Auto-fill SEO title/description from title/excerpt rather than hard-requiring
    // a separate field — matches the fallback the live page already uses at render time.
    const effectiveSeoTitle = fitSeoTitle(
      typeof seo_title === 'string' && seo_title.trim()
        ? seo_title
        : (existing.seo_title?.trim() || normalizedTitle),
      normalizedTitle,
    );
    const effectiveSeoDescription = fitMetaDescription(
      typeof seo_description === 'string' && seo_description.trim()
        ? seo_description
        : (existing.seo_description?.trim() || normalizedExcerpt),
      'Read this Kruthika AI article for practical insights, context, and helpful guidance.',
    );
    const fieldErrors = validateCmsFieldLimits({
      title: normalizedTitle, slug: finalSlug ?? existing.slug, excerpt, seo_title: effectiveSeoTitle, seo_description: effectiveSeoDescription, featured_image_alt,
    });
    const validationErrors: Record<string, string> = { ...fieldErrors };
    const featuredImageValue = featured_image !== undefined ? featured_image : existing.featured_image;
    const canonicalUrlValue = canonical_url !== undefined ? canonical_url : existing.canonical_url;
    if (typeof featuredImageValue === 'string' && featuredImageValue.trim() && !validateCmsMediaUrl(featuredImageValue)) {
      validationErrors.featured_image = 'Use a valid absolute image URL or a same-origin /uploads image path.';
    }
    if (typeof canonicalUrlValue === 'string' && canonicalUrlValue.trim() && !validateAbsoluteHttpUrl(canonicalUrlValue)) {
      validationErrors.canonical_url = 'Canonical URL must be a valid absolute HTTP(S) URL.';
    }

    if (resultingStatus === 'published') {
      const publishErrors = validatePublishFields({
        title: normalizedTitle,
        slug: finalSlug ?? existing.slug,
        excerpt: excerpt ?? existing.excerpt,
        author: author ?? existing.author,
        category_id: category_id ?? existing.category_id,
        featured_image: featuredImageValue,
        featured_image_alt: featured_image_alt ?? existing.featured_image_alt,
        seo_title: effectiveSeoTitle,
        seo_description: effectiveSeoDescription,
        canonical_url: canonicalUrlValue,
      });
      Object.assign(validationErrors, publishErrors);
    }
    if (resultingStatus === 'scheduled') {
      const scheduleErrors = validateScheduledFields({
        status: resultingStatus,
        date_published: date_published ?? existing.date_published,
        scheduled_at: scheduled_at ?? existing.scheduled_at,
      });
      Object.assign(validationErrors, scheduleErrors);
    }
    if (Object.keys(validationErrors).length) {
      return NextResponse.json({ error: 'Fix the highlighted fields before saving.', fields: validationErrors }, { status: 400 });
    }

    // Only recalculate reading stats when content is explicitly in the payload.
    // Previously this always ran estimateReadingStats('') when content was omitted,
    // silently zeroing word_count on every metadata-only update.
    const readingStats = content !== undefined ? estimateReadingStats(content) : undefined;

    // ── Data-loss guard ───────────────────────────────────────────────────
    // If the incoming content is empty (or trivially short) while the post
    // already has substantial content saved, refuse to overwrite it. A
    // legitimate "clear the article" edit is rare and should go through an
    // explicit action, not an autosave tick that raced a slow network call
    // or a transient DB hiccup. This is what stops the "my content vanished
    // after publishing" failure mode at the source, regardless of what
    // upstream client bug produced the empty payload.
    let contentToSave = content;
    if (content !== undefined) {
      const sanitizedIncoming = sanitizeCmsHtml(content);
      const incomingTextLength = sanitizedIncoming.replace(/<[^>]+>/g, '').trim().length;
      const existingTextLength = (existing.content || '').replace(/<[^>]+>/g, '').trim().length;
      if (incomingTextLength < 20 && existingTextLength > 200) {
        console.warn(`[api/admin/blog/${id} PUT] Refused to overwrite ${existingTextLength}-char content with a near-empty ${incomingTextLength}-char payload. Keeping existing content.`);
        contentToSave = undefined; // fall through to updatePost without touching content
      }
    }

    // Keep a bounded audit trail. A migration-free installation still saves the post;
    // the revision feature simply becomes unavailable until its table is installed.
    try {
      await createPostRevision(Number(id), existing, body.autosave ? 'autosave' : 'manual', session.email || 'Admin');
    } catch (revisionError) {
      console.warn('Blog revision was not recorded:', revisionError);
    }

    await updatePost(Number(id), {
      ...(title        !== undefined && { title: normalizedTitle }),
      ...(finalSlug    !== undefined && { slug: finalSlug }),
      ...(excerpt      !== undefined && { excerpt: excerpt?.trim() || null }),
       ...(contentToSave !== undefined && { content: sanitizeCmsHtml(contentToSave) }),
      ...(author       !== undefined && { author: author?.trim() || 'Editorial Team' }),
      ...(author_title !== undefined && { author_title: author_title?.trim() || null }),
      ...(category_id  !== undefined && { category_id: category_id ? Number(category_id) : null }),
      ...(finalStatus  !== undefined && { status: finalStatus }),
      ...(featured_image !== undefined && { featured_image: featured_image?.trim() || null }),
      ...(date_published !== undefined && { date_published: date_published || null }),
       ...(featured_image_alt !== undefined && { featured_image_alt: featured_image_alt?.trim() || null }),
       ...(featured_image_caption !== undefined && { featured_image_caption: featured_image_caption?.trim() || null }),
       ...(schema_type !== undefined && { schema_type }),
      ...(tags         !== undefined && { tags: Array.isArray(tags) ? tags.filter(Boolean) : [] }),
      // Always persist normalized metadata, even when an older client omits
      // these fields. Any edit therefore repairs legacy overlong values too.
      seo_title: effectiveSeoTitle || null,
      seo_description: effectiveSeoDescription || null,
      ...(seo_keywords !== undefined && { seo_keywords: seo_keywords?.trim() || null }),
      ...(long_tail_keywords !== undefined && { long_tail_keywords: Array.isArray(long_tail_keywords) ? long_tail_keywords : [] }),
      ...(og_image     !== undefined && { og_image: og_image?.trim() || null }),
          ...(og_title        !== undefined && { og_title: og_title?.trim() || null }),
          ...(og_description  !== undefined && { og_description: og_description?.trim() || null }),
          ...(twitter_title   !== undefined && { twitter_title: twitter_title?.trim() || null }),
          ...(twitter_description !== undefined && { twitter_description: twitter_description?.trim() || null }),
      ...(canonical_url !== undefined && { canonical_url: canonical_url?.trim() || null }),
      ...(noindex      !== undefined && { noindex: Boolean(noindex) }),
       ...(faq_items    !== undefined && { faq_items: sanitizeCmsFaqItems(faq_items) }),
      ...(readingStats !== undefined && {
        word_count: readingStats.wordCount,
        reading_time_minutes: readingStats.readingTimeMinutes,
      }),
      ...(date_published !== undefined && { date_published: date_published || null }),
      ...(scheduled_at !== undefined && { scheduled_at: resultingStatus === 'scheduled' ? (scheduled_at || null) : null }),
      ...(scheduled_timezone !== undefined && { scheduled_timezone: resultingStatus === 'scheduled' ? (scheduled_timezone || 'Asia/Kolkata') : null }),
      ...(finalStatus === 'published' && { scheduled_at: null, scheduled_timezone: null }),
      date_modified: date_modified || new Date().toISOString().split('T')[0],
    } as any);

    // Preserve earned links when an editor changes a published URL.
    if (finalSlug && existing.slug !== finalSlug) {
      try {
        await savePostRedirect(existing.slug, finalSlug);
      } catch (redirectError) {
        console.warn('Blog slug redirect was not recorded:', redirectError);
      }
    }

    // ── Auto-ping search engines and bust ISR cache on publish/update ─────
    const isPublished = resultingStatus === 'published';
    const isIndexable = isPublished && !Boolean(noindex ?? existing.noindex);
    const wasIndexable = existing.status === 'published' && !existing.noindex;
    const slugToUse = finalSlug || existing.slug;
    // Do not flush public caches for private draft-only edits, but do flush
    // whenever an indexable URL is created, changed, or removed.
    if (isIndexable || wasIndexable) {
      await refreshPublicBlog([existing.slug, slugToUse]);
    }

    if (isIndexable) {
      // Need slug to build URL — fetch from DB if not provided in payload
      if (slugToUse) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
        pingIndexNow([blogUrl(slugToUse), `${baseUrl}/blog`]).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, contentGuarded: content !== undefined && contentToSave === undefined });
  } catch (err: any) {
    const msg = err.message || 'Failed to update post';
    if (msg.includes('Duplicate entry')) return NextResponse.json({ error: 'A post with that slug already exists' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const post = await getPostByIdAdmin(Number(id));
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  const searchParams = request.nextUrl.searchParams;
  const forcePermanent = searchParams.get('permanent') === 'true';

  // If already in trash, or if requested explicitly, permanently delete the post.
  // Otherwise, safely transition it to the trash folder.
  if (post.status === 'trash' || forcePermanent) {
    await deletePost(Number(id));
  } else {
    await updatePostLifecycle([Number(id)], 'trash');
  }
  await refreshPublicBlog([post.slug]);
  return NextResponse.json({ ok: true, permanentlyDeleted: post.status === 'trash' || forcePermanent });
}
