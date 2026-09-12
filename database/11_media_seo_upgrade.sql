-- =============================================================================
-- FILE:    11_media_seo_upgrade.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Adds folder, dimensions, Twitter card, extended OG, readability
--          score, and SEO score columns required by the Media Library v2 and
--          SEO Toolkit features.
-- SAFE TO RE-RUN: yes — MariaDB-native ADD COLUMN IF NOT EXISTS / CREATE INDEX
--          IF NOT EXISTS. No DELIMITER or stored procedures (phpMyAdmin-safe).
-- RUN ORDER: File 11 of 14 — after 07_cms_publishing_upgrade.sql
--          (cms_media_assets must exist) and 02_blog_schema.sql (blog_posts).
-- =============================================================================

SET NAMES utf8mb4;

-- ── cms_media_assets: virtual folder + image dimensions ──────────────────────
ALTER TABLE cms_media_assets
  ADD COLUMN IF NOT EXISTS folder VARCHAR(500) NULL DEFAULT NULL
    COMMENT 'Virtual folder path, e.g. "blog/2026/july"'
    AFTER caption;

ALTER TABLE cms_media_assets
  ADD COLUMN IF NOT EXISTS width INT NULL DEFAULT NULL
    COMMENT 'Image width in pixels'
    AFTER folder;

ALTER TABLE cms_media_assets
  ADD COLUMN IF NOT EXISTS height INT NULL DEFAULT NULL
    COMMENT 'Image height in pixels'
    AFTER width;

CREATE INDEX IF NOT EXISTS idx_cma_folder ON cms_media_assets (folder);

-- ── blog_posts: extended OpenGraph overrides ─────────────────────────────────
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS og_title VARCHAR(600) NULL DEFAULT NULL
    COMMENT 'OpenGraph og:title override'
    AFTER og_image;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS og_description TEXT NULL DEFAULT NULL
    COMMENT 'OpenGraph og:description override'
    AFTER og_title;

-- ── blog_posts: Twitter card overrides ───────────────────────────────────────
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS twitter_card
    ENUM('summary','summary_large_image') NOT NULL DEFAULT 'summary_large_image'
    COMMENT 'Twitter card type'
    AFTER og_description;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS twitter_title VARCHAR(600) NULL DEFAULT NULL
    COMMENT 'Twitter card title override'
    AFTER twitter_card;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS twitter_description TEXT NULL DEFAULT NULL
    COMMENT 'Twitter card description override'
    AFTER twitter_title;

-- ── blog_posts: content quality scores (SEO Toolkit) ─────────────────────────
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS readability_score TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Flesch-Kincaid reading ease 0-100 (100 = easiest)'
    AFTER twitter_description;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS seo_score TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Rule-based SEO score 0-100'
    AFTER readability_score;
