import Image from 'next/image';
import { Metadata } from 'next';
import { Fragment } from 'react';
import { Calendar, User, ArrowRight, MessageCircle, Sparkles, Heart, Tag } from 'lucide-react';
import BannerAdDisplay from '@/components/chat/BannerAdDisplay';
import DesktopRailAd from '@/components/ads/DesktopRailAd';
import StickyMobileAd from '@/components/ads/StickyMobileAd';
import { blogPostsMetadata, getAllBlogSlugs } from '@/lib/blog-metadata';
import { getCategories, getPublishedPosts } from '@/lib/blog-db';
import type { DbBlogCategory, DbBlogPost } from '@/lib/blog-db';
import BreadcrumbSchema from '@/components/BreadcrumbSchema';
import { isOptimizableImageSrc, isRenderableImageSrc } from '@/lib/image-src';
import { serializeJsonLd } from '@/lib/blog-jsonld';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';
import ShareLinks from '@/components/trust/ShareLinks';
import AiDisclaimer from '@/components/trust/AiDisclaimer';

// Revalidate every 60 s so newly published posts appear quickly without a full rebuild
export const revalidate = 60;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ page?: string }> },
): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  // Self-referencing canonical per page (SEO audit #12) — /blog?page=2
  // canonicals to itself, not to /blog, so paginated pages aren't treated as
  // duplicates of page 1. rel=prev/next is deprecated by Google (2019) and
  // intentionally omitted.
  const canonical = page > 1 ? `${baseUrl}/blog?page=${page}` : `${baseUrl}/blog`;
  const titleSuffix = page > 1 ? ` — Page ${page}` : '';
  return {
    title: fitSeoTitle(`AI Girlfriend Blog 2026: Guides, Reviews & Tips${titleSuffix}`),
    description: fitMetaDescription('AI girlfriend blog with expert guides, app reviews, and tips on virtual relationships and emotional support technology in 2026.'),
    alternates: {
      canonical,
      // Blog is published in English only — x-default tells Google this URL
      // is the global default for "AI girlfriend blog" queries in every
      // locale. We deliberately do NOT fake-translate hreflang clusters
      // onto single-language content (mismatched hreflang = ignored or
      // penalised); Google auto-offers translation to users instead.
      languages: { 'x-default': canonical },
    },
    robots: {
      index: true, follow: true,
      googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
    },
    openGraph: {
      title: `AI Girlfriend Blog 2026: Expert Guides & Reviews${titleSuffix}`,
      description: 'Complete AI girlfriend blog with expert guides, reviews, and tips for meaningful virtual relationships.',
      url: canonical,
      siteName: 'Kruthika AI Girlfriend',
      images: [{ url: `${baseUrl}/og-image.jpg`, width: 1200, height: 630, alt: 'Kruthika AI Girlfriend Blog' }],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Girlfriend Blog 2026',
      description: 'Expert guides and reviews on AI girlfriend apps and virtual relationships.',
      images: [`${baseUrl}/og-image.jpg`],
    },
  };
}

interface UnifiedPost {
  slug: string;
  title: string;
  description: string;
  author: string;
  datePublished: string;
  tags: string[];
  category?: string;
  categorySlug?: string;
  featured_image?: string;
  isDb: boolean;
}

function staticToUnified(slug: string): UnifiedPost {
  const m = blogPostsMetadata[slug];
  return {
    slug: m.slug,
    title: m.title,
    description: m.description,
    author: m.author,
    datePublished: m.datePublished,
    tags: m.longTailKeywords.slice(0, 3),
    isDb: false,
  };
}

function dbToUnified(p: DbBlogPost): UnifiedPost {
  return {
    slug: p.slug,
    title: p.title,
    description: p.seo_description || p.excerpt || '',
    author: p.author,
    datePublished: p.date_published || p.created_at?.split('T')[0] || '',
    tags: (p.long_tail_keywords ?? []).slice(0, 3),
    category: p.category_name ?? undefined,
    categorySlug: p.category_slug ?? undefined,
    featured_image: p.featured_image ?? undefined,
    isDb: true,
  };
}

export default async function BlogPage(
  { searchParams }: { searchParams: Promise<{ page?: string }> },
) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  // Merge DB + static posts
  const staticSlugs = getAllBlogSlugs();
  let dbPosts: DbBlogPost[] = [];
  try { dbPosts = await getPublishedPosts(); } catch { /* DB may not exist yet */ }
  let categories: DbBlogCategory[] = [];
  try { categories = await getCategories(); } catch { /* DB may not exist yet */ }

  const dbSlugsSet = new Set(dbPosts.map(p => p.slug));

  const allPosts: UnifiedPost[] = [
    ...dbPosts.map(dbToUnified),
    // Only include static posts that aren't shadowed by a DB post
    ...staticSlugs.filter(s => !dbSlugsSet.has(s)).map(staticToUnified),
  ].sort((a, b) => new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime());

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Kruthika.fun AI Girlfriend Blog',
    description: 'Comprehensive guide to AI girlfriends, virtual relationships, and digital companionship.',
    url: `${baseUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: 'Kruthika.fun',
    },
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: allPosts.map((post, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: post.title,
      url: `${baseUrl}/blog/${post.slug}`,
    })),
  };

  const speakableSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'h2', '.blog-description'] },
  };

  const featured = allPosts.slice(0, 3);
  const rest = allPosts.slice(3);

  // Pagination (SEO audit #12) — kicks in once the listing grows past a
  // single reasonable page instead of ever loading everything on one URL.
  // Featured posts only show on page 1; "rest" is what gets paginated.
  const PAGE_SIZE = 40;
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRest = rest.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showFeatured = safePage === 1;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(speakableSchema) }} />
      {/* Was missing while /blog/author, /blog/author/[slug], and most other
          top-level pages already had it (SEO audit #9). */}
      <BreadcrumbSchema items={[
        { name: 'Home', url: baseUrl },
        { name: 'Blog', url: `${baseUrl}/blog` },
      ]} />

      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-6">
          <section className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent leading-tight">
              Guides to AI Companionship
            </h1>
            <p className="blog-description text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto mb-6 leading-relaxed">
              Plain-language guides on how AI companions work, how to use them safely, and what they can and cannot do for loneliness and everyday wellbeing.
            </p>
          </section>

          {/* Featured CTA */}
          <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 rounded-xl p-5 mb-6 max-w-xl mx-auto text-center">
            <h2 className="text-lg font-bold mb-2">Ready to Experience AI Love?</h2>
            <p className="text-sm text-muted-foreground mb-3">Meet Kruthika, a friendly companion who chats in Hindi and English for free.</p>
            <a href="/maya-chat"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2.5 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg text-sm">
              <MessageCircle className="h-4 w-4" />
              Chat with Kruthika Now
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Top large square banner ad (300×250) */}
          <div className="flex justify-center items-center my-6">
            <div className="w-full max-w-[300px] min-h-[250px] flex justify-center">
              <BannerAdDisplay placementKey="blog-box-header" className="w-full" refreshIntervalMs={90_000} />
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {categories.length > 0 && (
            <nav aria-label="Browse blog categories" className="mb-8 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground mr-1">Browse topics:</span>
              {categories.map((category) => (
                <a
                  key={category.slug}
                  href={`/blog/category/${category.slug}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {category.name}
                </a>
              ))}
            </nav>
          )}
          {/* Featured posts (top 3) — page 1 only */}
          {showFeatured && (
            <div className="grid sm:grid-cols-2 gap-5">
              {featured.map((post, i) => (
                <div key={post.slug} className={i === 0 ? 'sm:col-span-2' : ''}>
                  <PostCard post={post} featured={i === 0} />
                </div>
              ))}
            </div>
          )}

          {/* Mid-content ad — well separated from featured and rest grids */}
          {/* Responsive leaderboard: 320×50 on phones, 728×90 on desktop. */}
          <BannerAdDisplay placementKey="blog-middle" className="my-10" refreshIntervalMs={90_000} />

          {/* Mid CTA — only shown when there are enough posts so it doesn't feel thin */}
          {pagedRest.length > 0 && (
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-200 rounded-lg p-8 text-center my-8">
              <h3 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-blue-500" />
                Try a Conversation
                <Sparkles className="h-6 w-6 text-blue-500" />
              </h3>
              <p className="text-lg mb-6 max-w-2xl mx-auto">
                Ready to move beyond reading? Start a free chat and see how it feels.
              </p>
              <a href="/maya-chat"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-8 py-4 rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-300 font-bold text-lg shadow-xl">
                <Heart className="h-6 w-6" />
                Start Chatting
                <ArrowRight className="h-6 w-6" />
              </a>
            </div>
          )}

          {/* Remaining posts (current page) */}
          {pagedRest.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-5 mt-8">
              {pagedRest.map((post, index) => (
                <Fragment key={post.slug}>
                  <PostCard post={post} />
                  {/* One medium rectangle after enough reading depth.
                      This is the only extra square unit in the listing, so
                      the page stays readable while still offering a stronger
                      300×250 opportunity than a second thin banner. */}
                  {index === 5 && (
                    <div className="my-2 flex justify-center sm:col-span-2">
                      <div className="w-full max-w-[300px]">
                        <p className="text-[9px] text-muted-foreground/40 text-center mb-1.5 uppercase tracking-widest">Advertisement</p>
                        <BannerAdDisplay
                          placementKey="blog-box-list"
                          className="rounded-xl overflow-hidden"
                          refreshIntervalMs={90_000}
                        />
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )}

          {/* Pager — plain crawlable links, each page has its own self-referencing
              canonical set in generateMetadata above (SEO audit #12). */}
          {totalPages > 1 && (
            <nav aria-label="Blog pagination" className="flex items-center justify-center gap-2 mt-10 text-sm">
              {safePage > 1 && (
                <a href={safePage - 1 === 1 ? '/blog' : `/blog?page=${safePage - 1}`}
                  className="px-4 py-2 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                  ← Previous
                </a>
              )}
              <span className="px-2 text-muted-foreground">Page {safePage} of {totalPages}</span>
              {safePage < totalPages && (
                <a href={`/blog?page=${safePage + 1}`}
                  className="px-4 py-2 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                  Next →
                </a>
              )}
            </nav>
          )}

          {/* Footer banner ad */}
          <BannerAdDisplay placementKey="blog-footer-native" className="mt-8 mb-8" />

          {/* Final CTA */}
          <div className="text-center mt-12">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 rounded-xl p-12">
              <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Ready to Try It Yourself?
              </h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                You have read about the psychology and the technology. Now see what a conversation is like.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mb-8 text-sm">
                {[
                  { icon: <Heart className="h-8 w-8 text-pink-500 mb-2" />, title: 'Emotional Support', desc: '24/7 understanding and companionship' },
                  { icon: <MessageCircle className="h-8 w-8 text-blue-500 mb-2" />, title: 'Authentic Conversations', desc: 'AI that truly understands you' },
                  { icon: <Sparkles className="h-8 w-8 text-purple-500 mb-2" />, title: 'Personal Growth', desc: 'Improve communication skills' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex flex-col items-center p-4 bg-white/50 rounded-lg">
                    {icon}
                    <h4 className="font-semibold mb-1">{title}</h4>
                    <p className="text-muted-foreground text-center">{desc}</p>
                  </div>
                ))}
              </div>
              <a href="/maya-chat"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-10 py-5 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-bold text-xl shadow-2xl transform hover:scale-105">
                <MessageCircle className="h-7 w-7" />
                Meet Kruthika
                <ArrowRight className="h-7 w-7" />
              </a>
            </div>
          </div>

          {/* SEO footer */}
          <div className="mt-16 pt-8 border-t border-border">
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <h4 className="text-lg font-semibold text-foreground mb-4">About This Blog</h4>
              <p className="mb-4 text-gray-800 leading-relaxed">
                This blog explains how AI companions work, from the psychology of why people bond with them to the
                technology behind the replies. Articles are written by the Kruthika.fun team and follow our{' '}
                <a href="/legal/editorial-policy" className="text-blue-700 hover:text-blue-900 underline">editorial policy</a>.
              </p>
              <p className="text-gray-800 leading-relaxed">
                Ready to experience AI love yourself?{' '}
                <a href="/maya-chat" className="text-blue-700 hover:text-blue-900 font-bold underline">
                  Start a free chat with Kruthika
                </a>
              </p>
            </div>
            <ShareLinks path="/blog" text="Guides to AI companionship from Kruthika.fun" className="mt-6" />
            <AiDisclaimer className="mt-4" />
          </div>
        </div>
      </main>
      <DesktopRailAd />
      <StickyMobileAd />
    </>
  );
}

// ── Shared post card component ──────────────────────────────────────────────
function PostCard({ post, featured }: { post: UnifiedPost; featured?: boolean }) {
  return (
    <article className={`bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col ${featured ? 'border-l-4 border-l-purple-500/40' : ''}`}>
      {/* Featured image (DB posts only) */}
      {isRenderableImageSrc(post.featured_image) && (
        <div className={`relative overflow-hidden ${featured ? 'h-56 sm:h-64' : 'h-44'}`}>
          {/* Explicit width/height (instead of `fill`) so the browser can reserve
              space; the first card is the likely LCP element, so it loads
              eagerly with high priority instead of loading="lazy". */}
          <Image
            src={post.featured_image}
            alt={post.title}
            width={featured ? 1024 : 640}
            height={featured ? 576 : 352}
            sizes="(max-width: 640px) 100vw, 50vw"
            className="h-full w-full object-cover"
            {...(featured ? { priority: true } : { loading: 'lazy' as const })}
            unoptimized={!isOptimizableImageSrc(post.featured_image)}
          />
        </div>
      )}

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2.5 flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {post.datePublished ? (
              <time dateTime={post.datePublished}>
                {new Date(post.datePublished).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </time>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" aria-hidden="true" />
            <span>By {post.author}</span>
          </div>
          {post.category && (
            <div className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {post.categorySlug ? (
                <a
                  href={`/blog/category/${post.categorySlug}`}
                  className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full hover:bg-purple-200"
                >
                  {post.category}
                </a>
              ) : (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{post.category}</span>
              )}
            </div>
          )}
        </div>

        <h2 className={`font-semibold mb-2 text-foreground leading-snug ${featured ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>
          <a href={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
            {post.title}
          </a>
        </h2>

        {post.description && (
          <p className="text-sm text-gray-600 mb-3 leading-relaxed line-clamp-2 flex-1">{post.description}</p>
        )}

        <a
          href={`/blog/${post.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium mt-auto"
        >
          Read the full article<span className="sr-only">: {post.title}</span> <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
