import React, { Suspense } from 'react';
import { Tag, ArrowRight, MessageCircle, Sparkles, Share2 } from 'lucide-react';
import type { DbBlogPost } from '@/lib/blog-db';
import { getAuthorByName, nameToSlug } from '@/lib/authors';
import { sanitizeCmsFaqItems, sanitizeCmsHtml } from '@/lib/cms-content';
import { buildGraphJsonLd, serializeJsonLd } from '@/lib/blog-jsonld';
// Server component islands — the ONLY client pieces of the article page
// (hero-image error fallback + ssr:false ad slots). Everything below renders
// entirely on the server: title, body HTML, ToC, FAQ, share links, JSON-LD.
import {
  BlogHeroImage,
  AuthorAvatarImage,
  BlogBannerAd,
  BlogSocialBarAd,
  BlogDesktopRailAd,
  BlogStickyMobileAd,
} from '@/components/blog/BlogPostIslands';
// Pure content-processing helpers live in a shared module so the admin editor's
// client-side preview can reuse them without importing THIS server component.
import {
  injectHeadingIds,
  processContentImages,
  splitByBlocks,
  numAdBreaks,
  PROSE,
} from '@/components/blog/blog-content-utils';

// PROSE typography + content-processing helpers now live in
// '@/components/blog/blog-content-utils' (shared verbatim with the admin
// editor's live preview so the two can never drift apart).

// JSON-LD @graph builder now lives in '@/lib/blog-jsonld' so the admin

// JSON-LD @graph builder now lives in '@/lib/blog-jsonld' so the admin
// editor's Schema Preview panel can produce the exact same output before a
// post is even published — see that file for why.

// ── Share buttons (Item #34) ─────────────────────────────────────────────
function ShareButtons({ title, slug }: { title: string; slug: string }) {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun'}/blog/${slug}`;
  const encodedUrl   = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Share this article</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Share article">
        {/* X / Twitter */}
        <a
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank" rel="noopener noreferrer"
          aria-label="Share on X (Twitter)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.263 5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X / Twitter
        </a>
        {/* WhatsApp */}
        <a
          href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank" rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
        {/* Facebook */}
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank" rel="noopener noreferrer"
          aria-label="Share on Facebook"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Facebook
        </a>
        {/* LinkedIn */}
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank" rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          LinkedIn
        </a>
      </div>
    </div>
  );
}

// ── In-content ad ────────────────────────────────────────────────────────
function InContentAd({ slug, index }: { slug: string; index: number }) {
  return (
    <div className="py-4 my-8 bg-muted/20 -mx-6 sm:-mx-10 lg:-mx-16 px-6 sm:px-10 lg:px-16 border-y border-border/30">
      <p className="text-[9px] text-muted-foreground/40 text-center mb-2 uppercase tracking-widest">Advertisement</p>
      <Suspense fallback={<div className="h-16 bg-muted/40 animate-pulse rounded-xl" />}>
        <BlogBannerAd placementKey={`blog-native-incontent-${index}-${slug}`} className="rounded-xl overflow-hidden" refreshIntervalMs={90_000} />
      </Suspense>
    </div>
  );
}

// ── Author avatar initials fallback ─────────────────────────────────────
// The initials sit in the normal flow and the avatar is layered on top by the
// AuthorAvatarImage client island, which unmounts itself if the image 404s —
// so the initials become the fallback with no handler on this server component.
function AuthorAvatar({ name, avatar, size = 10 }: { name: string; avatar?: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const dimension = `${size * 0.25}rem`;
  return (
    <div style={{ width: dimension, height: dimension }}
      className="relative rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
      <span className="text-white text-xs font-bold">{initials}</span>
      {avatar && <AuthorAvatarImage src={avatar} alt={name} />}
    </div>
  );
}

// ── Byline wrapper ─────────────────────────────────────────────────────────
// Only bylines backed by a real `blog_authors` row have a profile page. Legacy
// posts store the author as free text, and /blog/author/<name-derived-slug>
// notFound()s for those — every such post used to ship 4 internal links to a
// 404. When there is no page we render the same markup with a non-anchor tag.
function MaybeAuthorLink({ href, className, fallbackTag: Tag = 'div', children }: {
  href: string | null;
  className?: string;
  fallbackTag?: 'div' | 'span';
  children: React.ReactNode;
}) {
  if (href) return <a href={href} className={className}>{children}</a>;
  return <Tag className={className}>{children}</Tag>;
}

function AuthorShareButtons({ name, slug }: { name: string; slug: string }) {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun'}/blog/author/${slug}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedName = encodeURIComponent(`Read more from ${name}`);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Share ${name}'s author profile`}>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Share2 className="h-3 w-3" /> Share author
      </span>
      <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedName}`} target="_blank" rel="noopener noreferrer"
        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors" aria-label={`Share ${name} on X`}>X</a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noopener noreferrer"
        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors" aria-label={`Share ${name} on LinkedIn`}>LinkedIn</a>
      <a href={`https://wa.me/?text=${encodedName}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer"
        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors" aria-label={`Share ${name} on WhatsApp`}>WhatsApp</a>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function DbBlogPostContent({ post, authorRecord: authorRecordProp }: { post: DbBlogPost; authorRecord?: import('@/lib/authors').Author | null }) {
  const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
  // Prefer the real DB author record (and its real slug) resolved server-side
  // in the parent page — falls back to the static list + name-derived slug
  // only when no admin-created author record matches (legacy posts).
  const authorRecord = authorRecordProp !== undefined ? authorRecordProp : getAuthorByName(post.author);
  const authorSlug   = authorRecord?.slug || nameToSlug(post.author);
  // A profile page exists only when an author record resolved (DB row, or the
  // static list). Without one, /blog/author/<authorSlug> notFound()s, so the
  // byline must not link there — see MaybeAuthorLink.
  const authorHref   = authorRecord ? `/blog/author/${authorSlug}` : null;
  const rawContent   = sanitizeCmsHtml(post.content || '', { firstImageEager: true });
  const faqItems     = sanitizeCmsFaqItems(post.faq_items);
  const safePost     = { ...post, faq_items: faqItems };
  // Inject heading IDs → process images (CLS prevention) → split for ads
  const content      = processContentImages(injectHeadingIds(rawContent));
  // Keep article monetisation useful without turning long posts into an ad
  // wall. A short post gets one contextual break; medium and long posts get
  // at most two, plus the dedicated banner/native/square units below.
  const breaks       = Math.min(numAdBreaks(post.word_count), 2);
  const segments     = splitByBlocks(content, breaks);
  const isHowTo      = post.schema_type === 'HowTo';
  const showFaq      = faqItems.length > 0 && !isHowTo;
  const jsonLd       = buildGraphJsonLd({
    ...safePost,
     category_slug: post.category_slug,
    author_profile: authorRecord ? {
      bio: authorRecord.bio,
      title: authorRecord.title,
      avatar: authorRecord.avatar,
      twitter: authorRecord.twitter,
      linkedin: authorRecord.linkedin,
      expertise: authorRecord.expertise,
      location: authorRecord.location,
    } : null,
  }, baseUrl, authorSlug);

  // timeZone: 'UTC' is required — date-only strings like "2026-07-13" are parsed as
  // UTC midnight by JS. Without it, browsers behind UTC shift the date back one day,
  // causing a server/client hydration mismatch (server renders UTC, client renders local).
  const formattedDate = post.date_published
    ? new Date(post.date_published).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : '';
  const modifiedDate = post.date_modified && post.date_modified !== post.date_published
    ? new Date(post.date_modified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <main id="main-content" className="min-h-screen bg-background">
        <div className="w-full max-w-[700px] mx-auto px-4 sm:px-6 py-8 sm:py-12">

          {/* ── Breadcrumb nav ──────────────────────────────────────────────── */}
          <nav aria-label="Breadcrumb" className="text-xs mb-8 flex items-center flex-wrap gap-1.5 text-muted-foreground">
            <a href="/" className="hover:text-primary transition-colors">Home</a>
            <span>/</span>
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
            {post.category_name && (
              <>
                <span>/</span>
                {post.category_slug ? (
                  <a href={`/blog/category/${post.category_slug}`} className="text-foreground/70 hover:text-primary transition-colors">
                    {post.category_name}
                  </a>
                ) : (
                  <span className="text-foreground/70">{post.category_name}</span>
                )}
              </>
            )}
          </nav>

          {/* ════════════════════════════════════════════════════════════════
               ARTICLE HEADER — standard editorial order:
               1. Category / type badges
               2. Title (H1)
               3. Excerpt / deck
               4. Author byline
               5. Hero image
              ════════════════════════════════════════════════════════════════ */}
          <article
            itemScope
            itemType={`https://schema.org/${post.schema_type === 'FAQPage' ? 'Article' : (post.schema_type || 'BlogPosting')}`}
          >
            <header className="mb-8">

              {/* 1. Badges ────────────────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {post.category_name && (
                  <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                    {post.category_name}
                  </span>
                )}
                {post.schema_type === 'NewsArticle' && (
                  <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">🗞️ News</span>
                )}
                {post.schema_type === 'HowTo' && (
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">🪜 How-To Guide</span>
                )}
                {post.schema_type === 'FAQPage' && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">❓ FAQ</span>
                )}
                {post.schema_type === 'TechArticle' && (
                  <span className="text-xs font-semibold text-cyan-700 bg-cyan-100 px-3 py-1 rounded-full">💻 Technical</span>
                )}
              </div>

              {/* 2. Title — Modern sans-serif: bold, clean tracking, clear hierarchy */}
              <h1
                itemProp="headline"
                className="font-sans text-[26px] sm:text-[34px] lg:text-[38px] font-extrabold leading-[1.22] tracking-[-0.025em] text-slate-900 mb-4"
              >
                {post.title}
              </h1>

              {/* 3. Excerpt / dek — Clean modern sans-serif, relaxed leading */}
              {post.excerpt && (
                <p
                  itemProp="description"
                  className="article-excerpt font-sans text-[16px] sm:text-[18px] font-normal leading-[1.6] text-slate-600 mb-6"
                >
                  {post.excerpt}
                </p>
              )}

              {/* 4. Author byline — Medium: sans-serif UI chrome, dot-separated meta ── */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4 border-y border-[#F2F2F2] mb-6">

                {/* Avatar + name + credentials */}
                <MaybeAuthorLink
                  href={authorHref}
                  className="flex items-center gap-3 group shrink-0"
                >
                  <AuthorAvatar
                    name={post.author}
                    avatar={authorRecord?.avatar}
                    size={11}
                  />
                  <div>
                    <span
                      itemProp="author"
                      itemScope
                      itemType="https://schema.org/Person"
                      className="block"
                    >
                      <span
                        itemProp="name"
                        className="text-[15px] font-semibold text-[#242424] group-hover:underline"
                      >
                        {post.author}
                      </span>
                    </span>
                    <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-[#6B6B6B] leading-tight mt-0.5">
                      {formattedDate && (
                        <time dateTime={post.date_published ?? ''} itemProp="datePublished">{formattedDate}</time>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{post.reading_time_minutes} min read</span>
                      {modifiedDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Updated {modifiedDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                </MaybeAuthorLink>
              </div>

              {/* 5. Hero image ────────────────────────────────────────────── */}
              {post.featured_image && (
                <figure className="mb-6 -mx-4 sm:-mx-6">
                  <BlogHeroImage
                    src={post.featured_image}
                    alt={post.featured_image_alt || post.title}
                  />
                  {post.featured_image_caption && (
                    <figcaption className="text-center text-xs text-muted-foreground mt-2 px-4 italic">
                      {post.featured_image_caption}
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Tags (below image) ─────────────────────────────────────── */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {post.tags.map(tag => (
                    <span key={tag} className="text-xs bg-muted/60 border border-border px-2.5 py-1 rounded-full text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* ── Top ad (just inside article, below fold) ───────────────── */}
            <div className="mb-6">
              <p className="text-[9px] text-muted-foreground/40 text-center mb-1.5 uppercase tracking-widest">Advertisement</p>
              <Suspense fallback={<div className="h-16 bg-muted/40 animate-pulse rounded-xl" />}>
                <BlogBannerAd placementKey={`blog-top-${post.slug}`} className="rounded-xl overflow-hidden" refreshIntervalMs={75_000} />
              </Suspense>
            </div>

            {/* ── HowTo steps ───────────────────────────────────────────── */}
            {isHowTo && faqItems.length > 0 && (
              <div className="mb-8 p-5 bg-green-50 border border-green-200 rounded-xl">
                <h2 className="text-xl font-bold mb-5 text-green-800 flex items-center gap-2">
                  🪜 Steps to Follow
                </h2>
                <ol className="space-y-4">
                  {faqItems.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="shrink-0 w-8 h-8 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                      <div>
                        <p className="font-semibold text-foreground mb-1">{step.question}</p>
                        <div className="text-sm text-foreground/75 leading-relaxed" dangerouslySetInnerHTML={{ __html: step.answer }} />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ── Article body with in-content ads ──────────────────────── */}
            <div itemProp="articleBody">
              {segments.length === 0 && (
                <p className="text-muted-foreground italic py-4">Content coming soon.</p>
              )}
              {segments.map((segment, i) => (
                <React.Fragment key={i}>
                  <div className={PROSE} dangerouslySetInnerHTML={{ __html: segment }} />
                  {i < segments.length - 1 && <InContentAd slug={post.slug} index={i + 1} />}
                </React.Fragment>
              ))}
            </div>

            {/* ── FAQ / People Also Ask ─────────────────────────────────── */}
            {showFaq && (
              <div className="mt-10 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold mb-5 text-foreground">Frequently Asked Questions</h2>
                <div className="space-y-3">
                  {faqItems.map((faq, i) => (
                    <details key={i} className="group border border-border rounded-xl overflow-hidden">
                      <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer font-medium text-[15px] sm:text-base leading-snug text-foreground select-none hover:bg-muted/40 transition-colors list-none">
                        <span>{faq.question}</span>
                        <span className="text-muted-foreground text-xl group-open:rotate-45 transition-transform shrink-0">+</span>
                      </summary>
                      <div className="px-5 pb-4 pt-1 text-[15px] sm:text-base font-normal text-foreground/80 leading-relaxed border-t border-border/50 [&_strong]:font-semibold [&_b]:font-semibold [&_p]:mb-2 [&_p:last-child]:mb-0"
                        dangerouslySetInnerHTML={{ __html: faq.answer }} />
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* ── Author bio box ────────────────────────────────────────── */}
            {(authorRecord || post.author_title) && (
              <div className="mt-10 p-5 sm:p-6 bg-muted/30 border border-border rounded-xl flex gap-4 items-start">
                <MaybeAuthorLink href={authorHref} className="shrink-0">
                  <AuthorAvatar name={post.author} avatar={authorRecord?.avatar} size={14} />
                </MaybeAuthorLink>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5 uppercase tracking-wide font-medium">Written by</p>
                  <MaybeAuthorLink href={authorHref} fallbackTag="span"
                    className="font-bold text-base text-foreground hover:text-primary transition-colors">
                    {post.author}
                  </MaybeAuthorLink>
                  {(post.author_title || authorRecord?.title) && (
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">{post.author_title || authorRecord?.title}</p>
                  )}
                  {authorRecord?.bio && (
                    <p className="text-sm text-foreground/75 leading-relaxed">{authorRecord.bio}</p>
                  )}
                  {authorHref && (
                    <>
                      <a href={authorHref}
                        className="inline-block mt-3 text-xs font-semibold text-primary hover:underline">
                        View all articles →
                      </a>
                      <AuthorShareButtons name={post.author} slug={authorSlug} />
                    </>
                  )}
                </div>
              </div>
            )}
          </article>

          {/* ── 300×250 box ad — above CTA ────────────────────────────────── */}
          <div className="mt-6 flex justify-center">
            <Suspense fallback={<div className="h-[250px] w-[300px] max-w-full bg-muted/40 animate-pulse rounded-xl" />}>
              <BlogBannerAd placementKey={`blog-box-precta-${post.slug}`} className="rounded-xl overflow-hidden" refreshIntervalMs={90_000} />
            </Suspense>
          </div>

          {/* ── Share buttons (Item #34) ─────────────────────────────────── */}
          <ShareButtons title={post.title} slug={post.slug} />

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="mt-8 py-10 px-6 sm:px-8 bg-gradient-to-r from-pink-600/10 via-purple-600/10 to-blue-600/10 rounded-2xl border border-purple-200/40 text-center">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 text-foreground">
              Ready to Experience AI Companionship?
            </h3>
            <p className="text-muted-foreground mb-6 leading-relaxed text-sm sm:text-base max-w-md mx-auto">
              Join thousands who have found meaningful connections with Kruthika — India's best AI girlfriend, completely free.
            </p>
            <a href="/maya-chat"
              className="inline-flex items-center gap-2.5 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 text-white px-7 py-3.5 rounded-full hover:shadow-xl hover:scale-105 transition-all duration-300 font-bold text-sm sm:text-base">
              <MessageCircle className="h-4 w-4" />
              Start Chatting with Kruthika — Free
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* ── More from the Blog ───────────────────────────────────────── */}
          <div className="mt-6 pt-8 border-t border-border">
            <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" /> More from the Blog
            </h3>
            <a href="/blog"
              className="flex items-center justify-between gap-4 border border-border rounded-xl p-5 hover:border-purple-400/60 hover:shadow-md hover:bg-purple-50/20 transition-all group">
              <div>
                <p className="font-semibold text-sm group-hover:text-purple-600 transition-colors leading-snug mb-1">
                  Explore All Articles
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Guides, reviews, and insights on AI companionship, emotional wellbeing, and the latest AI apps.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 shrink-0 transition-colors" />
            </a>
          </div>

          {/* ── Post-related native ad ────────────────────────────────────── */}
          <div className="mt-8">
            <p className="text-[9px] text-muted-foreground/40 text-center mb-1.5 uppercase tracking-widest">Advertisement</p>
            <Suspense fallback={<div className="h-16 bg-muted/40 animate-pulse rounded-xl" />}>
              <BlogBannerAd placementKey={`blog-native-footer-${post.slug}`} className="rounded-xl overflow-hidden" refreshIntervalMs={90_000} />
            </Suspense>
          </div>

        </div>
      </main>

      <BlogSocialBarAd page="blog" />
      <BlogDesktopRailAd />
      <BlogStickyMobileAd />
    </>
  );
}
