-- =============================================================================
-- FILE:    02_blog_schema.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Blog CMS tables — categories, posts, SEO fields, structured data
-- VERSION: v2.1
-- CREATED: 2026-06-01
-- UPDATED: 2026-07-26
--
-- SAFE TO RE-RUN: IF NOT EXISTS + INSERT IGNORE + guarded ALTER TABLE.
--
-- TABLES CREATED:
--   blog_categories — post categories with slugs
--   blog_posts      — full posts with SEO, structured data, and reading stats
--
-- RUN ORDER: File 2 of 14. Run after 01_core_schema.sql.
--
-- MANAGED BY: Admin Panel → /admin/blog
-- READ BY:    src/lib/blog-db.ts, src/app/api/blog/posts/route.ts
-- =============================================================================

-- =============================================================================
-- TABLE: blog_categories
-- =============================================================================
CREATE TABLE IF NOT EXISTS blog_categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: default categories for the AI companion niche
-- INSERT IGNORE is safe — re-running won't duplicate rows.
INSERT IGNORE INTO blog_categories (name, slug, description) VALUES
  ('AI Companions',    'ai-companions',    'Reviews and guides about AI girlfriend and companion apps'),
  ('Technology',       'technology',       'Deep dives into AI technology and how it works'),
  ('Psychology',       'psychology',       'Research and psychology of human-AI relationships'),
  ('Reviews',          'reviews',          'App reviews and side-by-side comparisons'),
  ('How-To Guides',    'how-to',           'Step-by-step practical guides'),
  ('News & Trends',    'news',             'Industry news and market trends'),
  ('Privacy & Safety', 'privacy-safety',   'Data privacy, safety, and responsible use'),
  ('India & Culture',  'india-culture',    'AI companions in the context of Indian culture'),
  ('Mental Health',    'mental-health',    'AI companionship and emotional wellbeing research'),
  ('Comparisons',      'comparisons',      'Head-to-head comparisons of AI companion platforms');

-- =============================================================================
-- TABLE: blog_posts
-- Full blog posts with all SEO, Schema.org, and content fields.
--
-- Field groups:
--   Core:       slug, title, excerpt, content, author, author_title, category_id, status
--   Media:      featured_image, og_image
--   Schema.org: schema_type, faq_items, word_count, reading_time_minutes
--   SEO:        seo_title, seo_description, seo_keywords, long_tail_keywords,
--               canonical_url, noindex, date_published, date_modified
--   Tags:       tags (JSON array of strings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  slug                  VARCHAR(300)  NOT NULL UNIQUE,
  title                 VARCHAR(600)  NOT NULL,
  excerpt               TEXT          COMMENT 'Short description for listing pages and meta description',
  content               LONGTEXT      COMMENT 'Full HTML/Markdown content of the post',
  author                VARCHAR(200)  DEFAULT 'Kruthika.fun Team',
  author_title          VARCHAR(600)  COMMENT 'Author credentials for E-E-A-T (shown in structured data)',
  category_id           INT           REFERENCES blog_categories(id) ON DELETE SET NULL,

  status                ENUM('draft','review','scheduled','published','archived','trash') NOT NULL DEFAULT 'draft',
   featured_image        VARCHAR(1000) COMMENT 'Absolute URL to the hero / OG image',
   featured_image_alt    VARCHAR(255) COMMENT 'Accessible description for the featured image',

  -- Schema.org type — controls which JSON-LD block is emitted on the post page
  schema_type           ENUM(
                          'BlogPosting','Article','NewsArticle',
                          'TechArticle','FAQPage','HowTo'
                        ) NOT NULL DEFAULT 'BlogPosting',

  -- Tags stored as a JSON array: ["AI girlfriend","virtual companion","India"]
  tags                  JSON,

  -- SEO meta overrides
  seo_title             VARCHAR(600)  COMMENT 'Overrides <title> tag (aim ≤60 chars)',
  seo_description       VARCHAR(400)  COMMENT 'Overrides meta description (aim ≤160 chars)',
  seo_keywords          TEXT          COMMENT 'Comma-separated primary keywords',
  long_tail_keywords    JSON          COMMENT 'Array of long-tail keyword strings',
  og_image              VARCHAR(1000) COMMENT 'Social share image URL; falls back to featured_image',
  canonical_url         VARCHAR(1000) COMMENT 'Canonical URL; defaults to /blog/<slug>',
  noindex               TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1 = exclude from search engines',

  -- FAQ / HowTo structured data items
  faq_items             JSON          COMMENT '[{"question":"...","answer":"..."}]',

  -- Reading stats used in JSON-LD + display
  word_count            INT           DEFAULT 0,
  reading_time_minutes  INT           DEFAULT 1,

  -- Publish dates (ISO strings for schema.org datePublished/dateModified)
  date_published        DATE,
  date_modified         DATE,
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_bp_slug   (slug),
  INDEX idx_bp_status (status),
  INDEX idx_bp_date   (date_published),
  INDEX idx_bp_cat    (category_id),
  INDEX idx_bp_type   (schema_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- UPGRADES for EXISTING installs (fresh installs above already have every
-- column in its final form — these statements are no-ops there).
--
-- MariaDB-native idempotent DDL: ADD COLUMN IF NOT EXISTS works on MariaDB
-- 10.x (Hostinger). No DELIMITER / stored procedures — safe to paste straight
-- into phpMyAdmin's SQL tab.
-- The final ENUM MODIFY is intentionally unconditional: re-running an
-- identical MODIFY is a harmless no-op and preserves all data.
-- =============================================================================
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS schema_type
    ENUM('BlogPosting','Article','NewsArticle','TechArticle','FAQPage','HowTo')
    NOT NULL DEFAULT 'BlogPosting' AFTER featured_image;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS tags JSON
    COMMENT '["AI girlfriend","virtual companion"]'
    AFTER schema_type;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS long_tail_keywords JSON
    AFTER seo_keywords;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS featured_image_alt VARCHAR(255)
    COMMENT 'Accessible description for the featured image'
    AFTER featured_image;

ALTER TABLE blog_posts
  MODIFY COLUMN status ENUM('draft','review','scheduled','published','archived','trash')
    NOT NULL DEFAULT 'draft';

-- =============================================================================
-- END OF FILE: 02_blog_schema.sql
-- Next: run 03_voice_schema.sql
-- =============================================================================
