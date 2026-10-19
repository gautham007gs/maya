-- =============================================================================
-- Persisted media folders.
-- Previously "folders" only existed as a distinct value derived from
-- cms_media_assets.folder — so an empty folder (created but not yet holding
-- any uploaded file) disappeared the moment the page reloaded. This table
-- lets the admin UI create a folder up front and have it stick around.
-- Run after 07_cms_publishing_upgrade.sql (cms_media_assets must exist).
-- =============================================================================

CREATE TABLE IF NOT EXISTS media_folders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(300) NOT NULL UNIQUE,
  created_by  VARCHAR(200) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
