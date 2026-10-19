import { NextResponse } from 'next/server';
import { getPublishedPosts } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  let posts: Array<{
    slug: string;
    title: string;
    seo_description?: string | null;
    excerpt?: string | null;
    author: string;
    date_published?: string | null;
    date_modified?: string | null;
    updated_at: string | Date;
    featured_image?: string | null;
    category_name?: string | null;
    tags?: string[] | null;
  }> = [];

  try {
    posts = await getPublishedPosts();
  } catch {
    // DB unavailable — return empty feed rather than 500
  }

  const items = posts
    .slice(0, 50) // cap at 50 items
    .map((post) => {
      const url = `${BASE_URL}/blog/${post.slug}`;
      const pubDate = post.date_published
        ? new Date(post.date_published).toUTCString()
        : new Date(post.updated_at).toUTCString();
      const description = escapeXml(post.seo_description || post.excerpt || '');
      const title = escapeXml(post.title);
      const author = escapeXml(post.author);
      const category = post.category_name ? `<category>${escapeXml(post.category_name)}</category>` : '';
      const image = post.featured_image
        ? `<media:content url="${escapeXml(post.featured_image)}" medium="image" />`
        : '';

      return `
    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${description}</description>
      <author>noreply@kruthika.fun (${author})</author>
      <pubDate>${pubDate}</pubDate>
      ${category}
      ${image}
    </item>`;
    })
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Kruthika AI Girlfriend Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Guides, tips, and insights on AI companionship, virtual relationships, and emotional AI — from the team at Kruthika.fun.</description>
    <language>en-us</language>
    <managingEditor>noreply@kruthika.fun (Kruthika.fun Team)</managingEditor>
    <webMaster>noreply@kruthika.fun (Kruthika.fun Team)</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/icon-192.png</url>
      <title>Kruthika AI Girlfriend Blog</title>
      <link>${BASE_URL}/blog</link>
    </image>
    <copyright>© ${new Date().getFullYear()} Kruthika.fun. All rights reserved.</copyright>
    <category>AI Companions</category>
    <ttl>60</ttl>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}
