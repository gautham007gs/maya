import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Calendar, ArrowRight, BookOpen, Tag } from 'lucide-react';
import { getCategories, getPostsByCategory } from '@/lib/blog-db';
import type { DbBlogCategory, DbBlogPost } from '@/lib/blog-db';
import BreadcrumbSchema from '@/components/BreadcrumbSchema';
import { serializeJsonLd } from '@/lib/blog-jsonld';
import { fitMetaDescription, fitSeoTitle } from '@/lib/seo-standards';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

async function getCategory(slug: string): Promise<DbBlogCategory | null> {
  const categories = await getCategories();
  return categories.find(category => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) {
    notFound();
  }

  const title = fitSeoTitle(category.seo_title || `${category.name} — AI Girlfriend Blog`);
  const description = fitMetaDescription(
    category.seo_description || category.description,
    `Explore Kruthika.fun articles about ${category.name}, AI companionship, and emotional support.`,
  );
  const url = `${baseUrl}/blog/category/${category.slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { 'x-default': url },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Kruthika AI Girlfriend',
      locale: 'en_US',
      type: 'website',
      images: [{ url: `${baseUrl}/og-image.webp`, width: 1200, height: 630, alt: `${category.name} articles` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${baseUrl}/og-image.webp`],
    },
  };
}

function PostCard({ post }: { post: DbBlogPost }) {
  const date = post.date_published
    ? new Date(post.date_published).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
      })
    : '';
  return (
    <article className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
        {date && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{date}</span>}
        <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{post.reading_time_minutes} min read</span>
      </div>
      <h2 className="text-lg sm:text-xl font-bold mb-2">
        <a href={`/blog/${post.slug}`} className="hover:text-primary transition-colors">{post.title}</a>
      </h2>
      {(post.excerpt || post.seo_description) && (
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4 flex-1">{post.excerpt || post.seo_description}</p>
      )}
      <a href={`/blog/${post.slug}`} className="inline-flex items-center gap-1.5 text-primary font-medium text-sm hover:underline mt-auto">
        Read article <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

export default async function BlogCategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const posts = await getPostsByCategory(slug);
  const url = `${baseUrl}/blog/category/${category.slug}`;
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name: category.name,
    description: category.description || `Articles about ${category.name}.`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
        { '@type': 'ListItem', position: 3, name: category.name, item: url },
      ],
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: post.title,
        url: `${baseUrl}/blog/${post.slug}`,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionSchema) }} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: baseUrl },
        { name: 'Blog', url: `${baseUrl}/blog` },
        { name: category.name, url },
      ]} />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground flex items-center gap-2 mb-8">
            <a href="/" className="hover:text-primary">Home</a><span>/</span>
            <a href="/blog" className="hover:text-primary">Blog</a><span>/</span>
            <span className="text-foreground">{category.name}</span>
          </nav>
          <header className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary mb-3">
              <Tag className="h-4 w-4" /> Topic Category
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
              {category.name} — AI Companion Articles
            </h1>
            <p className="max-w-2xl mx-auto text-base text-muted-foreground leading-relaxed mb-4">
              {category.description || `In-depth analysis, research guides, and expert practical advice exploring ${category.name} in modern conversational AI and emotional companionship.`}
            </p>
            <p className="max-w-2xl mx-auto text-sm text-muted-foreground/90 leading-relaxed">
              Explore our curated resources written by relationship psychology specialists and AI researchers. Learn how conversational agents adapt to human emotions, support personal wellbeing, and foster healthy digital interactions.
            </p>
          </header>
          {posts.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-5">{posts.map(post => <PostCard key={post.slug} post={post} />)}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              No published articles are available in this category yet.
            </div>
          )}
        </div>
      </main>
    </>
  );
}