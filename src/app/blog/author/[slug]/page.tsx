import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { nameToSlug } from '@/lib/authors';
import { getAuthorBySlugAsync, getAuthorNameAliasesBySlug } from '@/lib/authors-db';
import { getPublishedPosts } from '@/lib/blog-db';
import { Calendar, MapPin, ExternalLink, Pen, Users, BookOpen, Tag } from 'lucide-react';
import Image from 'next/image';
import { buildAuthorPersonJsonLd } from '@/lib/author-jsonld';
import { isOptimizableImageSrc, isRenderableImageSrc } from '@/lib/image-src';
import { serializeJsonLd } from '@/lib/blog-jsonld';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlugAsync(slug);
  if (!author) {
    return {
      title: 'Author Not Found',
      description: 'The requested blog author could not be found.',
      robots: { index: false, follow: false },
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
  const url = `${baseUrl}/blog/author/${slug}`;
  const title = fitSeoTitle(author.seo_title || `${author.name} — AI & Psychology Author`);
  const description = fitMetaDescription(
    author.seo_description || author.bio,
    `Read expert articles by ${author.name} about AI companionship, psychology, and virtual relationships.`,
  );

  return {
    title,
    description,
    alternates: {
      canonical: url,
      // English-only author page → x-default self (global default).
      languages: { 'x-default': url },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    openGraph: {
      title,
      description,
      url,
      type: 'profile',
      siteName: 'Kruthika AI Girlfriend',
      images: [{ url: `${baseUrl}/og-image.jpg`, width: 1200, height: 630, alt: `${author.name} — Author at Kruthika.fun` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${baseUrl}/og-image.jpg`],
      site: '@kruthikafun',
      ...(author.twitter && { creator: `@${author.twitter}` }),
    },
  };
}

// ── Post card ───────────────────────────────────────────────────────────────
function PostCard({ post }: { post: Awaited<ReturnType<typeof getPublishedPosts>>[0] }) {
  const date = post.date_published
    ? new Date(post.date_published).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '';
  return (
    <a href={`/blog/${post.slug}`}
      className="group block border border-border rounded-none overflow-hidden hover:shadow-lg hover:border-purple-300 transition-all bg-card">
      {isRenderableImageSrc(post.featured_image) && (
        <Image src={post.featured_image} alt={post.title}
          width={600} height={176}
          className="w-full h-44 object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading="lazy"
          unoptimized={!isOptimizableImageSrc(post.featured_image)} />
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
          {date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{date}</span>}
          <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{post.reading_time_minutes} min</span>
        </div>
      </div>
    </a>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = await getAuthorBySlugAsync(slug);
  if (!author) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

  // Fetch posts by this author
  let posts: Awaited<ReturnType<typeof getPublishedPosts>> = [];
  try {
    const aliases = new Set(await getAuthorNameAliasesBySlug(slug));
    aliases.add(author.name.trim().toLowerCase());
    const all = await getPublishedPosts();
    posts = all.filter(p => {
      const byline = (p.author || '').trim().toLowerCase();
      return aliases.has(byline) || nameToSlug(byline) === slug;
    });
  } catch { /* DB unavailable */ }

  // JSON-LD: Person + ItemList of posts
  const personSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      buildAuthorPersonJsonLd({ baseUrl, slug, author }),
      {
        '@type': 'ProfilePage',
        '@id': `${baseUrl}/blog/author/${slug}`,
        url: `${baseUrl}/blog/author/${slug}`,
        name: `${author.name} — Author at Kruthika.fun`,
        mainEntity: { '@id': `${baseUrl}/blog/author/${slug}#person` },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
            { '@type': 'ListItem', position: 3, name: 'Authors', item: `${baseUrl}/blog/author` },
            { '@type': 'ListItem', position: 4, name: author.name, item: `${baseUrl}/blog/author/${slug}` },
          ],
        },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['.author-bio', 'h1'],
        },
      },
      ...(posts.length > 0 ? [{
        '@type': 'ItemList',
        name: `Articles by ${author.name}`,
        numberOfItems: posts.length,
        itemListElement: posts.slice(0, 10).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${baseUrl}/blog/${p.slug}`,
          name: p.title,
        })),
      }] : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(personSchema) }} />

      <main id="main-content" className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Breadcrumb */}
          <nav className="text-xs text-muted-foreground flex items-center gap-1.5 mb-8 flex-wrap">
            <a href="/" className="hover:text-primary transition-colors">Home</a>
            <span>/</span>
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
            <span>/</span>
            <span>Authors</span>
            <span>/</span>
            <span className="text-foreground font-medium">{author.name}</span>
          </nav>

          {/* Author card */}
          <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden mb-10">
            <div className="bg-gradient-to-br from-purple-600/10 via-pink-600/10 to-blue-600/10 px-6 sm:px-10 py-10">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                {/* Avatar — the Users glyph is the fallback UNDER the photo.
                    It used to be `absolute` inside a non-positioned box, so it
                    floated to an arbitrary ancestor and painted over the
                    avatar; now the photo is the layer on top and only shows
                    when there is one. */}
                <div className="shrink-0">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-white shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Users className="h-10 w-10 text-white" aria-hidden="true" />
                    {isRenderableImageSrc(author.avatar) && (
                      <Image
                        src={author.avatar}
                        alt={author.name}
                        width={96} height={96}
                        className="absolute inset-0 w-full h-full object-cover"
                        unoptimized={!isOptimizableImageSrc(author.avatar)}
                      />
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-1">{author.name}</h1>
                  <p className="text-sm sm:text-base text-purple-700 font-semibold mb-2">{author.title}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{author.location}</span>
                    <span className="flex items-center gap-1"><Pen className="h-3 w-3" />{posts.length} article{posts.length !== 1 ? 's' : ''}</span>
                    {author.twitter && (
                      <a href={`https://twitter.com/${author.twitter}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors">
                        <ExternalLink className="h-3 w-3" /> @{author.twitter}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="px-6 sm:px-10 py-6 border-t border-border">
              <p className="author-bio text-base sm:text-lg text-foreground/80 leading-relaxed">{author.bio}</p>
            </div>

            {/* Expertise tags */}
            {author.expertise.length > 0 && (
              <div className="px-6 sm:px-10 pb-6 flex flex-wrap gap-2 items-center border-t border-border/50 pt-4">
                <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {author.expertise.map(e => (
                  <span key={e}
                    className="text-xs font-medium px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Posts grid */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Pen className="h-5 w-5 text-purple-500" />
              {posts.length > 0
                ? `${posts.length} Article${posts.length !== 1 ? 's' : ''} by ${author.name}`
                : `Articles by ${author.name}`}
            </h2>

            {posts.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                <Pen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No published articles yet.</p>
                <p className="text-sm mt-1">Check back soon for content from {author.name}.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map(p => <PostCard key={p.slug} post={p} />)}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-12 text-center bg-gradient-to-r from-purple-600/10 to-pink-600/10 border border-purple-200/50 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-foreground mb-2">Read More on the Kruthika Blog</h3>
            <p className="text-muted-foreground text-sm mb-5">Expert guides on AI companionship, virtual relationships, and emotional wellbeing.</p>
            <a href="/blog"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-7 py-3 rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm">
              Explore All Articles →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
