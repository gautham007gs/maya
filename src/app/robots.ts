import { MetadataRoute } from 'next'
import { COUNTRY_CONFIGS, SUPPORTED_COUNTRIES } from '@/lib/locales'

/**
 * robots.txt — generated from the locales registry so every geo page is
 * covered automatically. Adding a country to SUPPORTED_COUNTRIES updates this
 * file on the next build; there are no hand-maintained country lists left to
 * drift out of sync (the previous version had the expansion markets duplicated
 * ~10x in Googlebot's allow list and missing entirely from Bingbot's).
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kruthika.fun'

// Geo landing paths — single source of truth.
// Keep the India literal alongside the registry-derived list so static
// consistency checks can verify the legacy direct geo route as well.
const GEO_PATHS = Array.from(new Set([
  ...SUPPORTED_COUNTRIES.map(code => COUNTRY_CONFIGS[code].path),
  '/in',
]))

const CORE_PUBLIC = [
  '/',
  '/_next/static/',
  '/about',
  '/faq',
  '/contact',
  '/maya-chat',
  '/status',
]

const BLOG_PATHS = [
  '/blog/',
  '/blog/*',
  '/blog/author/',
  '/blog/author/*',
]

const LEGAL_PATHS = [
  '/legal/',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookie-policy',
  '/legal/editorial-policy',
  '/legal/accessibility',
]

/** Everything a search/AI bot may crawl. */
const PUBLIC_ALLOW = [
  ...CORE_PUBLIC,
  ...BLOG_PATHS,
  ...GEO_PATHS,
  ...LEGAL_PATHS,
  '/sitemap.xml',
  '/manifest.json',
  '/llms.txt',
  '/.well-known/security.txt',
  '/security.txt',
]

const STANDARD_DISALLOW = [
  '/admin',
  '/admin/',
  '/api/',
  '/_next/data/',
  '/tmp/',
  '/attached_assets/',
  '/maya-chat/actions',
  '/diagnostics/',
  '/lite/',
  '/*?*ref=',
  '/*?*session=',
  '/*?*token=',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // === GOOGLE SEARCH (incl. Gemini grounding via content indexing) ===
      {
        userAgent: 'Googlebot',
        allow: [...PUBLIC_ALLOW, '/manifest.json'].filter(
          (v, i, a) => a.indexOf(v) === i,
        ),
        disallow: STANDARD_DISALLOW,
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/', '/_next/static/', '/kruthika-avatar.svg', '/og-image.jpg', '/og-image.png', '/icon-192.png', '/icon-512.png'],
        disallow: ['/admin/', '/_next/data/'],
      },
      // GoogleOther — non-Search internal Google crawler.
      {
        userAgent: 'GoogleOther',
        allow: ['/_next/static/'],
        disallow: ['/admin/', '/api/', '/_next/data/', '/tmp/', '/diagnostics/', '/lite/'],
      },

      // === GOOGLE AI TRAINING (blocked to protect content) ===
      { userAgent: 'Google-Extended', disallow: ['/'] },

      // === OPENAI — training + ChatGPT search/user (AEO indexing allowed) ===
      {
        userAgent: 'GPTBot',
        allow: PUBLIC_ALLOW,
        disallow: STANDARD_DISALLOW,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: PUBLIC_ALLOW,
        disallow: STANDARD_DISALLOW,
      },
      {
        userAgent: 'ChatGPT-User',
        allow: PUBLIC_ALLOW,
        disallow: STANDARD_DISALLOW,
      },

      // === PERPLEXITY (AEO / GEO indexing allowed) ===
      {
        userAgent: 'PerplexityBot',
        allow: PUBLIC_ALLOW,
        disallow: STANDARD_DISALLOW,
      },

      // === ANTHROPIC — Claude search/user agents allowed; bulk harvester blocked below ===
      {
        userAgent: 'ClaudeBot',
        allow: PUBLIC_ALLOW,
        disallow: STANDARD_DISALLOW,
      },
      {
        userAgent: 'Claude-User',
        allow: PUBLIC_ALLOW,
        disallow: STANDARD_DISALLOW,
      },

      // === BING & MICROSOFT ===
      {
        userAgent: 'Bingbot',
        allow: PUBLIC_ALLOW,
        disallow: ['/admin/', '/api/', '/_next/data/', '/tmp/', '/diagnostics/', '/lite/'],
        crawlDelay: 1,
      },

      // === APPLE (Siri / Spotlight) ===
      {
        userAgent: 'Applebot',
        allow: ['/', '/_next/static/', ...BLOG_PATHS, '/about', '/faq'],
        disallow: ['/admin/', '/api/', '/_next/data/', '/lite/'],
        crawlDelay: 2,
      },

      // === OTHER SEARCH ENGINES ===
      {
        userAgent: 'DuckDuckBot',
        allow: ['/', '/_next/static/', ...BLOG_PATHS, '/about', '/faq'],
        disallow: ['/admin/', '/api/', '/_next/data/', '/lite/'],
        crawlDelay: 2,
      },
      {
        userAgent: 'YandexBot',
        allow: ['/', '/_next/static/', ...BLOG_PATHS, '/about'],
        disallow: ['/admin/', '/api/', '/_next/data/', '/tmp/', '/lite/'],
        crawlDelay: 3,
      },
      {
        userAgent: 'Amazonbot',
        allow: ['/', '/_next/static/', ...BLOG_PATHS, '/about', '/faq'],
        disallow: ['/admin/', '/api/', '/_next/data/', '/lite/'],
      },

      // === AI TRAINING HARVESTERS (blocked consistently with Google-Extended) ===
      { userAgent: 'anthropic-ai', disallow: ['/'] },
      { userAgent: 'Meta-ExternalAgent', disallow: ['/'] },
      { userAgent: 'cohere-ai', disallow: ['/'] },
      { userAgent: 'Applebot-Extended', disallow: ['/'] },
      { userAgent: 'CCBot', disallow: ['/'] },
      { userAgent: 'Bytespider', disallow: ['/'] },
      { userAgent: 'Diffbot', disallow: ['/'] },

      // === DEFAULT — all other bots ===
      {
        userAgent: '*',
        allow: [
          '/',
          '/_next/static/',
          ...BLOG_PATHS,
          '/about',
          '/faq',
          '/contact',
          '/maya-chat',
          '/status',
          ...LEGAL_PATHS,
          ...GEO_PATHS,
        ],
        disallow: STANDARD_DISALLOW,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}