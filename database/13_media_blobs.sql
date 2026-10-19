-- =============================================================================
-- database/13_media_blobs.sql
-- Database-backed media storage — makes uploaded media survive redeploys.
--
-- Previously uploads were stored ONLY on the server's local disk
-- (.cms-media/ or public/uploads/). A Hostinger redeploy/rebuild wipes the
-- working directory, so files vanished while their cms_media_assets rows
-- survived and the whole library degraded to fallback images.
--
-- This table is the SOURCE OF TRUTH for media bytes.
-- NOTE on PRIMARY KEY LENGTH: storage_path is VARCHAR(191) to stay strictly
-- within InnoDB's 767-byte limit on standard utf8mb4 configurations (191 * 4 = 764B).
--
-- Serving order in src/app/uploads/[...path]/route.ts:
--   1) disk cache (.cms-media / public/uploads)
--   2) this table (authoritative, writes back to disk cache on read)
--   3) static fallback image (images only)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `media_blobs` (
  `storage_path` VARCHAR(191) NOT NULL COMMENT 'Relative path under media root, e.g. blog/2026/08/name-20260822-ab12cd34.webp',
  `mime_type`    VARCHAR(150) NOT NULL,
  `bytes`        INT NOT NULL,
  `content`      LONGBLOB NOT NULL,
  `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`storage_path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
