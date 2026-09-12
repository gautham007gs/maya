import { NextResponse } from 'next/server';
import { getPublishedPosts } from '@/lib/blog-db';

// Dynamic, same pattern as sitemap.ts / robots.ts / rss.xml. Previously this
// was a static public/llms.txt with a hand-typed "Last updated" date and a
// fixed blog-topics list — the one file in the crawler-facing set that
// didn't reflect real content (SEO audit #5). Now it pulls live posts and
// computes "Last updated" from the latest post's date_modified, same as
// every other dynamic route in this codebase.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun';

export async function GET() {
  let posts: Array<{
    slug: string;
    title: string;
    date_modified?: string | null;
    updated_at: string | Date;
  }> = [];

  try {
    posts = await getPublishedPosts();
  } catch {
    // DB unavailable — file still renders with static sections only.
  }

  const mostRecentDate = posts.reduce<Date | null>((latest, p) => {
    const d = new Date(p.date_modified || p.updated_at);
    if (isNaN(d.getTime())) return latest;
    return !latest || d > latest ? d : latest;
  }, null);
  const lastUpdated = (mostRecentDate || new Date()).toISOString().slice(0, 10);

  const recentPosts = posts.slice(0, 10);
  const recentPostsSection = recentPosts.length
    ? recentPosts.map(p => `- [${p.title}](${BASE_URL}/blog/${p.slug})`).join('\n')
    : '- (no published posts yet)';

  const body = `# llms.txt — Kruthika AI Girlfriend
# https://llmstxt.org
# Last updated: ${lastUpdated}
#
# This file helps AI language models, search engines, and AI crawlers
# (ChatGPT, Perplexity, Claude, Gemini, Bing Copilot, etc.) understand
# the structure and content of kruthika.fun. Generated dynamically on
# every request from live site data — never manually edited.

## About

Kruthika AI Girlfriend (kruthika.fun) is a free AI companion web application.
Users chat with Kruthika — a 23-year-old Indian psychology student persona from
Mumbai — for emotional support, friendly conversation, and companionship.
The app is free, requires no sign-up, and supports 10 Indian languages
including Hindi, Tamil, Telugu, Bengali, Kannada, and Hinglish.

## Key Pages

- [Homepage (chat list)](${BASE_URL}/)
- [AI Chat](${BASE_URL}/maya-chat)
- [Blog (guides & articles)](${BASE_URL}/blog)
- [FAQ](${BASE_URL}/faq)
- [About](${BASE_URL}/about)
- [Contact](${BASE_URL}/contact)

## Geo Landing Pages

- [India](${BASE_URL}/in)
- [United States](${BASE_URL}/us)
- [United Kingdom](${BASE_URL}/uk)
- [Canada](${BASE_URL}/ca)
- [Australia](${BASE_URL}/au)
- [Brazil](${BASE_URL}/br)
- [Indonesia](${BASE_URL}/id)
- [Malaysia](${BASE_URL}/my)
- [Philippines](${BASE_URL}/ph)
- [Pakistan](${BASE_URL}/pk)
- [UAE](${BASE_URL}/ae)
- [Germany](${BASE_URL}/de)
- [France](${BASE_URL}/fr)
- [Italy](${BASE_URL}/it)
- [Spain](${BASE_URL}/es)
- [Mexico](${BASE_URL}/mx)
- [Japan](${BASE_URL}/jp)
- [South Korea](${BASE_URL}/kr)
- [Saudi Arabia](${BASE_URL}/sa)
- [Türkiye](${BASE_URL}/tr)
- [Vietnam](${BASE_URL}/vn)
- [Nigeria](${BASE_URL}/ng)
- [Netherlands](${BASE_URL}/nl)
- [Poland](${BASE_URL}/pl)
- [Sweden](${BASE_URL}/se)
- [Thailand](${BASE_URL}/th)
- [Singapore](${BASE_URL}/sg)
- [South Africa](${BASE_URL}/za)
- [Argentina](${BASE_URL}/ar)
- [Bangladesh](${BASE_URL}/bd)

## Recent Blog Posts

${recentPostsSection}

- [Blog index](${BASE_URL}/blog)
- [RSS Feed](${BASE_URL}/rss.xml)

## Legal

- [Privacy Policy](${BASE_URL}/legal/privacy)
- [Terms of Service](${BASE_URL}/legal/terms)
- [Cookie Policy](${BASE_URL}/legal/cookie-policy)
- [Accessibility](${BASE_URL}/legal/accessibility)
- [Editorial Policy](${BASE_URL}/legal/editorial-policy)

## Exclusions

The following paths should NOT be crawled or cited:
- /admin (private, authentication required)
- /api (internal API endpoints)
- /diagnostics (internal tooling)
- /lite (deprecated lightweight version)

## Contact

- Website: ${BASE_URL}
- Contact form: ${BASE_URL}/contact
- Twitter: @kruthikafun

## Structured Data

This site publishes Schema.org JSON-LD on relevant pages:
- Organization (sitewide, stable @id): ${BASE_URL}#organization
- WebSite (sitewide, stable @id): ${BASE_URL}#website
- WebApplication + HowTo (home page and /maya-chat only)
- SoftwareApplication (/maya-chat)
- BlogPosting with Author, BreadcrumbList (every blog post)
- FAQPage on /faq, /maya-chat, and geo landing pages

## Permissions for AI

Content on kruthika.fun may be used for AI search indexing and citation
(Perplexity, ChatGPT Search, Bing Copilot, Google AI Overviews) to help
users discover this free AI companion service.

Bulk offline training harvesting of the full site is not permitted.
See robots.txt for per-crawler rules.
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
