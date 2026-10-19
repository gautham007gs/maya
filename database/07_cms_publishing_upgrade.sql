-- =============================================================================
-- FILE:    07_cms_publishing_upgrade.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Enterprise publishing foundation — post revisions and media library.
-- SAFE TO RE-RUN: CREATE TABLE IF NOT EXISTS on all tables.
-- RUN ORDER: File 7 of 14 — after 06_cms_foundation_migration.sql.
-- NOTE: Does not alter or invalidate existing blog posts.
--
-- INDEX-LENGTH NOTE (important): storage_path/public_url are VARCHAR(500), NOT
-- VARCHAR(1000). With utf8mb4 a UNIQUE index on VARCHAR(1000) needs up to
#4000 bytes, exceeding MariaDB InnoDB's 3072-byte max key length
#(ERROR 1071). Real storage paths are <200 chars, so 500 is generous and safe.
-- =============================================================================

CREATE TABLE IF NOT EXISTS blog_post_revisions (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id         INT NOT NULL,
  revision_type   ENUM('autosave','manual','restore') NOT NULL DEFAULT 'manual',
  title           VARCHAR(600) NOT NULL,
  content         LONGTEXT,
  snapshot        JSON NOT NULL,
  created_by      VARCHAR(200) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bpr_post_created (post_id, created_at DESC),
  CONSTRAINT fk_bpr_post FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cms_media_assets (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  storage_path    VARCHAR(500) NOT NULL UNIQUE,
  public_url      VARCHAR(500) NOT NULL,
  filename        VARCHAR(500) NOT NULL,
  mime_type       VARCHAR(100) NOT NULL,
  bytes           BIGINT NOT NULL,
  alt_text        VARCHAR(255) NULL,
  caption         TEXT NULL,
  uploaded_by     VARCHAR(200) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cma_created (created_at DESC),
  INDEX idx_cma_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;