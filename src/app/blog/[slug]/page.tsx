import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { generateBlogMetadata, blogPostsMetadata } from '@/lib/blog-metadata';
import { getPublishedPostBySlug, getRelatedPosts, getPostRedirect } from '@/lib/blog-db';
import type { RelatedPost } from '@/lib/blog-db';
import { getAuthorByNameAsync } from '@/lib/authors-db';
import DbBlogPostContent from '@/components/blog/DbBlogPostContent';
import Image from 'next/image';
import { Clock, Calendar } from 'lucide-react';
import { cmsSiteUrl, validateCanonicalUrl } from '@/lib/cms-content';
import { isOptimizableImageSrc, isRenderableImageSrc } from '@/lib/image-src';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

// Dynamic rendering guarantees compatibility with RootLayout headers and real-time CMS updates
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const baseUrl = cmsSiteUrl();

  // Check DB first
  try {
    const dbPost = (await getPublishedPostBySlug(decodedSlug)) || (await getPublishedPostBySlug(slug));
    if (dbPost) {
      const title = fitSeoTitle(dbPost.seo_title || dbPost.title);
      const description = fitMetaDescription(dbPost.seo_description || dbPost.excerpt || '', 'Read the latest Kruthika AI articles, guides, and practical insights.');
      // Social-sharing overrides fall back to SEO fields (editor exposes both)
      const ogTitle = dbPost.og_title || title;
      const ogDescription = dbPost.og_description || description;
      const rawOg = dbPost.og_image || dbPost.featured_image;
      const ogImage = rawOg
        ? (rawOg.startsWith('http://') || rawOg.startsWith('https://') ? rawOg : `${baseUrl}${rawOg.startsWith('/') ? '' : '/'}${rawOg}`)
        : `${baseUrl}/opengraph-image`;
      // Canonical must use the post's REAL slug, not the requested one — a hit
      // on /blog/My%20Post (or an uppercase variant matched by the LOWER(?)
      // clause in getPublishedPostBySlug) otherwise canonicalised to itself
      // instead of to the one indexable URL.
      const canonicalUrl = validateCanonicalUrl(dbPost.canonical_url, `${baseUrl}/blog/${dbPost.slug}`);
      return {
        title,
        description,
        authors: [{ name: dbPost.author }],
        creator: dbPost.author,
        publisher: 'Kruthika.fun',
        alternates: {
          canonical: canonicalUrl,
          // Blog posts are single-language (English). Using 'en' alone is an
          // incomplete BCP-47 tag for hreflang purposes; x-default is the
          // correct signal for "this is the canonical, no per-region variant".
          languages: {
            'x-default': canonicalUrl,
          },
        },
        robots: dbPost.noindex
          ? { index: false, follow: false }
          : {
              index: true, follow: true, nocache: false,
              googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
            },
        openGraph: {
          title: ogTitle,
          description: ogDescription,
          url: canonicalUrl,
          siteName: 'Kruthika AI Girlfriend',
          images: [{ url: ogImage, width: 1200, height: 630, alt: dbPost.featured_image_alt || title }],
          locale: 'en_US',
          type: 'article',
          publishedTime: dbPost.date_published ?? undefined,
          modifiedTime: dbPost.date_modified ?? undefined,
          authors: [dbPost.author],
          tags: dbPost.long_tail_keywords ?? [],
        },
        twitter: {
          card: 'summary_large_image',
          title: ogTitle,
          description: ogDescription,
          images: [ogImage],
          creator: '@kruthikafun',
          site: '@kruthikafun',
        },
        // NOTE: no `other` block needed — openGraph.type='article' with
        // publishedTime/modifiedTime/authors/tags above already emits
        // <meta property="article:published_time|modified_time|author|tag">
        // correctly. Duplicating them via `other` produced a second set of
        // name= (not property=) tags — redundant HTML in every post's head.
      };
    }
  } catch { /* fall through to static */ }

  // Fall back to static metadata
  if (!blogPostsMetadata[slug]) {
    return {
      title: 'Blog Post Not Found',
      description: 'The requested blog post could not be found.',
      robots: { index: false, follow: false },
    };
  }
  return generateBlogMetadata(slug);
}

// ── Related Articles (server component) ─────────────────────────────────────
function RelatedArticleCard({ post }: { post: RelatedPost }) {
  const date = post.date_published
    ? new Date(post.date_published).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
      })
    : '';
  return (
    <a
      href={`/blog/${post.slug}`}
      className="group block border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-purple-300 transition-all bg-card"
    >
      {isRenderableImageSrc(post.featured_image) && (
        <div className="relative w-full h-44 overflow-hidden bg-muted">
          <Image
            src={post.featured_image}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
            // Editor-supplied host outside next.config.js remotePatterns would
            // otherwise throw and 500 the whole article — see lib/image-src.ts.
            unoptimized={!isOptimizableImageSrc(post.featured_image)}
          />
        </div>
      )}
      <div className="p-4">
        {post.category_name && (
          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full mb-2 inline-block">
            {post.category_name}
          </span>
        )}
        <h3 className="font-bold text-base leading-snug mb-2 group-hover:text-purple-600 transition-colors line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />{date}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{post.reading_time_minutes} min
          </span>
        </div>
      </div>
    </a>
  );
}

async function RelatedArticles({ slug, categoryId }: { slug: string; categoryId: number | null }) {
  const related = await getRelatedPosts(slug, categoryId, 3);
  if (!related.length) return null;
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 border-t border-border pt-8 mt-2">
      <h2 className="text-lg font-bold mb-5 text-foreground">You Might Also Like</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {related.map(p => <RelatedArticleCard key={p.slug} post={p} />)}
      </div>
    </section>
  );
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  // Check DB first
  let replacementSlug: string | null = null;
  try {
    const dbPost = (await getPublishedPostBySlug(decodedSlug)) || (await getPublishedPostBySlug(slug));
    if (dbPost) {
      const authorRecord = await getAuthorByNameAsync(dbPost.author);
      return (
        <>
          <DbBlogPostContent post={dbPost} authorRecord={authorRecord} />
          <RelatedArticles slug={dbPost.slug} categoryId={dbPost.category_id} />
        </>
      );
    }
    replacementSlug = (await getPostRedirect(decodedSlug)) || (await getPostRedirect(slug));
  } catch { /* fall through */ }
  if (replacementSlug) redirect(`/blog/${replacementSlug}`);

  // No static posts — all content is CMS-managed
  notFound();
}
