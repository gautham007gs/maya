// SEO metadata for static blog posts
// Static posts have been fully replaced by CMS-authored posts (admin panel → Blog).
// All blog content is managed via the Admin CMS. This file is kept so imports
// don't break; the record and slug list are intentionally empty.

import { Metadata } from 'next';
import { fitMetaDescription, fitSeoTitle } from './seo-standards';

export interface BlogPostMeta {
  title: string;
  slug: string;
  description: string;
  keywords: string;
  author: string;
  authorTitle: string;
  datePublished: string;
  dateModified: string;
  image?: string;
  longTailKeywords: string[];
  wordCount: number;
  readingTimeMinutes: number;
}

// Empty — all posts live in the CMS (MySQL blog_posts table)
export const blogPostsMetadata: Record<string, BlogPostMeta> = {};

/** Returns all static blog slugs — always empty; CMS slugs come from getPublishedPosts() */
export function getAllBlogSlugs(): string[] {
  return [];
}

// Generate Next.js metadata for a static blog post (no-op now that all posts are in CMS)
export function generateBlogMetadata(slug: string): Metadata {
  const meta = blogPostsMetadata[slug];

  if (!meta) {
    return {
      title: fitSeoTitle('AI Girlfriend Blog'),
      description: fitMetaDescription('Read our latest articles on AI girlfriend apps, virtual companionship, and the technology behind them.'),
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';
  const url = `${baseUrl}/blog/${slug}`;

  return {
    title: fitSeoTitle(meta.title),
    description: fitMetaDescription(meta.description),
    // keywords meta tag removed — deprecated by Google in 2009 and ignored by
    // all major search engines. Consistent with the DB-post metadata path in
    // blog/[slug]/page.tsx which never emits keywords (audit H1).
    authors: [{ name: meta.author }],
    creator: meta.author,
    publisher: 'Kruthika.fun',
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: 'Kruthika AI Girlfriend',
      images: [{ url: meta.image || `${baseUrl}/og-image.jpg`, width: 1200, height: 630 }],
      locale: 'en_US',
      type: 'article',
      publishedTime: meta.datePublished,
      modifiedTime: meta.dateModified,
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [meta.image || `${baseUrl}/og-image.jpg`],
      creator: '@kruthikafun',
      site: '@kruthikafun',
    },
  };
}
