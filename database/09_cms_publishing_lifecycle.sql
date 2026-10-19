-- =============================================================================
-- FILE:    09_cms_publishing_lifecycle.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Professional publishing lifecycle for blog_posts — full status
--          workflow (draft/review/scheduled/published/archived/trash),
--          trashed_at timestamp, and admin-list index.
-- SAFE TO RE-RUN: yes. The ENUM MODIFY is idempotent-by-effect on MariaDB
--          (re-applying an identical definition preserves all data).
-- RUN ORDER: File 9 of 14 — after 08_cms_publication_structure.sql.
-- =============================================================================

ALTER TABLE blog_posts
  MODIFY COLUMN status ENUM('draft','review','scheduled','published','archived','trash')
    NOT NULL DEFAULT 'draft';

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at;

CREATE INDEX IF NOT EXISTS idx_bp_admin_list ON blog_posts (status, updated_at);
