-- =============================================================================
-- FILE:    04_migrations.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Patch scripts for EXISTING databases — safe to run on a live DB.
--          New installs: these are already baked into 01–03; still safe to run.
-- VERSION: v1.3
-- CREATED: 2026-06-20
-- UPDATED: 2026-07-26
--
-- SAFE TO RE-RUN: all statements check state before modifying.
--
-- RUN ORDER: File 4 of 14. Run after 01–03 on existing installs.
--            Run once on new installs too (no-ops if already applied).
--
-- MIGRATIONS IN THIS FILE:
--   M-001  Add idx_ujs_completed index to user_journey_steps (performance fix)
--   M-002  Clear hardcoded Adsterra direct-link URL from ad_settings row
--   M-003  Add cerebras to provider_settings if missing
--   M-004  Add onesignal_external_id to kruthika_user_memory (external_id targeting)
--   M-005  Create cron_job_runs idempotency table (external cron dedup)
--   M-006  Create admin_sessions table (server-side admin session revocation)
-- =============================================================================

-- =============================================================================
-- M-001: Add missing index on user_journey_steps.completed_at
--
-- Problem: The admin analytics dashboard's User Journey panel sorts and filters
-- user_journey_steps by completed_at with no supporting index — causing a full
-- table scan on every dashboard load.
--
-- Fix: Add the index. Uses INFORMATION_SCHEMA check so it's safe to re-run
-- on any MySQL version (ADD INDEX IF NOT EXISTS only works on MySQL 8.0.29+).
-- =============================================================================
SET @m001_idx_exists = (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'user_journey_steps'
    AND INDEX_NAME   = 'idx_ujs_completed'
);
SET @m001_sql = IF(
  @m001_idx_exists = 0,
  'ALTER TABLE `user_journey_steps` ADD INDEX `idx_ujs_completed` (`completed_at`)',
  'SELECT "M-001: idx_ujs_completed already exists — skipping" AS migration_status'
);
PREPARE m001_stmt FROM @m001_sql;
EXECUTE m001_stmt;
DEALLOCATE PREPARE m001_stmt;

-- =============================================================================
-- M-002: Clear hardcoded Adsterra direct-link URL
--
-- Problem: Earlier seed data (v1.x) included a hardcoded Adsterra direct-link
-- URL in the ad_settings row. All ad content must come from the Admin Panel.
--
-- Fix: Zero out adsterraDirectLink and disable adsterraDirectLinkEnabled.
-- JSON_SET only modifies those two keys — all other ad settings are preserved.
-- =============================================================================
UPDATE `app_configurations`
SET `settings` = JSON_SET(
  `settings`,
  '$.adsterraDirectLink',        '',
  '$.adsterraDirectLinkEnabled', FALSE
)
WHERE `id`    = 'ad_settings_kruthika_chat_v1'
  AND JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.adsterraDirectLink')) != '';

-- Verify M-002 result:
-- SELECT
--   JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.adsterraDirectLink'))        AS direct_link,
--   JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.adsterraDirectLinkEnabled')) AS direct_link_enabled
-- FROM `app_configurations`
-- WHERE `id` = 'ad_settings_kruthika_chat_v1';

-- =============================================================================
-- M-003: Add cerebras to provider_settings
--
-- Problem: The original provider_settings seed did not include 'cerebras'
-- because Cerebras support was added later. This patch adds it without
-- touching any other provider flag.
--
-- Safe: JSON_SET only adds the key if missing; if it already exists it's a
-- no-op update to the same value.
--
-- MariaDB NOTE: CAST('true' AS JSON) is MySQL-only syntax and fails with
-- #1064 on MariaDB (Hostinger). JSON_EXTRACT('true', '$') parses the literal
-- text 'true' into a genuine JSON boolean and works identically on BOTH
-- MySQL 5.7+/8 AND MariaDB 10.x.
-- =============================================================================
UPDATE `app_configurations`
SET `settings` = JSON_SET(`settings`, '$.cerebras', JSON_EXTRACT('true', '$'))
WHERE `id` = 'provider_settings'
  AND JSON_EXTRACT(`settings`, '$.cerebras') IS NULL;

-- =============================================================================
-- M-004: Add onesignal_external_id to kruthika_user_memory
--
-- Problem: Push targeting previously relied on raw OneSignal player IDs stored
-- per user. Modern targeting uses a stable external_id (kruthika_<hash>, derived
-- from the signed session cookie). This column marks users who completed
-- OneSignal registration so the proactive cron only targets real subscribers.
--
-- Note: The app also self-migrates via ADD COLUMN IF NOT EXISTS at runtime; this
-- entry exists for direct-DB / manual installs.
-- =============================================================================
SET @m004_col_exists = (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'kruthika_user_memory'
    AND COLUMN_NAME  = 'onesignal_external_id'
);
SET @m004_sql = IF(
  @m004_col_exists = 0,
  'ALTER TABLE `kruthika_user_memory` ADD COLUMN `onesignal_external_id` VARCHAR(64) DEFAULT NULL',
  'SELECT "M-004: onesignal_external_id already exists — skipping" AS migration_status'
);
PREPARE m004_stmt FROM @m004_sql;
EXECUTE m004_stmt;
DEALLOCATE PREPARE m004_stmt;

-- =============================================================================
-- M-005: Create cron_job_runs idempotency table
--
-- Problem: Scheduled jobs are triggered by an EXTERNAL cron provider (Hostinger),
-- which can double-fire the same job. This table records per (job_name, run_key)
-- whether a run completed, so duplicate invocations are skipped.
--
-- Note: The app self-migrates via CREATE TABLE IF NOT EXISTS at runtime; this
-- entry exists for direct-DB / manual installs.
-- =============================================================================
CREATE TABLE IF NOT EXISTS cron_job_runs (
  job_name     VARCHAR(64)  NOT NULL,
  run_key      VARCHAR(191) NOT NULL,
  status       ENUM('running','done','failed') NOT NULL DEFAULT 'running',
  started_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at  TIMESTAMP    NULL DEFAULT NULL,
  result_json  JSON         NULL,
  PRIMARY KEY (job_name, run_key),
  KEY idx_cjr_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- M-006: Create admin_sessions table
--
-- Problem: Admin session tokens carried only an HMAC + expiry, so a logged-out
-- token stayed valid until its 8h TTL even after logout / forced revocation.
-- This table records each issued session so logout (and future admin forced
-- logout) takes effect server-side immediately.
--
-- Note: The app self-migrates via CREATE TABLE IF NOT EXISTS at runtime
-- (src/lib/admin-auth.ts); this entry exists for direct-DB / manual installs.
-- =============================================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id VARCHAR(191) NOT NULL PRIMARY KEY,
  email      VARCHAR(191) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP    NOT NULL,
  revoked_at TIMESTAMP    NULL DEFAULT NULL,
  KEY idx_admin_sessions_email (email),
  KEY idx_admin_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- END OF FILE: 04_migrations.sql
-- Files 05–13 remaining: run them in numeric order to finish the schema.
-- =============================================================================
