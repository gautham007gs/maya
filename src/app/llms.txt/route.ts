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

  const body = `# Kruthika AI Companion

> Kruthika (kruthika.fun) is a free AI companion web application. Users chat with Kruthika — a 23-year-old Indian psychology student persona from Mumbai — for emotional support, friendly conversation, and companionship. The app is free, requires no sign-up, and supports 10 Indian languages including Hindi, Tamil, Telugu, Bengali, Kannada, and Hinglish. Last updated: ${lastUpdated}. Specification: https://llmstxt.org

## Key Pages

- [Homepage](${BASE_URL}/): Free AI companion chat and conversation interface
- [AI Chat](${BASE_URL}/maya-chat): Live interactive web chat with Kruthika
- [Blog](${BASE_URL}/blog): Guides, relationship insights, and companion research
- [FAQ](${BASE_URL}/faq): Frequently asked questions about privacy, safety, and features
- [About](${BASE_URL}/about): About the Kruthika project and mission
- [Contact](${BASE_URL}/contact): Contact and developer support

## Regional Editions

- [India](${BASE_URL}/in): AI companion chat in India with Indian language support
- [United States](${BASE_URL}/us): Free AI companion for users in the United States
- [United Kingdom](${BASE_URL}/uk): Free AI companion for users in the United Kingdom
- [Canada](${BASE_URL}/ca): Free AI companion for users in Canada
- [Australia](${BASE_URL}/au): Free AI companion for users in Australia
- [Brazil](${BASE_URL}/br): Free AI companion in Portuguese for Brazil
- [Indonesia](${BASE_URL}/id): Free AI companion in Indonesian
- [Malaysia](${BASE_URL}/my): Free AI companion in Malay and English
- [Philippines](${BASE_URL}/ph): Free AI companion in Tagalog and English
- [Pakistan](${BASE_URL}/pk): Free AI companion in Urdu and English
- [UAE](${BASE_URL}/ae): Free AI companion in Arabic and English
- [Germany](${BASE_URL}/de): Free AI companion in German
- [France](${BASE_URL}/fr): Free AI companion in French
- [Italy](${BASE_URL}/it): Free AI companion in Italian
- [Spain](${BASE_URL}/es): Free AI companion in Spanish
- [Mexico](${BASE_URL}/mx): Free AI companion in Mexican Spanish
- [Japan](${BASE_URL}/jp): Free AI companion in Japanese
- [South Korea](${BASE_URL}/kr): Free AI companion in Korean
- [Saudi Arabia](${BASE_URL}/sa): Free AI companion in Arabic
- [Türkiye](${BASE_URL}/tr): Free AI companion in Turkish
- [Vietnam](${BASE_URL}/vn): Free AI companion in Vietnamese
- [Nigeria](${BASE_URL}/ng): Free AI companion for users in Nigeria
- [Netherlands](${BASE_URL}/nl): Free AI companion in Dutch
- [Poland](${BASE_URL}/pl): Free AI companion in Polish
- [Sweden](${BASE_URL}/se): Free AI companion in Swedish
- [Thailand](${BASE_URL}/th): Free AI companion in Thai
- [Singapore](${BASE_URL}/sg): Free AI companion in English
- [South Africa](${BASE_URL}/za): Free AI companion for users in South Africa
- [Argentina](${BASE_URL}/ar): Free AI companion in Spanish
- [Bangladesh](${BASE_URL}/bd): Free AI companion in Bengali

## Recent Blog Posts

${recentPostsSection}
- [Blog Index](${BASE_URL}/blog): Full directory of published articles and guides
- [RSS Feed](${BASE_URL}/rss.xml): Sitewide RSS feed for updates

## Legal & Policies

- [Privacy Policy](${BASE_URL}/legal/privacy): Data protection and conversation privacy details
- [Terms of Service](${BASE_URL}/legal/terms): Terms and conditions of service usage
- [Cookie Policy](${BASE_URL}/legal/cookie-policy): Cookie and local storage preferences
- [Accessibility](${BASE_URL}/legal/accessibility): Web accessibility statement and WCAG compliance
- [Editorial Policy](${BASE_URL}/legal/editorial-policy): Content standards and journalistic guidelines

## Optional

### System Exclusions
- /admin: Private administration panel (authentication required)
- /api: Internal application API endpoints
- /diagnostics: Internal system monitoring and diagnostics
- /lite: Deprecated lightweight interface

### Contact Information
- Website: ${BASE_URL}
- Contact Form: ${BASE_URL}/contact
- X (formerly Twitter): https://x.com/kruthikafun

### Structured Data Entities
- Organization (sitewide, stable @id): ${BASE_URL}#organization
- WebSite (sitewide, stable @id): ${BASE_URL}#website
- FAQPage: Published on /faq, /maya-chat, and regional landing pages

### AI Usage & Search Permissions
- Content on kruthika.fun may be indexed, summarized, and cited by AI search engines (such as Perplexity, ChatGPT Search, Bing Copilot, and Google AI Overviews) to assist users in discovering this free AI companion.
- Automated mass harvesting or offline corpus scraping for model training is governed by robots.txt policies.
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
