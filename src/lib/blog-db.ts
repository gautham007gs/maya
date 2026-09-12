import 'server-only';
import { getMysqlClient } from './mysql-client';

export type SchemaType = 'BlogPosting' | 'Article' | 'NewsArticle' | 'TechArticle' | 'FAQPage' | 'HowTo';

export interface DbBlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  author: string;
  author_title: string | null;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  status: 'draft' | 'review' | 'scheduled' | 'published' | 'archived' | 'trash';
  featured_image: string | null;
  featured_image_alt: string | null;
  schema_type: SchemaType;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  long_tail_keywords: string[] | null;
  og_image: string | null;
  og_title?: string | null;
  og_description?: string | null;
  twitter_card?: 'summary' | 'summary_large_image';
  twitter_title?: string | null;
  twitter_description?: string | null;
  canonical_url: string | null;
  noindex: boolean;
  faq_items: Array<{ question: string; answer: string }> | null;
  word_count: number;
  reading_time_minutes: number;
  readability_score?: number | null;
  seo_score?: number | null;
  date_published: string | null;
  date_modified: string | null;
  scheduled_at?: string | null;
  scheduled_timezone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBlogCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
}

export interface CmsAuthor {
  id: number;
  slug: string;
  name: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  designation: string | null;
  company: string | null;
  website_url: string | null;
  social_links: Record<string, string> | null;
  location: string | null;
  expertise: string[];
  is_verified: boolean;
  is_guest: boolean;
  seo_title: string | null;
  seo_description: string | null;
}

export type AuthorRole = 'author' | 'editor' | 'admin';
export type AuthorStatus = 'active' | 'inactive';

export interface CmsAuthorAdmin extends CmsAuthor {
  status: AuthorStatus;
  role: AuthorRole;
  permissions: string[];
  deleted_at: string | null;
  published_count: number;
  draft_count: number;
}

export interface CmsCategoryAdmin {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  parent_name: string | null;
  seo_title: string | null;
  seo_description: string | null;
  color: string | null;
  icon: string | null;
  deleted_at: string | null;
  post_count: number;
}

export interface CmsTag {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

export type BlogAdminStatus = DbBlogPost['status'];
export type BlogAdminSort = 'updated' | 'created' | 'title' | 'published';
export interface BlogAdminListOptions {
  page?: number; perPage?: number; search?: string; status?: 'all' | BlogAdminStatus;
  categoryId?: number; sort?: BlogAdminSort; direction?: 'asc' | 'desc';
}
export interface BlogAdminListResult {
  posts: DbBlogPost[]; total: number; page: number; perPage: number; totalPages: number;
  counts: Record<BlogAdminStatus, number>;
}

export interface BlogRevision {
  id: number;
  post_id: number;
  revision_type: 'autosave' | 'manual' | 'restore';
  title: string;
  content: string | null;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface CmsMediaAsset {
  id: number;
  storage_path: string;
  public_url: string;
  filename: string;
  mime_type: string;
  bytes: number;
  alt_text: string | null;
  caption: string | null;
  folder?: string | null;
  width?: number | null;
  height?: number | null;
  uploaded_by: string | null;
  created_at: string;
}

function parseJsonField(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}

function parsePost(row: any): DbBlogPost {
  return {
    ...row,
    noindex: Boolean(row.noindex),
    schema_type: (row.schema_type as SchemaType) || 'BlogPosting',
    tags: parseJsonField(row.tags) ?? [],
    long_tail_keywords: parseJsonField(row.long_tail_keywords) ?? [],
    faq_items: parseJsonField(row.faq_items) ?? [],
    twitter_card: row.twitter_card || 'summary_large_image',
    og_title: row.og_title ?? null,
    og_description: row.og_description ?? null,
    twitter_title: row.twitter_title ?? null,
    twitter_description: row.twitter_description ?? null,
    readability_score: row.readability_score != null ? Number(row.readability_score) : null,
    seo_score: row.seo_score != null ? Number(row.seo_score) : null,
    date_published: row.date_published
      ? new Date(row.date_published).toISOString().split('T')[0] : null,
    date_modified: row.date_modified
      ? new Date(row.date_modified).toISOString().split('T')[0] : null,
    scheduled_at: row.scheduled_at
      ? new Date(row.scheduled_at).toISOString() : null,
    scheduled_timezone: row.scheduled_timezone ?? null,
  };
}

let schemaMigrationAttempted = false;

export async function ensureSeoSchemaMigrated(): Promise<void> {
  if (schemaMigrationAttempted) return;
  schemaMigrationAttempted = true;
  try {
    const client = await getMysqlClient();

    // ── 0. Self-heal: create tables that database/07_cms_publishing_upgrade.sql
    // defines, in case that migration file was never run. Safe / idempotent —
    // CREATE TABLE IF NOT EXISTS never touches an existing table's data.
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS cms_media_assets (
          id              BIGINT AUTO_INCREMENT PRIMARY KEY,
          storage_path    VARCHAR(1000) NOT NULL UNIQUE,
          public_url      VARCHAR(1000) NOT NULL,
          filename        VARCHAR(500) NOT NULL,
          mime_type       VARCHAR(100) NOT NULL,
          bytes           BIGINT NOT NULL,
          alt_text        VARCHAR(255) NULL,
          caption         TEXT NULL,
          uploaded_by     VARCHAR(200) NULL,
          created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_cma_created (created_at DESC),
          INDEX idx_cma_filename (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch (e) { console.warn('[blog-db] cms_media_assets create warning:', e); }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS blog_post_revisions (
          id              BIGINT AUTO_INCREMENT PRIMARY KEY,
          post_id         INT NOT NULL,
          revision_type   ENUM('autosave','manual','restore') NOT NULL DEFAULT 'manual',
          title           VARCHAR(600) NOT NULL,
          content         LONGTEXT,
          snapshot        JSON NOT NULL,
          created_by      VARCHAR(200) NULL,
          created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_bpr_post_created (post_id, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch (e) { console.warn('[blog-db] blog_post_revisions create warning:', e); }

    const [cols]: any = await client.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blog_posts' AND COLUMN_NAME = 'og_title'`
    );
    if (!Array.isArray(cols) || cols.length === 0) {
      const queries = [
        `ALTER TABLE blog_posts ADD COLUMN og_title VARCHAR(600) NULL DEFAULT NULL`,
        `ALTER TABLE blog_posts ADD COLUMN og_description TEXT NULL DEFAULT NULL`,
        `ALTER TABLE blog_posts ADD COLUMN twitter_card ENUM('summary','summary_large_image') NOT NULL DEFAULT 'summary_large_image'`,
        `ALTER TABLE blog_posts ADD COLUMN twitter_title VARCHAR(600) NULL DEFAULT NULL`,
        `ALTER TABLE blog_posts ADD COLUMN twitter_description TEXT NULL DEFAULT NULL`,
        `ALTER TABLE blog_posts ADD COLUMN readability_score INT NULL DEFAULT NULL`,
        `ALTER TABLE blog_posts ADD COLUMN seo_score INT NULL DEFAULT NULL`,
      ];
      for (const q of queries) {
        try { await client.query(q); } catch { /* ignore if column exists */ }
      }
    }

    // ── Scheduling: a DATETIME + timezone so "Publish Time" actually means
    // something. Previously only a DATE column existed, so any time picked
    // in the schedule modal was silently discarded.
    const [schedCols]: any = await client.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blog_posts' AND COLUMN_NAME = 'scheduled_at'`
    );
    if (!Array.isArray(schedCols) || schedCols.length === 0) {
      const schedQueries = [
        `ALTER TABLE blog_posts ADD COLUMN scheduled_at DATETIME NULL DEFAULT NULL`,
        `ALTER TABLE blog_posts ADD COLUMN scheduled_timezone VARCHAR(64) NULL DEFAULT 'Asia/Kolkata'`,
      ];
      for (const q of schedQueries) {
        try { await client.query(q); } catch { /* ignore if column exists */ }
      }
    }

    const [mediaCols]: any = await client.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cms_media_assets' AND COLUMN_NAME = 'folder'`
    );
    if (!Array.isArray(mediaCols) || mediaCols.length === 0) {
      const mediaQueries = [
        `ALTER TABLE cms_media_assets ADD COLUMN folder VARCHAR(500) NULL DEFAULT NULL`,
        `ALTER TABLE cms_media_assets ADD COLUMN width INT NULL DEFAULT NULL`,
        `ALTER TABLE cms_media_assets ADD COLUMN height INT NULL DEFAULT NULL`,
      ];
      for (const q of mediaQueries) {
        try { await client.query(q); } catch { /* ignore if column exists */ }
      }
    }

    // ── Persisted media folders (database/12_media_folders.sql) — self-heal
    // so a folder created in the Media Library survives a reload even before
    // any file has been uploaded into it.
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS media_folders (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          name        VARCHAR(300) NOT NULL UNIQUE,
          created_by  VARCHAR(200) NULL,
          created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch (e) { console.warn('[blog-db] media_folders create warning:', e); }

    // ── Author registry (database/08_cms_publication_structure.sql) — self-heal
    // so /blog/author/[slug] can be DB-driven even on installs that never ran
    // that migration file.
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS blog_authors (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          slug            VARCHAR(160) NOT NULL UNIQUE,
          name            VARCHAR(200) NOT NULL,
          display_name    VARCHAR(200) NULL,
          bio             TEXT NULL,
          avatar_url      VARCHAR(1000) NULL,
          cover_image_url VARCHAR(1000) NULL,
          designation     VARCHAR(300) NULL,
          company         VARCHAR(300) NULL,
          website_url     VARCHAR(1000) NULL,
          social_links    JSON NULL,
          location        VARCHAR(200) NULL,
          expertise       JSON NULL,
          is_verified     TINYINT(1) NOT NULL DEFAULT 0,
          is_guest        TINYINT(1) NOT NULL DEFAULT 0,
          seo_title       VARCHAR(600) NULL,
          seo_description VARCHAR(400) NULL,
          status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
          role            ENUM('author','editor','admin') NOT NULL DEFAULT 'author',
          permissions     JSON NULL,
          deleted_at      TIMESTAMP NULL DEFAULT NULL,
          created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ba_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch (e) { console.warn('[blog-db] blog_authors create warning:', e); }
  } catch (e) {
    console.warn('[blog-db] Auto schema migration warning:', e);
  }
}

// NOTE: `bp.content` MUST stay in this list. It was previously omitted here,
// which meant every query built on ADMIN_COLS — the admin "load post to
// edit" query, the public single-post query, the admin list query, and the
// `existing` lookup the update-guard compares against — silently returned
// posts with no content field at all (JSON.stringify drops `undefined`
// keys, so the client never even saw a `content: ""`, it saw no key).
// That's what caused "content vanishes after publish": the editor reloaded
// a blank body, the writer retyped a smaller amount into what looked like
// an empty draft, and the anti-data-loss guard in the PUT route couldn't
// detect the shrink because it was comparing against the same
// content-less `existing` row. Do not remove this column from here again.
const ADMIN_COLS = `
  bp.id, bp.slug, bp.title, bp.excerpt, bp.content, bp.author, bp.author_title,
  bp.category_id, bc.name AS category_name, bc.slug AS category_slug,
  bp.status, bp.featured_image, bp.featured_image_alt, bp.schema_type, bp.tags,
  bp.seo_title, bp.seo_description, bp.seo_keywords,
  bp.long_tail_keywords, bp.og_image,
  COALESCE(bp.og_title, NULL) AS og_title,
  COALESCE(bp.og_description, NULL) AS og_description,
  COALESCE(bp.twitter_card, 'summary_large_image') AS twitter_card,
  COALESCE(bp.twitter_title, NULL) AS twitter_title,
  COALESCE(bp.twitter_description, NULL) AS twitter_description,
  bp.canonical_url, bp.noindex,
  bp.faq_items, bp.word_count, bp.reading_time_minutes,
  COALESCE(bp.readability_score, NULL) AS readability_score,
  COALESCE(bp.seo_score, NULL) AS seo_score,
  bp.date_published, bp.date_modified,
  COALESCE(bp.scheduled_at, NULL) AS scheduled_at,
  COALESCE(bp.scheduled_timezone, NULL) AS scheduled_timezone,
  bp.created_at, bp.updated_at
`.trim();

// ── Public reads with L1 Memory + L2 Redis Caching ─────────────────────────

const REDIS_BLOG_POSTS_KEY = 'blog:posts:published';
const REDIS_BLOG_POST_PREFIX = 'blog:post:';
const BLOG_CACHE_TTL_SECONDS = 1800; // 30 minutes in Redis
const BLOG_MEM_CACHE_TTL_MS = 60_000; // 60 seconds in-memory

let memPublishedPosts: DbBlogPost[] | null = null;
let memPublishedPostsAt = 0;
let memCategories: DbBlogCategory[] | null = null;
let memCategoriesAt = 0;
const memSinglePostCache = new Map<string, { post: DbBlogPost | null; cachedAt: number }>();

/** Invalidate all blog cache keys (call when posts are created/edited/deleted) */
export async function invalidateBlogCache(slug?: string): Promise<void> {
  memPublishedPosts = null;
  memPublishedPostsAt = 0;
  memCategories = null;
  memCategoriesAt = 0;
  if (slug) {
    memSinglePostCache.delete(slug);
  } else {
    memSinglePostCache.clear();
  }

  try {
    const { redisDel } = await import('./redis');
    const keysToDelete = [REDIS_BLOG_POSTS_KEY];
    if (slug) keysToDelete.push(`${REDIS_BLOG_POST_PREFIX}${slug}`);
    await redisDel(keysToDelete);
  } catch {
    // Non-blocking
  }
}

export async function getPublishedPosts(): Promise<DbBlogPost[]> {
  const now = Date.now();

  // L1: In-Memory Cache
  if (memPublishedPosts && (now - memPublishedPostsAt < BLOG_MEM_CACHE_TTL_MS)) {
    return memPublishedPosts;
  }

  // L2: Upstash Redis Cache (capped at 1 s — a cache must never be slower than the DB it protects)
  try {
    const { redisGet } = await import('./redis');
    const cached = await Promise.race([
      redisGet<DbBlogPost[]>(REDIS_BLOG_POSTS_KEY),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_000)),
    ]);
    if (cached && Array.isArray(cached)) {
      memPublishedPosts = cached;
      memPublishedPostsAt = now;
      return cached;
    }
  } catch {
    // Fallback to L3
  }

  // L3: MySQL Database Query
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT ${ADMIN_COLS}
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bc.id = bp.category_id
       WHERE bp.status = 'published'
         AND (bp.noindex IS NULL OR bp.noindex = 0)
       ORDER BY bp.date_published DESC, bp.created_at DESC`
    );
    const result = Array.isArray(rows) ? rows.map(parsePost) : [];

    memPublishedPosts = result;
    memPublishedPostsAt = now;

    // Cache in Redis asynchronously
    import('./redis').then(({ redisSet }) => {
      redisSet(REDIS_BLOG_POSTS_KEY, result, { ex: BLOG_CACHE_TTL_SECONDS }).catch(() => {});
    }).catch(() => {});

    return result;
  } catch {
    return memPublishedPosts ?? [];
  }
}

export async function getPublishedPostBySlug(slug: string): Promise<DbBlogPost | null> {
  const now = Date.now();

  // L1: In-Memory Cache
  const memHit = memSinglePostCache.get(slug);
  if (memHit && (now - memHit.cachedAt < BLOG_MEM_CACHE_TTL_MS)) {
    return memHit.post;
  }

  // L2: Upstash Redis Cache (capped at 1 s — a cache must never be slower than the DB it protects)
  const redisKey = `${REDIS_BLOG_POST_PREFIX}${slug}`;
  try {
    const { redisGet } = await import('./redis');
    const cached = await Promise.race([
      redisGet<DbBlogPost>(redisKey),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_000)),
    ]);
    if (cached && typeof cached === 'object' && cached.slug === slug) {
      memSinglePostCache.set(slug, { post: cached, cachedAt: now });
      return cached;
    }
  } catch {
    // Fallback to L3
  }

  // L3: MySQL Database Query
  // One bounded retry for TRANSIENT connect failures (ETIMEDOUT / ECONNREFUSED /
  // ECONNRESET): build-time static generation runs against a remote DB where a
  // single network blip would otherwise bake null/empty metadata into a
  // prerendered blog page. Non-transient errors propagate immediately.
  try {
    const runQuery = async () => {
      const client = await getMysqlClient();
      const [rows]: any = await client.query(
         `SELECT ${ADMIN_COLS}
         FROM blog_posts bp
         LEFT JOIN blog_categories bc ON bc.id = bp.category_id
         WHERE (bp.slug = ? OR bp.slug = LOWER(?)) AND bp.status = 'published'
         LIMIT 1`,
        [slug, slug]
      );
      return rows;
    };
    let rows: any;
    try {
      rows = await runQuery();
    } catch (connErr: any) {
      const code = connErr?.code ?? connErr?.errno;
      if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'PROTOCOL_CONNECTION_LOST') {
        await new Promise(resolve => setTimeout(resolve, 800));
        rows = await runQuery();
      } else {
        throw connErr;
      }
    }
    if (!Array.isArray(rows) || !rows[0]) {
      return null;
    }
    const result = parsePost(rows[0]);

    memSinglePostCache.set(slug, { post: result, cachedAt: now });
    if (result.slug !== slug) {
      memSinglePostCache.set(result.slug, { post: result, cachedAt: now });
    }

    // Cache in Redis asynchronously
    import('./redis').then(({ redisSet }) => {
      redisSet(redisKey, result, { ex: BLOG_CACHE_TTL_SECONDS }).catch(() => {});
    }).catch(() => {});

    return result;
  } catch (err) {
    console.warn('[blog-db] Error fetching post by slug:', slug, err);
    return memHit?.post ?? null;
  }
}

// ── Related posts ──────────────────────────────────────────────────────────

export interface RelatedPost {
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image: string | null;
  reading_time_minutes: number;
  date_published: string | null;
  category_name: string | null;
}

export async function getRelatedPosts(
  currentSlug: string,
  categoryId: number | null,
  limit = 3,
): Promise<RelatedPost[]> {
  if (!categoryId) return [];
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT bp.slug, bp.title, bp.excerpt, bp.featured_image,
              bp.reading_time_minutes, bp.date_published,
              bc.name AS category_name
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bc.id = bp.category_id
       WHERE bp.status = 'published'
         AND bp.category_id = ?
         AND bp.slug != ?
       ORDER BY bp.date_published DESC
       LIMIT ?`,
      [categoryId, currentSlug, limit],
    );
    if (!Array.isArray(rows)) return [];
    return rows.map((r: any) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt ?? null,
      featured_image: r.featured_image ?? null,
      reading_time_minutes: r.reading_time_minutes ?? 5,
      date_published: r.date_published
        ? new Date(r.date_published).toISOString().split('T')[0]
        : null,
      category_name: r.category_name ?? null,
    }));
  } catch { return []; }
}

export async function getAllDbBlogSlugs(): Promise<string[]> {
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT slug FROM blog_posts WHERE status = 'published'`
    );
    return Array.isArray(rows) ? rows.map((r: any) => r.slug) : [];
  } catch { return []; }
}

// ── Admin reads/writes ─────────────────────────────────────────────────────

export async function getAllPostsAdmin(): Promise<DbBlogPost[]> {
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT ${ADMIN_COLS}
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bc.id = bp.category_id
       ORDER BY bp.updated_at DESC`
    );
    return Array.isArray(rows) ? rows.map(parsePost) : [];
  } catch { return []; }
}

export async function getPostByIdAdmin(id: number): Promise<DbBlogPost | null> {
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
       `SELECT ${ADMIN_COLS}
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bc.id = bp.category_id
       WHERE bp.id = ? LIMIT 1`,
      [id]
    );
    if (!Array.isArray(rows) || !rows[0]) return null;
    return parsePost(rows[0]);
  } catch { return null; }
}

export async function getCategories(): Promise<DbBlogCategory[]> {
  const now = Date.now();
  if (memCategories && (now - memCategoriesAt < BLOG_MEM_CACHE_TTL_MS)) {
    return memCategories;
  }

  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT id, name, slug, description, parent_id, seo_title, seo_description
       FROM blog_categories ORDER BY name ASC`
    );
    const result = Array.isArray(rows) ? (rows as DbBlogCategory[]) : [];
    memCategories = result;
    memCategoriesAt = now;
    return result;
  } catch {
    // Compatible with databases not yet migrated to hierarchical categories.
    try {
      const client = await getMysqlClient();
      const [rows]: any = await client.query(`SELECT id, name, slug, description FROM blog_categories ORDER BY name ASC`);
      const result = Array.isArray(rows) ? (rows as DbBlogCategory[]) : [];
      memCategories = result;
      memCategoriesAt = now;
      return result;
    } catch {
      return memCategories ?? [];
    }
  }
}

export async function getPostsByCategory(categorySlug: string): Promise<DbBlogPost[]> {
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT ${ADMIN_COLS}
       FROM blog_posts bp
       INNER JOIN blog_categories bc ON bc.id = bp.category_id
       WHERE bc.slug = ? AND bp.status = 'published'
       ORDER BY bp.date_published DESC, bp.created_at DESC`,
      [categorySlug],
    );
    return Array.isArray(rows) ? rows.map(parsePost) : [];
  } catch {
    return [];
  }
}

export async function getCmsAuthors(): Promise<CmsAuthor[]> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT id, slug, name, display_name, bio, avatar_url, cover_image_url, designation,
            company, website_url, social_links, location, expertise, is_verified, is_guest,
            seo_title, seo_description
     FROM blog_authors ORDER BY name ASC`,
  );
  return Array.isArray(rows) ? rows.map((row: any) => ({
    ...row,
    social_links: parseJsonField(row.social_links) || null,
    expertise: parseJsonField(row.expertise) || [],
    is_verified: Boolean(row.is_verified),
    is_guest: Boolean(row.is_guest),
  })) : [];
}

// ── Public author lookups (used by /blog/author/[slug]) ────────────────────
// Authors created in the admin panel live in `blog_authors`. The public site
// previously only knew about a hardcoded list in src/lib/authors.ts, so any
// author (including guest authors) created through the admin UI 404'd on
// their own author page. These functions make the public pages DB-driven,
// while src/lib/authors.ts stays as a fallback for legacy content.
export async function getPublicAuthorBySlug(slug: string): Promise<CmsAuthor | null> {
  try {
    await ensureSeoSchemaMigrated();
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT id, slug, name, display_name, bio, avatar_url, cover_image_url, designation,
              company, website_url, social_links, location, expertise, is_verified, is_guest,
              seo_title, seo_description
       FROM blog_authors
       WHERE slug = ? AND status = 'active' AND deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    if (!Array.isArray(rows) || !rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      social_links: parseJsonField(row.social_links) || null,
      expertise: parseJsonField(row.expertise) || [],
      is_verified: Boolean(row.is_verified),
      is_guest: Boolean(row.is_guest),
    };
  } catch { return null; }
}

export async function getPublicAuthorByName(name: string): Promise<CmsAuthor | null> {
  try {
    await ensureSeoSchemaMigrated();
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT id, slug, name, display_name, bio, avatar_url, cover_image_url, designation,
              company, website_url, social_links, location, expertise, is_verified, is_guest,
              seo_title, seo_description
       FROM blog_authors
       WHERE (LOWER(name) = LOWER(?) OR LOWER(display_name) = LOWER(?))
         AND status = 'active' AND deleted_at IS NULL
       ORDER BY (LOWER(name) = LOWER(?)) DESC
       LIMIT 1`,
      [name, name, name],
    );
    if (!Array.isArray(rows) || !rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      social_links: parseJsonField(row.social_links) || null,
      expertise: parseJsonField(row.expertise) || [],
      is_verified: Boolean(row.is_verified),
      is_guest: Boolean(row.is_guest),
    };
  } catch { return null; }
}

export async function getAllPublicAuthorSlugs(): Promise<string[]> {
  try {
    await ensureSeoSchemaMigrated();
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT slug FROM blog_authors WHERE status = 'active' AND deleted_at IS NULL`,
    );
    return Array.isArray(rows) ? rows.map((r: any) => r.slug).filter(Boolean) : [];
  } catch { return []; }
}

export async function getPostsAdminPage(options: BlogAdminListOptions = {}): Promise<BlogAdminListResult> {
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  const page = Math.max(1, Number(options.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(options.perPage) || 20));
  const status = options.status || 'all';
  const search = options.search?.trim() || '';
  const where: string[] = [];
  const values: any[] = [];
  if (status !== 'all') { where.push('bp.status = ?'); values.push(status); }
  if (options.categoryId) { where.push('bp.category_id = ?'); values.push(options.categoryId); }
  if (search) {
    where.push('(bp.title LIKE ? OR bp.excerpt LIKE ? OR bp.author LIKE ? OR bp.slug LIKE ?)');
    const term = `%${search}%`; values.push(term, term, term, term);
  }
  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortMap: Record<BlogAdminSort, string> = {
    updated: 'bp.updated_at', created: 'bp.created_at', title: 'bp.title', published: 'bp.date_published',
  };
  const sort = sortMap[options.sort || 'updated'];
  const direction = options.direction === 'asc' ? 'ASC' : 'DESC';
  const [totalRows, rows, countRows]: any = await Promise.all([
    client.query(`SELECT COUNT(*) AS total FROM blog_posts bp ${condition}`, values).then((r: any) => r[0]),
    client.query(`SELECT ${ADMIN_COLS} FROM blog_posts bp LEFT JOIN blog_categories bc ON bc.id = bp.category_id ${condition}
      ORDER BY ${sort} ${direction}, bp.id DESC LIMIT ? OFFSET ?`, [...values, perPage, (page - 1) * perPage]).then((r: any) => r[0]),
    client.query(`SELECT status, COUNT(*) AS total FROM blog_posts GROUP BY status`).then((r: any) => r[0]),
  ]);
  const total = Number(totalRows?.[0]?.total || 0);
  const counts = { draft: 0, review: 0, scheduled: 0, published: 0, archived: 0, trash: 0 };
  for (const row of countRows || []) if (row.status in counts) counts[row.status as BlogAdminStatus] = Number(row.total);
  return { posts: Array.isArray(rows) ? rows.map(parsePost) : [], total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)), counts };
}

export async function getPostRedirect(slug: string): Promise<string | null> {
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT to_slug FROM blog_slug_redirects WHERE from_slug = ? LIMIT 1`,
      [slug],
    );
    return Array.isArray(rows) && rows[0]?.to_slug ? rows[0].to_slug : null;
  } catch { return null; }
}

export async function savePostRedirect(fromSlug: string, toSlug: string): Promise<void> {
  if (!fromSlug || fromSlug === toSlug) return;
  const client = await getMysqlClient();
  await client.query(
    `INSERT INTO blog_slug_redirects (from_slug, to_slug) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE to_slug = VALUES(to_slug)`,
    [fromSlug, toSlug],
  );
}


export async function createPost(data: Omit<DbBlogPost, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'category_slug'>): Promise<number | null> {
  const client = await getMysqlClient();
  const [result]: any = await client.query(
    `INSERT INTO blog_posts
       (slug, title, excerpt, content, author, author_title, category_id, status,
         featured_image, featured_image_alt, schema_type, tags, seo_title, seo_description, seo_keywords,
        long_tail_keywords, og_image, canonical_url, noindex, faq_items,
        word_count, reading_time_minutes, date_published, date_modified,
        scheduled_at, scheduled_timezone)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.slug, data.title, data.excerpt, data.content,
      data.author, data.author_title, data.category_id, data.status,
       data.featured_image, data.featured_image_alt, data.schema_type || 'BlogPosting',
      JSON.stringify(data.tags ?? []),
      data.seo_title, data.seo_description, data.seo_keywords,
      JSON.stringify(data.long_tail_keywords ?? []),
      data.og_image, data.canonical_url, data.noindex ? 1 : 0,
      JSON.stringify(data.faq_items ?? []),
      data.word_count, data.reading_time_minutes,
      data.date_published, data.date_modified,
      data.scheduled_at ?? null, data.scheduled_timezone ?? null,
    ]
  );
  return result?.insertId ?? null;
}

export async function updatePost(id: number, data: Partial<Omit<DbBlogPost, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'category_slug'>>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  const add = (col: string, val: any) => { fields.push(`\`${col}\` = ?`); values.push(val); };

  if (data.slug         !== undefined) add('slug',         data.slug);
  if (data.title        !== undefined) add('title',        data.title);
  if (data.excerpt      !== undefined) add('excerpt',      data.excerpt);
  if (data.content      !== undefined) add('content',      data.content);
  if (data.author       !== undefined) add('author',       data.author);
  if (data.author_title !== undefined) add('author_title', data.author_title);
  if (data.category_id  !== undefined) add('category_id',  data.category_id);
  if (data.status       !== undefined) add('status',       data.status);
  if (data.featured_image !== undefined) add('featured_image', data.featured_image);
  if (data.featured_image_alt !== undefined) add('featured_image_alt', data.featured_image_alt);
  if (data.schema_type  !== undefined) add('schema_type',  data.schema_type);
  if (data.tags         !== undefined) add('tags',         JSON.stringify(data.tags ?? []));
  if (data.seo_title    !== undefined) add('seo_title',    data.seo_title);
  if (data.seo_description !== undefined) add('seo_description', data.seo_description);
  if (data.seo_keywords !== undefined) add('seo_keywords', data.seo_keywords);
  if (data.long_tail_keywords !== undefined) add('long_tail_keywords', JSON.stringify(data.long_tail_keywords ?? []));
  if (data.og_image     !== undefined) add('og_image',     data.og_image);
  if ((data as any).og_title         !== undefined) add('og_title',         (data as any).og_title);
  if ((data as any).og_description   !== undefined) add('og_description',   (data as any).og_description);
  if ((data as any).twitter_card     !== undefined) add('twitter_card',     (data as any).twitter_card);
  if ((data as any).twitter_title    !== undefined) add('twitter_title',    (data as any).twitter_title);
  if ((data as any).twitter_description !== undefined) add('twitter_description', (data as any).twitter_description);
  if (data.canonical_url !== undefined) add('canonical_url', data.canonical_url);
  if (data.noindex      !== undefined) add('noindex',      data.noindex ? 1 : 0);
  if (data.faq_items    !== undefined) add('faq_items',    JSON.stringify(data.faq_items ?? []));
  if (data.word_count   !== undefined) add('word_count',   data.word_count);
  if (data.reading_time_minutes !== undefined) add('reading_time_minutes', data.reading_time_minutes);
  if ((data as any).readability_score !== undefined) add('readability_score', (data as any).readability_score);
  if ((data as any).seo_score         !== undefined) add('seo_score',         (data as any).seo_score);
  if (data.date_published !== undefined) add('date_published', data.date_published);
  if (data.date_modified  !== undefined) add('date_modified',  data.date_modified);
  if ((data as any).scheduled_at !== undefined) add('scheduled_at', (data as any).scheduled_at);
  if ((data as any).scheduled_timezone !== undefined) add('scheduled_timezone', (data as any).scheduled_timezone);

  if (!fields.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function createPostRevision(
  postId: number,
  post: DbBlogPost,
  revisionType: BlogRevision['revision_type'],
  createdBy?: string,
): Promise<void> {
  const client = await getMysqlClient();
  const snapshot = {
    slug: post.slug, title: post.title, excerpt: post.excerpt, content: post.content,
    author: post.author, author_title: post.author_title, category_id: post.category_id,
    status: post.status, featured_image: post.featured_image, featured_image_alt: post.featured_image_alt,
    schema_type: post.schema_type, tags: post.tags, seo_title: post.seo_title,
    seo_description: post.seo_description, seo_keywords: post.seo_keywords,
    long_tail_keywords: post.long_tail_keywords, og_image: post.og_image,
    canonical_url: post.canonical_url, noindex: post.noindex, faq_items: post.faq_items,
    date_published: post.date_published, date_modified: post.date_modified,
  };
  await client.query(
    `INSERT INTO blog_post_revisions (post_id, revision_type, title, content, snapshot, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [postId, revisionType, post.title, post.content, JSON.stringify(snapshot), createdBy || null],
  );
}

export async function getPostRevisions(postId: number): Promise<BlogRevision[]> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT id, post_id, revision_type, title, content, snapshot, created_by, created_at
     FROM blog_post_revisions WHERE post_id = ? ORDER BY created_at DESC LIMIT 30`,
    [postId],
  );
  return Array.isArray(rows) ? rows.map((row: any) => ({ ...row, snapshot: parseJsonField(row.snapshot) || {} })) : [];
}

export async function getRevisionById(postId: number, revisionId: number): Promise<BlogRevision | null> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT id, post_id, revision_type, title, content, snapshot, created_by, created_at
     FROM blog_post_revisions WHERE post_id = ? AND id = ? LIMIT 1`,
    [postId, revisionId],
  );
  return Array.isArray(rows) && rows[0]
    ? { ...rows[0], snapshot: parseJsonField(rows[0].snapshot) || {} }
    : null;
}

export async function restoreRevision(postId: number, revision: BlogRevision, restoredBy?: string): Promise<void> {
  const current = await getPostByIdAdmin(postId);
  if (!current) throw new Error('Post not found');
  await createPostRevision(postId, current, 'restore', restoredBy);
  await updatePost(postId, revision.snapshot as Partial<DbBlogPost>);
}

export async function registerMediaAsset(
  asset: Omit<CmsMediaAsset, 'id' | 'created_at'>,
): Promise<number> {
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  // Try with new columns first, fall back to legacy schema
  try {
    const [result]: any = await client.query(
      `INSERT INTO cms_media_assets
         (storage_path, public_url, filename, mime_type, bytes, alt_text, caption, folder, width, height, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asset.storage_path, asset.public_url, asset.filename, asset.mime_type,
        asset.bytes, asset.alt_text, asset.caption,
        asset.folder ?? null, asset.width ?? null, asset.height ?? null,
        asset.uploaded_by,
      ],
    );
    return result?.insertId ?? 0;
  } catch {
    // Fallback for databases not yet migrated
    const [result]: any = await client.query(
      `INSERT INTO cms_media_assets (storage_path, public_url, filename, mime_type, bytes, alt_text, caption, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [asset.storage_path, asset.public_url, asset.filename, asset.mime_type,
       asset.bytes, asset.alt_text, asset.caption, asset.uploaded_by],
    );
    return result?.insertId ?? 0;
  }
}

export interface MediaListOptions {
  search?: string;
  folder?: string;
  page?: number;
  perPage?: number;
  /** Filter by media kind: 'image' | 'video' | 'audio' (matches mime_type prefix). */
  kind?: 'image' | 'video' | 'audio';
}

export interface MediaListResult {
  assets: CmsMediaAsset[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

function parseMediaRow(row: any): CmsMediaAsset {
  return {
    id: Number(row.id),
    storage_path: row.storage_path,
    public_url: row.public_url,
    filename: row.filename,
    mime_type: row.mime_type,
    bytes: Number(row.bytes),
    alt_text: row.alt_text ?? null,
    caption: row.caption ?? null,
    folder: row.folder ?? null,
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    uploaded_by: row.uploaded_by ?? null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function getMediaAssets(search = '', folder?: string): Promise<CmsMediaAsset[]> {
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  const needle = `%${search.trim()}%`;
  const where: string[] = ['(filename LIKE ? OR COALESCE(alt_text, \'\') LIKE ?)'];
  const values: any[] = [needle, needle];
  if (folder !== undefined) { where.push('COALESCE(folder, \'\') = ?'); values.push(folder); }
  const [rows]: any = await client.query(
    `SELECT id, storage_path, public_url, filename, mime_type, bytes, alt_text, caption,
            COALESCE(folder, NULL) AS folder, COALESCE(width, NULL) AS width, COALESCE(height, NULL) AS height,
            uploaded_by, created_at
     FROM cms_media_assets WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC LIMIT 200`,
    values,
  );
  return Array.isArray(rows) ? rows.map(parseMediaRow) : [];
}

export async function getMediaAssetsList(options: MediaListOptions = {}): Promise<MediaListResult> {
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  const page = Math.max(1, Number(options.page) || 1);
  const perPage = Math.min(200, Math.max(12, Number(options.perPage) || 40));
  const needle = `%${(options.search || '').trim()}%`;
  const where: string[] = ['(filename LIKE ? OR COALESCE(alt_text, \'\') LIKE ?)'];
  const values: any[] = [needle, needle];
  if (options.folder !== undefined) { where.push('COALESCE(folder, \'\') = ?'); values.push(options.folder); }
  if (options.kind) { where.push('mime_type LIKE ?'); values.push(`${options.kind}/%`); }
  const condition = `WHERE ${where.join(' AND ')}`;
  const [totalRows, rows]: any = await Promise.all([
    client.query(`SELECT COUNT(*) AS total FROM cms_media_assets ${condition}`, values).then((r: any) => r[0]),
    client.query(
      `SELECT id, storage_path, public_url, filename, mime_type, bytes, alt_text, caption,
              COALESCE(folder, NULL) AS folder, COALESCE(width, NULL) AS width, COALESCE(height, NULL) AS height,
              uploaded_by, created_at
       FROM cms_media_assets ${condition}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, perPage, (page - 1) * perPage],
    ).then((r: any) => r[0]),
  ]);
  const total = Number(totalRows?.[0]?.total || 0);
  return { assets: Array.isArray(rows) ? rows.map(parseMediaRow) : [], total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getMediaAssetById(id: number): Promise<CmsMediaAsset | null> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT id, storage_path, public_url, filename, mime_type, bytes, alt_text, caption,
            COALESCE(folder, NULL) AS folder, COALESCE(width, NULL) AS width, COALESCE(height, NULL) AS height,
            uploaded_by, created_at
     FROM cms_media_assets WHERE id = ? LIMIT 1`,
    [id],
  );
  return Array.isArray(rows) && rows[0] ? parseMediaRow(rows[0]) : null;
}

export async function updateMediaAsset(
  id: number,
  patch: { alt_text?: string | null; caption?: string | null; folder?: string | null; width?: number | null; height?: number | null },
): Promise<void> {
  const fields: string[] = []; const values: any[] = [];
  const add = (col: string, val: any) => { fields.push(`\`${col}\` = ?`); values.push(val); };
  if ('alt_text' in patch) add('alt_text', patch.alt_text ?? null);
  if ('caption'  in patch) add('caption',  patch.caption  ?? null);
  if ('folder'   in patch) add('folder',   patch.folder   ?? null);
  if ('width'    in patch) add('width',    patch.width    ?? null);
  if ('height'   in patch) add('height',   patch.height   ?? null);
  if (!fields.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE cms_media_assets SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function deleteMediaAsset(id: number): Promise<string | null> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(`SELECT storage_path FROM cms_media_assets WHERE id = ? LIMIT 1`, [id]);
  const storagePath: string | null = Array.isArray(rows) && rows[0] ? rows[0].storage_path : null;
  await client.query(`DELETE FROM cms_media_assets WHERE id = ?`, [id]);
  return storagePath;
}

/**
 * Keep author profiles valid when an avatar is removed from the media library.
 * The author record intentionally stores a URL rather than a hard foreign key,
 * so deleting the asset must clear that stale reference explicitly.
 */
export async function clearAuthorAvatarReference(publicUrl: string): Promise<void> {
  if (!publicUrl) return;
  try {
    const client = await getMysqlClient();
    await client.query('UPDATE blog_authors SET avatar_url = NULL WHERE avatar_url = ?', [publicUrl]);
  } catch {
    // Older installations may not have the author table yet. Media deletion
    // should still succeed there.
  }
}

export async function bulkDeleteMediaAssets(ids: number[]): Promise<string[]> {
  if (!ids.length) return [];
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT storage_path FROM cms_media_assets WHERE id IN (${ids.map(() => '?').join(',')})`, ids,
  );
  const paths: string[] = Array.isArray(rows) ? rows.map((r: any) => r.storage_path).filter(Boolean) : [];
  await client.query(`DELETE FROM cms_media_assets WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  return paths;
}

/** Return public URLs that are still referenced by a post. These assets must
 * not be physically deleted: keeping the old file is safer than breaking a
 * published article or its social card. */
export async function getReferencedMediaUrls(urls: string[]): Promise<Set<string>> {
  if (!urls.length) return new Set();
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT featured_image, og_image, content FROM blog_posts
     WHERE featured_image IN (${urls.map(() => '?').join(',')})
        OR og_image IN (${urls.map(() => '?').join(',')})
        OR ${urls.map(() => 'content LIKE ?').join(' OR ')}`,
    [...urls, ...urls, ...urls.map(url => `%${url}%`)],
  );
  const referenced = new Set<string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const url of urls) {
      if (row.featured_image === url || row.og_image === url || String(row.content || '').includes(url)) referenced.add(url);
    }
  }
  return referenced;
}

export async function getMediaFolders(): Promise<string[]> {
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  try {
    // Union folders that actually hold an asset with folders that were
    // explicitly created (and may still be empty) so a brand-new folder
    // doesn't vanish on the next page load.
    const [rows]: any = await client.query(
      `SELECT folder AS name FROM cms_media_assets WHERE folder IS NOT NULL AND folder != ''
       UNION
       SELECT name FROM media_folders
       ORDER BY name ASC`,
    );
    return Array.isArray(rows) ? Array.from(new Set(rows.map((r: any) => r.name).filter(Boolean))) as string[] : [];
  } catch {
    // media_folders may not exist yet on an unmigrated install — fall back
    // to the asset-derived list only.
    try {
      const [rows]: any = await client.query(
        `SELECT DISTINCT folder FROM cms_media_assets WHERE folder IS NOT NULL AND folder != '' ORDER BY folder ASC`,
      );
      return Array.isArray(rows) ? rows.map((r: any) => r.folder).filter(Boolean) : [];
    } catch { return []; }
  }
}

export async function createMediaFolder(name: string, createdBy?: string | null): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  await client.query(
    `INSERT INTO media_folders (name, created_by) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = name`,
    [clean, createdBy || null],
  );
}

export async function deleteMediaFolder(name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  // Deleting a folder must not delete the media inside it. Keep the assets in
  // the library and return them to the unfiled view.
  await client.query('UPDATE cms_media_assets SET folder = NULL WHERE folder = ?', [clean]);
  await client.query('DELETE FROM media_folders WHERE name = ?', [clean]);
}

/**
 * Rename a folder everywhere at once: the media_folders registry row AND every
 * cms_media_assets.folder label that points at it. Because an asset's public
 * URL is independent of its folder label (folder is library metadata), this
 * instantly re-files all its media across the admin UI without touching any
 * image path — nothing can break site-wide.
 */
export async function renameMediaFolder(oldName: string, newName: string): Promise<void> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to) throw new Error('Both the current and the new folder name are required.');
  if (from === to) return;
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();

  // Refuse a rename onto an existing folder name — merging silently could
  // surprise the admin; deleting the target first is the explicit path.
  try {
    const [existing]: any = await client.query(
      `SELECT name FROM media_folders WHERE name = ? LIMIT 1`, [to],
    );
    const [assetInTarget]: any = await client.query(
      `SELECT id FROM cms_media_assets WHERE folder = ? LIMIT 1`, [to],
    );
    if ((Array.isArray(existing) && existing.length > 0) || (Array.isArray(assetInTarget) && assetInTarget.length > 0)) {
      throw new Error(`A folder named "${to}" already exists.`);
    }
  } catch (err: any) {
    if (err?.message?.includes('already exists')) throw err;
    // table missing etc. — proceed with best effort below
  }

  await client.query('UPDATE media_folders SET name = ? WHERE name = ?', [to, from]);
  await client.query('UPDATE cms_media_assets SET folder = ? WHERE folder = ?', [to, from]);
}

export async function getUnusedMedia(): Promise<CmsMediaAsset[]> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT cma.id, cma.storage_path, cma.public_url, cma.filename, cma.mime_type, cma.bytes,
            cma.alt_text, cma.caption,
            COALESCE(cma.folder, NULL) AS folder,
            COALESCE(cma.width, NULL) AS width,
            COALESCE(cma.height, NULL) AS height,
            cma.uploaded_by, cma.created_at
     FROM cms_media_assets cma
     WHERE NOT EXISTS (
       SELECT 1 FROM blog_posts bp
       WHERE bp.featured_image = cma.public_url
          OR bp.og_image = cma.public_url
          OR (bp.content IS NOT NULL AND bp.content LIKE CONCAT('%', cma.public_url, '%'))
     )
     ORDER BY cma.created_at DESC
     LIMIT 500`,
  );
  return Array.isArray(rows) ? rows.map(parseMediaRow) : [];
}

export async function publishScheduledPosts(): Promise<string[]> {
  await ensureSeoSchemaMigrated();
  const client = await getMysqlClient();
  const today = new Date().toISOString().split('T')[0];
  // Prefer the precise scheduled_at DATETIME when present. Older rows saved
  // before scheduled_at existed only have a date_published — fall back to
  // publishing those at the start of that date so nothing gets stuck.
  const [rows]: any = await client.query(
    `SELECT slug FROM blog_posts
     WHERE status = 'scheduled'
       AND (
         (scheduled_at IS NOT NULL AND scheduled_at <= NOW())
         OR (scheduled_at IS NULL AND date_published IS NOT NULL AND date_published <= ?)
       )`,
    [today]
  );

  const slugs = Array.isArray(rows) ? rows.map((row: any) => row.slug).filter(Boolean) : [];
  if (slugs.length > 0) {
    await client.query(
      `UPDATE blog_posts
       SET status = 'published',
           date_published = COALESCE(date_published, CURRENT_DATE())
       WHERE status = 'scheduled'
         AND (
           (scheduled_at IS NOT NULL AND scheduled_at <= NOW())
           OR (scheduled_at IS NULL AND date_published IS NOT NULL AND date_published <= ?)
         )`,
      [today]
    );
  }
  return slugs;
}

export async function deletePost(id: number): Promise<void> {
  const client = await getMysqlClient();
  await client.query(`DELETE FROM blog_posts WHERE id = ?`, [id]);
}

export async function updatePostLifecycle(ids: number[], status: BlogAdminStatus): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  const placeholders = ids.map(() => '?').join(',');
  if (status === 'trash') {
    await client.query(`UPDATE blog_posts SET status = 'trash', trashed_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, ids);
  } else {
    await client.query(`UPDATE blog_posts SET status = ?, trashed_at = NULL WHERE id IN (${placeholders})`, [status, ...ids]);
  }
}

export async function permanentlyDeletePosts(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`DELETE FROM blog_posts WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 'trash'`, ids);
}

export async function duplicatePost(id: number): Promise<number | null> {
  const original = await getPostByIdAdmin(id);
  if (!original) return null;
  const baseSlug = `${original.slug}-copy`;
  let slug = baseSlug; let suffix = 2;
  while (!(await isSlugAvailable(slug))) slug = `${baseSlug}-${suffix++}`;
  return createPost({ ...original, slug, title: `${original.title} (Copy)`, status: 'draft', date_published: null, date_modified: new Date().toISOString().split('T')[0] });
}

export function estimateReadingStats(html: string): { wordCount: number; readingTimeMinutes: number } {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(' ').filter(Boolean).length;
  return { wordCount, readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)) };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

/** Returns true if the slug is not taken. Pass excludeId when editing an existing post. */
export async function isSlugAvailable(slug: string, excludeId?: number): Promise<boolean> {
  try {
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      excludeId
        ? `SELECT id FROM blog_posts WHERE slug = ? AND id != ? LIMIT 1`
        : `SELECT id FROM blog_posts WHERE slug = ? LIMIT 1`,
      excludeId ? [slug, excludeId] : [slug]
    );
    return !Array.isArray(rows) || rows.length === 0;
  } catch {
    return true; // optimistic — MySQL will still enforce the unique constraint on write
  }
}

// ── Author management ───────────────────────────────────────────────────────

const AUTHOR_COLS = `
  id, slug, name, display_name, bio, avatar_url, cover_image_url, designation,
  company, website_url, social_links, location, expertise, is_verified, is_guest,
  status, role, permissions, deleted_at, seo_title, seo_description
`.trim();

function parseAuthorRow(row: any): CmsAuthorAdmin {
  return {
    ...row,
    social_links: parseJsonField(row.social_links) || null,
    expertise: parseJsonField(row.expertise) || [],
    permissions: parseJsonField(row.permissions) || [],
    is_verified: Boolean(row.is_verified),
    is_guest: Boolean(row.is_guest),
    status: (row.status as AuthorStatus) || 'active',
    role: (row.role as AuthorRole) || 'author',
    published_count: Number(row.published_count || 0),
    draft_count: Number(row.draft_count || 0),
  };
}

export interface AuthorAdminListOptions {
  search?: string;
  status?: 'all' | AuthorStatus | 'trashed';
  page?: number;
  perPage?: number;
}

export async function getAuthorsAdmin(options: AuthorAdminListOptions = {}): Promise<{ authors: CmsAuthorAdmin[]; total: number; page: number; perPage: number; totalPages: number; }> {
  const client = await getMysqlClient();
  const page = Math.max(1, Number(options.page) || 1);
  const perPage = Math.min(100, Math.max(5, Number(options.perPage) || 20));
  const where: string[] = [];
  const values: any[] = [];
  const status = options.status || 'all';
  if (status === 'trashed') where.push('ba.deleted_at IS NOT NULL');
  else { where.push('ba.deleted_at IS NULL'); if (status !== 'all') { where.push('ba.status = ?'); values.push(status); } }
  const search = options.search?.trim();
  if (search) { where.push('(ba.name LIKE ? OR ba.display_name LIKE ? OR ba.slug LIKE ? OR ba.company LIKE ?)'); const term = `%${search}%`; values.push(term, term, term, term); }
  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [totalRows, rows]: any = await Promise.all([
    client.query(`SELECT COUNT(*) AS total FROM blog_authors ba ${condition}`, values).then((r: any) => r[0]),
    client.query(
      `SELECT ${AUTHOR_COLS},
        (SELECT COUNT(*) FROM blog_posts bp WHERE bp.author = ba.name AND bp.status = 'published') AS published_count,
        (SELECT COUNT(*) FROM blog_posts bp WHERE bp.author = ba.name AND bp.status IN ('draft','review')) AS draft_count
       FROM blog_authors ba ${condition}
       ORDER BY ba.name ASC LIMIT ? OFFSET ?`,
      [...values, perPage, (page - 1) * perPage],
    ).then((r: any) => r[0]),
  ]);
  const total = Number(totalRows?.[0]?.total || 0);
  return { authors: Array.isArray(rows) ? rows.map(parseAuthorRow) : [], total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getAuthorByIdAdmin(id: number): Promise<CmsAuthorAdmin | null> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    `SELECT ${AUTHOR_COLS},
      (SELECT COUNT(*) FROM blog_posts bp WHERE bp.author = ba.name AND bp.status = 'published') AS published_count,
      (SELECT COUNT(*) FROM blog_posts bp WHERE bp.author = ba.name AND bp.status IN ('draft','review')) AS draft_count
     FROM blog_authors ba WHERE ba.id = ? LIMIT 1`,
    [id],
  );
  return Array.isArray(rows) && rows[0] ? parseAuthorRow(rows[0]) : null;
}

export async function isAuthorSlugAvailable(slug: string, excludeId?: number): Promise<boolean> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    excludeId ? `SELECT id FROM blog_authors WHERE slug = ? AND id != ? LIMIT 1` : `SELECT id FROM blog_authors WHERE slug = ? LIMIT 1`,
    excludeId ? [slug, excludeId] : [slug],
  );
  return !Array.isArray(rows) || rows.length === 0;
}

export interface AuthorInput {
  slug: string; name: string; display_name?: string | null; bio?: string | null;
  avatar_url?: string | null; cover_image_url?: string | null; designation?: string | null;
  company?: string | null; website_url?: string | null; social_links?: Record<string, string> | null;
  location?: string | null; expertise?: string[]; is_verified?: boolean; is_guest?: boolean;
  status?: AuthorStatus; role?: AuthorRole; permissions?: string[]; seo_title?: string | null; seo_description?: string | null;
}

export async function createAuthor(data: AuthorInput): Promise<number> {
  const client = await getMysqlClient();
  const [result]: any = await client.query(
    `INSERT INTO blog_authors
       (slug, name, display_name, bio, avatar_url, cover_image_url, designation, company, website_url,
        social_links, location, expertise, is_verified, is_guest, status, role, permissions, seo_title, seo_description)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.slug, data.name, data.display_name || null, data.bio || null, data.avatar_url || null,
      data.cover_image_url || null, data.designation || null, data.company || null, data.website_url || null,
      JSON.stringify(data.social_links || {}), data.location || null, JSON.stringify(data.expertise || []),
      data.is_verified ? 1 : 0, data.is_guest ? 1 : 0, data.status || 'active', data.role || 'author',
      JSON.stringify(data.permissions || []), data.seo_title || null, data.seo_description || null,
    ],
  );
  return result?.insertId;
}

export async function updateAuthor(id: number, data: Partial<AuthorInput>): Promise<void> {
  const fields: string[] = []; const values: any[] = [];
  const add = (col: string, val: any) => { fields.push(`\`${col}\` = ?`); values.push(val); };
  if (data.slug !== undefined) add('slug', data.slug);
  if (data.name !== undefined) add('name', data.name);
  if (data.display_name !== undefined) add('display_name', data.display_name);
  if (data.bio !== undefined) add('bio', data.bio);
  if (data.avatar_url !== undefined) add('avatar_url', data.avatar_url);
  if (data.cover_image_url !== undefined) add('cover_image_url', data.cover_image_url);
  if (data.designation !== undefined) add('designation', data.designation);
  if (data.company !== undefined) add('company', data.company);
  if (data.website_url !== undefined) add('website_url', data.website_url);
  if (data.social_links !== undefined) add('social_links', JSON.stringify(data.social_links || {}));
  if (data.location !== undefined) add('location', data.location);
  if (data.expertise !== undefined) add('expertise', JSON.stringify(data.expertise || []));
  if (data.is_verified !== undefined) add('is_verified', data.is_verified ? 1 : 0);
  if (data.is_guest !== undefined) add('is_guest', data.is_guest ? 1 : 0);
  if (data.status !== undefined) add('status', data.status);
  if (data.role !== undefined) add('role', data.role);
  if (data.permissions !== undefined) add('permissions', JSON.stringify(data.permissions || []));
  if (data.seo_title !== undefined) add('seo_title', data.seo_title);
  if (data.seo_description !== undefined) add('seo_description', data.seo_description);
  if (!fields.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_authors SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function setAuthorsStatus(ids: number[], status: AuthorStatus): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_authors SET status = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [status, ...ids]);
}

export async function trashAuthors(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_authors SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

export async function restoreAuthors(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_authors SET deleted_at = NULL WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

export async function permanentlyDeleteAuthors(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`DELETE FROM blog_authors WHERE id IN (${ids.map(() => '?').join(',')}) AND deleted_at IS NOT NULL`, ids);
}

// ── Category management ─────────────────────────────────────────────────────

export async function getCategoriesAdmin(options: { search?: string; includeTrashed?: boolean } = {}): Promise<CmsCategoryAdmin[]> {
  const client = await getMysqlClient();
  const where: string[] = [];
  const values: any[] = [];
  if (!options.includeTrashed) where.push('bc.deleted_at IS NULL');
  const search = options.search?.trim();
  if (search) { where.push('(bc.name LIKE ? OR bc.slug LIKE ? OR bc.description LIKE ?)'); const term = `%${search}%`; values.push(term, term, term); }
  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows]: any = await client.query(
    `SELECT bc.id, bc.name, bc.slug, bc.description, bc.parent_id, parent.name AS parent_name,
            bc.seo_title, bc.seo_description, bc.color, bc.icon, bc.deleted_at,
            (SELECT COUNT(*) FROM blog_posts bp WHERE bp.category_id = bc.id) AS post_count
     FROM blog_categories bc
     LEFT JOIN blog_categories parent ON parent.id = bc.parent_id
     ${condition}
     ORDER BY bc.name ASC`,
    values,
  );
  return Array.isArray(rows) ? rows.map((r: any) => ({ ...r, post_count: Number(r.post_count || 0) })) : [];
}

export async function isCategorySlugAvailable(slug: string, excludeId?: number): Promise<boolean> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    excludeId ? `SELECT id FROM blog_categories WHERE slug = ? AND id != ? LIMIT 1` : `SELECT id FROM blog_categories WHERE slug = ? LIMIT 1`,
    excludeId ? [slug, excludeId] : [slug],
  );
  return !Array.isArray(rows) || rows.length === 0;
}

export interface CategoryInput {
  name: string; slug: string; description?: string | null; parent_id?: number | null;
  seo_title?: string | null; seo_description?: string | null; color?: string | null; icon?: string | null;
}

export async function createCategory(data: CategoryInput): Promise<number> {
  const client = await getMysqlClient();
  const [result]: any = await client.query(
    `INSERT INTO blog_categories (name, slug, description, parent_id, seo_title, seo_description, color, icon)
     VALUES (?,?,?,?,?,?,?,?)`,
    [data.name, data.slug, data.description || null, data.parent_id || null, data.seo_title || null, data.seo_description || null, data.color || null, data.icon || null],
  );
  return result?.insertId;
}

export async function updateCategory(id: number, data: Partial<CategoryInput>): Promise<void> {
  const fields: string[] = []; const values: any[] = [];
  const add = (col: string, val: any) => { fields.push(`\`${col}\` = ?`); values.push(val); };
  if (data.name !== undefined) add('name', data.name);
  if (data.slug !== undefined) add('slug', data.slug);
  if (data.description !== undefined) add('description', data.description);
  if (data.parent_id !== undefined) add('parent_id', data.parent_id);
  if (data.seo_title !== undefined) add('seo_title', data.seo_title);
  if (data.seo_description !== undefined) add('seo_description', data.seo_description);
  if (data.color !== undefined) add('color', data.color);
  if (data.icon !== undefined) add('icon', data.icon);
  if (!fields.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_categories SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function trashCategories(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_categories SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

export async function restoreCategories(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_categories SET deleted_at = NULL WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

export async function permanentlyDeleteCategories(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  // FK on blog_posts.category_id is ON DELETE SET NULL, so posts keep their content and simply lose the category.
  await client.query(`DELETE FROM blog_categories WHERE id IN (${ids.map(() => '?').join(',')}) AND deleted_at IS NOT NULL`, ids);
  await client.query(`UPDATE blog_categories SET parent_id = NULL WHERE parent_id IN (${ids.map(() => '?').join(',')})`, ids).catch(() => {});
}

export async function mergeCategories(fromIds: number[], toId: number): Promise<void> {
  const ids = fromIds.filter(id => id !== toId);
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_posts SET category_id = ? WHERE category_id IN (${ids.map(() => '?').join(',')})`, [toId, ...ids]);
  await client.query(`UPDATE blog_categories SET parent_id = ? WHERE parent_id IN (${ids.map(() => '?').join(',')})`, [toId, ...ids]);
  await client.query(`UPDATE blog_categories SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

// ── Tag management ──────────────────────────────────────────────────────────
// Tags are managed as first-class entities in `blog_tags`, while `blog_posts.tags`
// remains the JSON array actually rendered on posts (kept for backward compatibility
// with the existing editor/public pages). Usage counts and merges reconcile the two
// by matching on lowercased tag name.

async function getTagUsageCounts(): Promise<Map<string, number>> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(`SELECT tags FROM blog_posts WHERE tags IS NOT NULL`);
  const counts = new Map<string, number>();
  for (const row of (rows || [])) {
    const tags = parseJsonField(row.tags);
    if (!Array.isArray(tags)) continue;
    for (const tag of tags) {
      if (typeof tag !== 'string' || !tag.trim()) continue;
      const key = tag.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

export async function getTagsAdmin(search = ''): Promise<CmsTag[]> {
  const client = await getMysqlClient();
  const needle = `%${search.trim()}%`;
  const [rows]: any = await client.query(
    search.trim()
      ? `SELECT id, name, slug, description, seo_title, seo_description, created_at, updated_at FROM blog_tags WHERE name LIKE ? OR slug LIKE ? ORDER BY name ASC`
      : `SELECT id, name, slug, description, seo_title, seo_description, created_at, updated_at FROM blog_tags ORDER BY name ASC`,
    search.trim() ? [needle, needle] : [],
  );
  const usage = await getTagUsageCounts();
  return (Array.isArray(rows) ? rows : []).map((r: any) => ({ ...r, usage_count: usage.get(String(r.name).toLowerCase()) || 0 }));
}

export async function isTagSlugAvailable(slug: string, excludeId?: number): Promise<boolean> {
  const client = await getMysqlClient();
  const [rows]: any = await client.query(
    excludeId ? `SELECT id FROM blog_tags WHERE slug = ? AND id != ? LIMIT 1` : `SELECT id FROM blog_tags WHERE slug = ? LIMIT 1`,
    excludeId ? [slug, excludeId] : [slug],
  );
  return !Array.isArray(rows) || rows.length === 0;
}

export interface TagInput { name: string; slug: string; description?: string | null; seo_title?: string | null; seo_description?: string | null; }

export async function createTag(data: TagInput): Promise<number> {
  const client = await getMysqlClient();
  const [result]: any = await client.query(
    `INSERT INTO blog_tags (name, slug, description, seo_title, seo_description) VALUES (?,?,?,?,?)`,
    [data.name, data.slug, data.description || null, data.seo_title || null, data.seo_description || null],
  );
  return result?.insertId;
}

export async function updateTag(id: number, data: Partial<TagInput>): Promise<void> {
  const fields: string[] = []; const values: any[] = [];
  const add = (col: string, val: any) => { fields.push(`\`${col}\` = ?`); values.push(val); };
  if (data.name !== undefined) add('name', data.name);
  if (data.slug !== undefined) add('slug', data.slug);
  if (data.description !== undefined) add('description', data.description);
  if (data.seo_title !== undefined) add('seo_title', data.seo_title);
  if (data.seo_description !== undefined) add('seo_description', data.seo_description);
  if (!fields.length) return;
  const client = await getMysqlClient();
  await client.query(`UPDATE blog_tags SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function deleteTags(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const client = await getMysqlClient();
  await client.query(`DELETE FROM blog_tags WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

/** Renames every occurrence of the source tags to the target tag across posts, then removes the source tag rows. */
export async function mergeTags(fromIds: number[], toId: number): Promise<void> {
  const client = await getMysqlClient();
  const ids = fromIds.filter(id => id !== toId);
  if (!ids.length) return;
  const [targetRows]: any = await client.query(`SELECT name FROM blog_tags WHERE id = ? LIMIT 1`, [toId]);
  const targetName: string | undefined = targetRows?.[0]?.name;
  if (!targetName) throw new Error('Target tag not found');
  const [sourceRows]: any = await client.query(`SELECT name FROM blog_tags WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  const sourceNames = new Set((sourceRows || []).map((r: any) => String(r.name).toLowerCase()));

  const [postRows]: any = await client.query(`SELECT id, tags FROM blog_posts WHERE tags IS NOT NULL`);
  for (const post of (postRows || [])) {
    const tags = parseJsonField(post.tags);
    if (!Array.isArray(tags) || !tags.length) continue;
    const hasSource = tags.some((t: any) => typeof t === 'string' && sourceNames.has(t.trim().toLowerCase()));
    if (!hasSource) continue;
    const next = Array.from(new Set(tags.map((t: any) => (typeof t === 'string' && sourceNames.has(t.trim().toLowerCase())) ? targetName : t)));
    await client.query(`UPDATE blog_posts SET tags = ? WHERE id = ?`, [JSON.stringify(next), post.id]);
  }
  await client.query(`DELETE FROM blog_tags WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

// ── Dashboard Statistics ───────────────────────────────────────────────────

export interface CmsDashboardStats {
  totalPosts: number;
  publishedCount: number;
  draftCount: number;
  scheduledCount: number;
  reviewCount: number;
  archivedCount: number;
  totalAuthors: number;
  totalCategories: number;
  totalMediaAssets: number;
  avgSeoScore: number;
  avgReadabilityScore: number;
  recentPosts: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
    author: string;
    category_name: string | null;
    updated_at: string;
    seo_score: number | null;
  }>;
}

export async function getCmsDashboardStats(): Promise<CmsDashboardStats> {
  const client = await getMysqlClient();

  const [postRows]: any = await client.query(`
    SELECT status, COUNT(*) as count, AVG(seo_score) as avg_seo, AVG(readability_score) as avg_readability
    FROM blog_posts
    GROUP BY status
  `);

  let totalPosts = 0;
  let publishedCount = 0;
  let draftCount = 0;
  let scheduledCount = 0;
  let reviewCount = 0;
  let archivedCount = 0;
  let seoSum = 0;
  let readabilitySum = 0;
  let scoreCount = 0;

  for (const r of (postRows || [])) {
    const c = Number(r.count);
    totalPosts += c;
    if (r.status === 'published') publishedCount = c;
    else if (r.status === 'draft') draftCount = c;
    else if (r.status === 'scheduled') scheduledCount = c;
    else if (r.status === 'review') reviewCount = c;
    else if (r.status === 'archived') archivedCount = c;

    if (r.avg_seo != null) { seoSum += Number(r.avg_seo) * c; scoreCount += c; }
    if (r.avg_readability != null) { readabilitySum += Number(r.avg_readability) * c; }
  }

  let totalAuthors = 0;
  try {
    const [authorRows]: any = await client.query(`SELECT COUNT(*) as count FROM cms_authors WHERE deleted_at IS NULL`);
    totalAuthors = Number(authorRows?.[0]?.count || 0);
  } catch { /* fallback */ }

  let totalCategories = 0;
  try {
    const [catRows]: any = await client.query(`SELECT COUNT(*) as count FROM blog_categories WHERE deleted_at IS NULL`);
    totalCategories = Number(catRows?.[0]?.count || 0);
  } catch { /* fallback */ }

  let totalMediaAssets = 0;
  try {
    const [mediaRows]: any = await client.query(`SELECT COUNT(*) as count FROM cms_media_assets`);
    totalMediaAssets = Number(mediaRows?.[0]?.count || 0);
  } catch { /* fallback */ }

  const [recentRows]: any = await client.query(`
    SELECT bp.id, bp.title, bp.slug, bp.status, bp.author, bp.updated_at, bp.seo_score, bc.name as category_name
    FROM blog_posts bp
    LEFT JOIN blog_categories bc ON bp.category_id = bc.id
    ORDER BY bp.updated_at DESC
    LIMIT 6
  `);

  return {
    totalPosts,
    publishedCount,
    draftCount,
    scheduledCount,
    reviewCount,
    archivedCount,
    totalAuthors,
    totalCategories,
    totalMediaAssets,
    avgSeoScore: scoreCount > 0 ? Math.round(seoSum / scoreCount) : 85,
    avgReadabilityScore: scoreCount > 0 ? Math.round(readabilitySum / scoreCount) : 72,
    recentPosts: (recentRows || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      status: r.status,
      author: r.author,
      category_name: r.category_name || null,
      updated_at: r.updated_at,
      seo_score: r.seo_score != null ? Number(r.seo_score) : null,
    })),
  };
}
