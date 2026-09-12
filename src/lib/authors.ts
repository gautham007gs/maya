/**
 * Static author registry.
 *
 * This used to ship with 14 pre-written author profiles (fabricated
 * credentials, bios, and locations) so every post had *something* to show
 * on its byline/author page out of the box. Per instruction, those are
 * removed: every author showing up on the site from now on should be a
 * real profile you created in /admin/authors, backed by `blog_authors`
 * (see authors-db.ts) — not a placeholder persona.
 *
 * This file now only holds the `Author` shape and the pure lookup/slug
 * helpers other modules already depend on. `AUTHORS` stays as the
 * (empty) last-resort fallback list authors-db.ts merges DB rows over —
 * emptying it doesn't remove any code path, it just means "no fabricated
 * fallback exists anymore, only what's actually in the database."
 *
 * One practical follow-up: any already-published post whose `author`
 * string doesn't match a real `blog_authors` row yet will still render a
 * byline (the raw name), but its "View author page" link will 404 until
 * you create a matching author in /admin/authors. Create one for whatever
 * name your existing posts use (e.g. your team name) so those links
 * resolve.
 */

export interface Author {
  slug: string;
  name: string;
  title: string;         // Short credentials line shown in bylines
  bio: string;           // 2-4 sentence bio for the author page
  avatar: string;        // Absolute URL or /public path
  twitter?: string;      // Handle without @
  linkedin?: string;     // Full URL
  expertise: string[];   // Topic tags
  location: string;      // City, Country
  seo_title?: string | null;
  seo_description?: string | null;
  postsCount?: number;   // Updated at runtime by getPostsByAuthorSlug
}

// Intentionally empty — see file header. Real authors live in the
// `blog_authors` table and are managed from /admin/authors.
const AUTHORS: Author[] = [];


// ── Lookup helpers ──────────────────────────────────────────────────────────

/** Find author by slug (used on author pages) */
export function getAuthorBySlug(slug: string): Author | null {
  return AUTHORS.find(a => a.slug === slug) ?? null;
}

/** Find author by their display name (used when rendering a blog post) */
export function getAuthorByName(name: string): Author | null {
  const normalized = name.trim().toLowerCase();
  return (
    AUTHORS.find(a => a.name.toLowerCase() === normalized) ??
    // Fallback: try slug-match from the name
    AUTHORS.find(a => a.slug === nameToSlug(normalized)) ??
    null
  );
}

/** Convert a display name to an author-page slug */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/dr\.\s*/g, 'dr-')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** All author slugs (for generateStaticParams) */
export function getAllAuthors(): Author[] {
  return AUTHORS;
}

export function getAllAuthorSlugs(): string[] {
  return AUTHORS.map(a => a.slug);
}

