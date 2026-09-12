-- =============================================================================
-- Author, category, and tag management upgrade.
-- Run after 09_cms_publishing_lifecycle.sql. Safe to re-run (idempotent).
-- Uses MariaDB's `ADD COLUMN IF NOT EXISTS` (supported 10.0.2+) instead of a
-- stored-procedure/DELIMITER block, since DELIMITER is a client-only directive
-- and does not work over the mysql2 protocol driver.
-- =============================================================================

CREATE TABLE IF NOT EXISTS blog_tags (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(120) NOT NULL UNIQUE,
  description     TEXT NULL,
  seo_title       VARCHAR(600) NULL,
  seo_description VARCHAR(400) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bt_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- blog_authors: lifecycle + role/permissions
ALTER TABLE blog_authors ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER is_guest;
ALTER TABLE blog_authors ADD COLUMN IF NOT EXISTS role ENUM('author','editor','admin') NOT NULL DEFAULT 'author' AFTER status;
ALTER TABLE blog_authors ADD COLUMN IF NOT EXISTS permissions JSON NULL AFTER role;
ALTER TABLE blog_authors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL AFTER permissions;

-- blog_categories: visual identity + soft delete
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS color VARCHAR(20) NULL AFTER seo_description;
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS icon VARCHAR(50) NULL AFTER color;
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL AFTER icon;
