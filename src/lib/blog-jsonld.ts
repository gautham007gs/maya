/**
 * blog-jsonld.ts
 *
 * Single source of truth for the JSON-LD `@graph` emitted on a published
 * blog post. Previously the public page (`DbBlogPostContent.tsx`) built its
 * own graph here while the admin editor's "Schema Preview" panel used a
 * completely different generator (`schema-generator.ts`), so what an editor
 * saw before publishing never matched what Google actually received —
 * that's what produced the "so is there two schemas, does it work?"
 * confusion. Both now call this one function.
 *
 * Pure TypeScript, no server-only imports — safe in client components
 * (the admin editor preview) and server components (the public page) alike.
 */
import { buildAuthorPersonJsonLd } from './author-jsonld';

export interface JsonLdFaqItem { question: string; answer: string; }

/** Only the fields the graph actually reads — works for a full DB row
 *  (public page) or the in-progress editor's post state (preview), which
 *  is exactly why this is its own narrow shape instead of importing
 *  `DbBlogPost` and demanding every column be present before a post is
 *  even saved. */
export interface JsonLdPostInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  author: string;
  author_title?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  status?: string;
  featured_image?: string | null;
  schema_type?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  long_tail_keywords?: string[] | null;
  og_image?: string | null;
  canonical_url?: string | null;
  faq_items?: JsonLdFaqItem[] | null;
  word_count?: number | null;
  reading_time_minutes?: number | null;
  language?: string | null;
  date_published?: string | null;
  date_modified?: string | null;
  author_profile?: {
    bio?: string | null;
    title?: string | null;
    avatar?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    expertise?: string[] | null;
    location?: string | null;
  } | null;
}

// schema_type is a free-form column, but only these map to a real
// Schema.org Article subtype. "FAQPage" used to be offered as a schema_type
// choice in the editor, which produced an Article node wrongly typed as
// FAQPage (missing FAQPage's own required fields, while carrying
// Article-only fields like headline/wordCount that FAQPage doesn't define).
// FAQ rich results are added automatically below whenever FAQ items exist,
// independent of this — so anything that isn't a real article subtype
// safely falls back to BlogPosting instead of corrupting the article node.
const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'HowTo']);

/** Safely serialize editor-controlled JSON-LD for an HTML script element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function resolvePageUrl(canonicalUrl: string | null | undefined, fallback: string, baseUrl: string): string {
  if (!canonicalUrl) return fallback;
  try {
    const canonical = new URL(canonicalUrl);
    const base = new URL(baseUrl);
    return canonical.protocol === 'https:' && canonical.host === base.host ? canonical.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function resolveArticleType(schemaType?: string | null): 'Article' | 'BlogPosting' | 'NewsArticle' | 'TechArticle' | 'HowTo' {
  return ARTICLE_TYPES.has(schemaType || '') ? (schemaType as any) : 'BlogPosting';
}

export function buildGraphJsonLd(post: JsonLdPostInput, baseUrl: string, authorSlug: string): object {
  const pageUrl    = resolvePageUrl(post.canonical_url, `${baseUrl}/blog/${post.slug}`, baseUrl);
  const ogImage    = post.og_image || post.featured_image || `${baseUrl}/og-image.jpg`;
  const keywords   = [post.seo_keywords, ...(post.long_tail_keywords ?? [])].filter(Boolean).join(', ');
  const headline   = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || '';
  // Use UTC (Z) not +05:30: date-only DB strings represent calendar dates,
  // not IST-midnight instants. Hardcoding +05:30 caused the published date to
  // appear one calendar day behind for crawlers in UTC+0 to UTC+4 zones.
  const toISO = (d: string | null | undefined) => d ? `${d}T00:00:00Z` : undefined;
  const articleType = resolveArticleType(post.schema_type);
  const faqItems = (post.faq_items || []).filter(f => f.question?.trim() && f.answer?.trim());
  const wordCount = post.word_count ?? 0;
  const readingTime = post.reading_time_minutes ?? 1;

  const graph: object[] = [
    {
      '@type': 'WebPage',
      '@id': pageUrl,
      url: pageUrl,
      name: headline,
      description,
       inLanguage: post.language || 'en',
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', '.article-excerpt', 'h2:first-of-type'],
      },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      ...(post.featured_image && { primaryImageOfPage: { '@id': `${pageUrl}#featured-image` } }),
    },
    {
      '@type': articleType,
      '@id': `${pageUrl}#article`,
      isPartOf: { '@id': pageUrl },
      headline,
      description,
      author: { '@id': `${baseUrl}/blog/author/${authorSlug}#person` },
      publisher: { '@id': `${baseUrl}#organization` },
      image: { '@id': `${pageUrl}#featured-image` },
      datePublished: toISO(post.date_published),
      dateModified:  toISO(post.date_modified ?? post.date_published),
      mainEntityOfPage: { '@id': pageUrl },
      keywords,
      wordCount,
      timeRequired: `PT${readingTime}M`,
       inLanguage: post.language || 'en',
      isAccessibleForFree: true,
      articleSection: post.category_name || 'AI Companion & Virtual Relationships',
      about: {
        '@type': 'Thing',
        name: post.category_name || 'AI Girlfriend & Companionship',
        sameAs: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      },
      mentions: [
        { '@type': 'Thing', name: 'Artificial Intelligence', sameAs: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
        { '@type': 'Thing', name: 'Virtual Companion', sameAs: 'https://en.wikipedia.org/wiki/Virtual_girlfriend' },
      ],
      ...(post.schema_type === 'TechArticle' && { proficiencyLevel: 'Beginner' }),
      ...(post.schema_type === 'HowTo' && faqItems.length > 0 && {
        totalTime: `PT${readingTime}M`,
        step: faqItems.map((f, i) => ({
          '@type': 'HowToStep', position: i + 1, name: f.question, text: f.answer,
        })),
      }),
    },
     buildAuthorPersonJsonLd({
       baseUrl,
       slug: authorSlug,
       name: post.author,
       title: post.author_title,
       ...post.author_profile,
       // No author_profile => no `blog_authors` row => /blog/author/<slug> 404s,
       // so the Person node must not advertise a profile URL.
       hasProfilePage: Boolean(post.author_profile),
     }),
    {
      '@type': 'ImageObject',
      '@id': `${pageUrl}#featured-image`,
      url: ogImage,
      width: 1200,
      height: 630,
    },
    {
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: 'Kruthika.fun',
      url: baseUrl,
      logo: { '@type': 'ImageObject', url: `${baseUrl}/icon-512.png`, width: 512, height: 512 },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
        ...(post.category_name && post.category_slug ? [{
          '@type': 'ListItem',
          position: 3,
          name: post.category_name,
          item: `${baseUrl}/blog/category/${post.category_slug}`,
        }] : []),
        {
          '@type': 'ListItem',
          position: post.category_name && post.category_slug ? 4 : 3,
          name: post.title,
          item: pageUrl,
        },
      ],
    },
  ];

  // FAQ rich results: added automatically whenever FAQ Q&A pairs exist,
  // regardless of the article's schema_type — this is the one and only
  // place FAQ schema comes from. There is deliberately no separate
  // "FAQ Page" schema_type anymore (see resolveArticleType above) — ticking
  // that box used to double up/confuse this exact block.
  if (faqItems.length > 0 && post.schema_type !== 'HowTo') {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: faqItems.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
