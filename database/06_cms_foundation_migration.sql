-- =============================================================================
-- FILE:    06_cms_foundation_migration.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Foundation CMS hardening migration for Hostinger-compatible media
--          and publish-safe blog metadata.
-- SAFE TO RE-RUN: MariaDB-native ADD COLUMN IF NOT EXISTS (no procedures).
-- RUN ORDER: File 6 of 14 — after 05_audit_remediation.sql (blog_posts exists).
-- =============================================================================

ALTER TABLE `blog_posts`
  ADD COLUMN IF NOT EXISTS `featured_image_alt` VARCHAR(255) NULL AFTER `featured_image`;

ALTER TABLE `blog_posts`
  ADD COLUMN IF NOT EXISTS `content_sanitized_at` DATETIME NULL AFTER `content`;

-- Optional operational marker: backfill for posts that already have content.
UPDATE `blog_posts`
SET `content_sanitized_at` = COALESCE(`updated_at`, `created_at`)
WHERE `content_sanitized_at` IS NULL
  AND `content` IS NOT NULL;
