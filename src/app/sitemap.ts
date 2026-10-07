import { MetadataRoute } from 'next'
import { getCategories, getPublishedPosts } from '@/lib/blog-db'
import { getAllAuthorSlugsAsync } from '@/lib/authors-db'
import { COUNTRY_CONFIGS, SUPPORTED_COUNTRIES } from '@/lib/locales'
import { COUNTRY_HREFLANG_MAP } from '@/lib/hreflang'

// Dynamic real-time sitemap: reflects live DB posts and admin mutations instantly.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BASE_URL = 'https://kruthika.fun'

// Hreflang alternates for the homepage, chat page, and each regional landing
// page. Both URL lists and language tags come from the country registry so a
// new supported market cannot be forgotten in the sitemap.
function buildGeoAlternates(baseUrl: string, selfPath?: string) {
  return {
    languages: {
      'x-default': `${baseUrl}/`,
      ...Object.fromEntries(
        Object.entries(COUNTRY_HREFLANG_MAP).map(([path, code]) => [code, `${baseUrl}${path}`]),
      ),
      ...(selfPath
        ? Object.fromEntries(
            Object.entries(COUNTRY_CONFIGS)
              .filter(([, country]) => country.path === selfPath)
              .map(([, country]) => [country.locale, `${baseUrl}${selfPath}`]),
          )
        : {}),
    },
  };
}

/** Only emit lastmod when it is backed by a real content timestamp. */
function validLastModified(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || BASE_URL

  // DB blog posts
  let dbBlogUrls: MetadataRoute.Sitemap = []
  let categoryUrls: MetadataRoute.Sitemap = []
  try {
    const dbPosts = await getPublishedPosts()
    dbBlogUrls = dbPosts.map(p => {
      const lastModified = validLastModified(p.date_modified || p.updated_at);
      return {
        url: `${baseUrl}/blog/${p.slug}`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      };
    })
  } catch { /* DB not available */ }
  try {
    const categories = await getCategories()
    categoryUrls = categories.map(category => ({
      url: `${baseUrl}/blog/category/${category.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.78,
    }))
  } catch { /* DB not available */ }

  // Author index page
  const authorIndexUrl: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/blog/author`,
    changeFrequency: 'monthly' as const,
    priority: 0.60,
  }];

  // Individual author pages — merges static + DB-backed authors (admin/authors
  // and guest authors created in blog_authors), so real author pages are never
  // silently missing from the sitemap. See SEO audit Critical #1.
  let authorUrls: MetadataRoute.Sitemap = []
  try {
    const authorSlugs = await getAllAuthorSlugsAsync()
    authorUrls = authorSlugs.map(slug => ({
      url: `${baseUrl}/blog/author/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    }))
  } catch { /* DB not available */ }

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: buildGeoAlternates(baseUrl),
    },
    {
      url: `${baseUrl}/maya-chat`,
      changeFrequency: 'daily',
      priority: 0.98,
    },
    ...SUPPORTED_COUNTRIES.map((code) => {
      const country = COUNTRY_CONFIGS[code];
      return {
        url: `${baseUrl}${country.path}`,
        changeFrequency: 'weekly' as const,
        priority: country.path === '/in' ? 0.92 : 0.83,
        alternates: buildGeoAlternates(baseUrl, country.path),
      };
    }),
    // === BLOG INDEX ===
    { url: `${baseUrl}/blog`, changeFrequency: 'daily', priority: 0.92 },
    // === DB BLOG POSTS ===
    ...dbBlogUrls,
    // === BLOG CATEGORIES ===
    ...categoryUrls,
    // === AUTHOR INDEX ===
    ...authorIndexUrl,
    // === INDIVIDUAL AUTHOR PAGES ===
    ...authorUrls,
    // === STATIC PAGES ===
    { url: `${baseUrl}/about`,                   changeFrequency: 'monthly', priority: 0.72 },
    { url: `${baseUrl}/faq`,                     changeFrequency: 'monthly', priority: 0.75 },
    { url: `${baseUrl}/contact`,                 changeFrequency: 'yearly',  priority: 0.65 },
    // /status is excluded — noindex page, no SEO value
    { url: `${baseUrl}/legal/privacy`,           changeFrequency: 'yearly',  priority: 0.45 },
    { url: `${baseUrl}/legal/terms`,             changeFrequency: 'yearly',  priority: 0.45 },
    { url: `${baseUrl}/legal/cookie-policy`,     changeFrequency: 'yearly',  priority: 0.35 },
    { url: `${baseUrl}/legal/editorial-policy`,  changeFrequency: 'yearly',  priority: 0.40 },
    { url: `${baseUrl}/legal/accessibility`,     changeFrequency: 'yearly',  priority: 0.35 },
  ];

  // A canonical URL must appear once even if a future content source happens
  // to return the same slug as another source. Duplicate sitemap entries do
  // not add discovery value and make coverage diagnostics harder to trust.
  return Array.from(new Map(entries.map((entry) => [entry.url, entry])).values());
}
