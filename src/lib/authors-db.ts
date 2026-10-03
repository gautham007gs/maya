import 'server-only';
import {
  getPublicAuthorBySlug, getPublicAuthorByName, getAllPublicAuthorSlugs, getCmsAuthors,
} from '@/lib/blog-db';
import { getAuthorBySlug, getAuthorByName, getAllAuthorSlugs, getAllAuthors, type Author } from '@/lib/authors';

// Split out from src/lib/authors.ts: that file is imported by the client
// component DbBlogPostContent.tsx, so anything in it that (even indirectly)
// pulls in the mysql2 client breaks the client bundle (mysql2 needs Node's
// net/tls modules, which don't exist in the browser). This file is safe to
// import only from server components / route handlers.

// ── DB-backed authors ────────────────────────────────────────────────────
// Authors created in the admin panel (including guest authors) live in the
// `blog_authors` table, not in the static AUTHORS list above. These helpers
// normalize a DB row into the same `Author` shape so every page that reads
// authors — /blog/author, /blog/author/[slug], and post bylines — can use
// either source interchangeably and never 404 on an admin-created author.

function cmsAuthorToAuthor(row: {
  slug: string; name: string; display_name: string | null; bio: string | null;
  avatar_url: string | null; designation: string | null; website_url: string | null;
  social_links: Record<string, string> | null; location: string | null; expertise: string[];
  seo_title: string | null; seo_description: string | null;
}): Author {
  const social = row.social_links || {};
  return {
    slug: row.slug,
    name: row.display_name || row.name,
    title: row.designation || 'Contributor',
    bio: row.bio || `${row.display_name || row.name} contributes to the Kruthika.fun blog.`,
    avatar: row.avatar_url || '/kruthika-avatar.svg',
    twitter: social.twitter || undefined,
    linkedin: social.linkedin || row.website_url || undefined,
    expertise: Array.isArray(row.expertise) ? row.expertise : [],
    location: row.location || 'Bengaluru, India',
    seo_title: row.seo_title,
    seo_description: row.seo_description,
  };
}

/** Author page lookup: tries the DB first (this is where admin-created and
 *  guest authors live), then falls back to the static legacy list. */
export async function getAuthorBySlugAsync(slug: string): Promise<Author | null> {
  try {
    const dbAuthor = await getPublicAuthorBySlug(slug);
    if (dbAuthor) return cmsAuthorToAuthor(dbAuthor);
  } catch { /* DB unavailable — fall through to static list */ }
  return getAuthorBySlug(slug);
}

/** Byline lookup by the plain-text `author` name stored on a blog post. */
export async function getAuthorByNameAsync(name: string): Promise<Author | null> {
  try {
    const dbAuthor = await getPublicAuthorByName(name);
    if (dbAuthor) return cmsAuthorToAuthor(dbAuthor);
  } catch { /* DB unavailable — fall through to static list */ }
  return getAuthorByName(name);
}

/**
 * Every byline string that should resolve to this author page, lower-cased.
 *
 * A post stores its author as free text (`blog_posts.author`), while an author
 * row has BOTH `name` and an optional `display_name`, plus a slug the editor
 * can set to anything. So `nameToSlug(post.author) === slug` alone missed
 * posts whenever the slug was hand-edited or the display name differed from
 * the name — the byline linked to an author page that then claimed "No
 * published articles yet".
 */
export async function getAuthorNameAliasesBySlug(slug: string): Promise<string[]> {
  const aliases = new Set<string>();
  try {
    const dbAuthor = await getPublicAuthorBySlug(slug);
    if (dbAuthor) {
      for (const value of [dbAuthor.name, dbAuthor.display_name]) {
        if (value && value.trim()) aliases.add(value.trim().toLowerCase());
      }
    }
  } catch { /* DB unavailable — caller still has the static fallback */ }
  const staticAuthor = getAuthorBySlug(slug);
  if (staticAuthor?.name) aliases.add(staticAuthor.name.trim().toLowerCase());
  if (['editorial-team', 'editorial team', 'kruthika-fun-team', 'kruthika-team'].includes(slug)) {
    aliases.add('editorial team');
    aliases.add('editorial-team');
    aliases.add('kruthika.fun team');
    aliases.add('kruthika team');
  }
  return Array.from(aliases);
}

/** Combined slug list — static + DB — for generateStaticParams. */
export async function getAllAuthorSlugsAsync(): Promise<string[]> {
  let dbSlugs: string[] = [];
  try {
    dbSlugs = await getAllPublicAuthorSlugs();
  } catch { /* DB unavailable at build time — static list still works */ }
  return Array.from(new Set([...getAllAuthorSlugs(), ...dbSlugs]));
}

/** Combined author list for the /blog/author index page. */
export async function getAllAuthorsAsync(): Promise<Author[]> {
  let dbAuthors: Author[] = [];
  try {
    const rows = await getCmsAuthors();
    dbAuthors = rows.map(cmsAuthorToAuthor);
  } catch { /* DB unavailable */ }
  const staticSlugs = new Set(dbAuthors.map((a: Author) => a.slug));
  // DB entries win on slug collisions (e.g. the team account was migrated
  // into the CMS) — only add static authors that aren't already covered.
  return [...dbAuthors, ...getAllAuthors().filter(a => !staticSlugs.has(a.slug))];
}
