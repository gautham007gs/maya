-- =============================================================================
-- FILE:    14_featured_image_caption.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Adds featured_image_caption column to blog_posts for crediting
--          image authors, sources, or captions below featured hero images.
-- SAFE TO RE-RUN: MariaDB-native ADD COLUMN IF NOT EXISTS.
-- RUN ORDER: File 14 of 14 — after 02_blog_schema.sql.
-- =============================================================================

SET NAMES utf8mb4;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS featured_image_caption TEXT NULL DEFAULT NULL
    COMMENT 'Image source, photographer credit, or caption displayed below hero image'
    AFTER featured_image_alt;
