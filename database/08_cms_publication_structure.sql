-- =============================================================================
-- Enterprise publication structure: authors, taxonomy, post authors, redirects
-- Run after 07_cms_publishing_upgrade.sql. Existing posts remain compatible.
-- =============================================================================

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
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ba_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_post_authors (
  post_id     INT NOT NULL,
  author_id   INT NOT NULL,
  author_role ENUM('author','co_author','editor','contributor') NOT NULL DEFAULT 'author',
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, author_id),
  CONSTRAINT fk_bpa_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpa_author FOREIGN KEY (author_id) REFERENCES blog_authors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_post_categories (
  post_id     INT NOT NULL,
  category_id INT NOT NULL,
  PRIMARY KEY (post_id, category_id),
  CONSTRAINT fk_bpc_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_bpc_category FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_slug_redirects (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_slug    VARCHAR(300) NOT NULL UNIQUE,
  to_slug      VARCHAR(300) NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bsr_to_slug (to_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Category hierarchy + SEO columns.
-- MariaDB-native idempotent DDL — no DELIMITER/stored procedures, so this is
-- safe to paste directly into phpMyAdmin's SQL tab (Hostinger MariaDB 10.x).
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS parent_id INT NULL AFTER description;
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS seo_title VARCHAR(600) NULL AFTER parent_id;
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS seo_description VARCHAR(400) NULL AFTER seo_title;
CREATE INDEX IF NOT EXISTS idx_bc_parent ON blog_categories (parent_id);
