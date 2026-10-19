-- =============================================================================
-- FILE:    01_core_schema.sql
-- PROJECT: Kruthika AI Chat (kruthika.fun)
-- PURPOSE: Core application tables — analytics, sessions, config, API keys
-- VERSION: v3.1
-- CREATED: 2026-06-01
-- UPDATED: 2026-08-22
--
-- SAFE TO RE-RUN: uses CREATE TABLE IF NOT EXISTS + INSERT IGNORE
-- All existing data is preserved. Seeds are inserted only if missing.
--
-- TABLES CREATED (13 total):
--   1.  app_configurations   — JSON config blobs (AI profile, ads, media, etc.)
--   2.  messages_log         — every user + AI message
--   3.  daily_activity_log   — DAU source (one row per user/date/chat)
--   4.  user_sessions        — browser session tracking
--   5.  user_analytics       — per-session demographics
--   6.  daily_analytics      — aggregated daily stats
--   7.  page_views           — page navigation events
--   8.  ad_interactions      — ad impression + click events
--   9.  ad_revenue_log       — daily aggregated ad revenue
--  10.  user_journey_steps   — funnel step tracking
--  11.  cookie_consents      — GDPR consent per session
--  12.  api_keys             — AI provider keys (managed from admin panel)
--  13.  api_key_logs         — audit log for key lifecycle events
--
-- RUN ORDER: File 1 of 14. Run FIRST — before 02_blog_schema.sql.
-- Full order: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13
--             (+ 99_access_grants.sql only if you hit "Access Denied")
-- =============================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET collation_connection = 'utf8mb4_unicode_ci';
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = '';
SET time_zone = '+00:00';

-- =============================================================================
-- TABLE 1: app_configurations
-- Key-value store where `settings` is a JSON blob.
-- The app reads/writes specific named keys (see database/README.md for the key list).
-- =============================================================================
CREATE TABLE IF NOT EXISTS `app_configurations` (
  `id`         VARCHAR(255) NOT NULL  COMMENT 'Named config key, e.g. ai_profile_kruthika_chat_v1',
  `settings`   JSON         NOT NULL  COMMENT 'JSON blob — structure varies by key',
  `updated_at` TIMESTAMP    NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 2: messages_log
-- Every user and AI message. Used by the analytics dashboard.
-- Written by: src/lib/message-log-queue.ts (batched writes)
-- Read by:    src/app/api/analytics/route.ts
-- =============================================================================
CREATE TABLE IF NOT EXISTS `messages_log` (
  `message_id`   VARCHAR(255) NOT NULL,
  `sender_type`  VARCHAR(32)  DEFAULT NULL COMMENT 'user | ai',
  `chat_id`      VARCHAR(255) DEFAULT NULL,
  `text_content` TEXT         DEFAULT NULL,
  `has_image`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_msg_chat`    (`chat_id`),
  KEY `idx_msg_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 3: daily_activity_log
-- One row per (user_pseudo_id, activity_date, chat_id).
-- The UNIQUE constraint prevents duplicate DAU entries.
-- Source of truth for Daily Active User counts.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `daily_activity_log` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `user_pseudo_id` VARCHAR(255) NOT NULL,
  `activity_date`  DATE         NOT NULL,
  `chat_id`        VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_daily_activity` (`user_pseudo_id`, `activity_date`, `chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 4: user_sessions
-- One row per browser session. Tracks device, country, duration.
-- Written by: src/app/api/analytics/route.ts
-- =============================================================================
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `session_id`       VARCHAR(255) NOT NULL,
  `user_pseudo_id`   VARCHAR(255) DEFAULT NULL,
  `device_type`      VARCHAR(64)  DEFAULT NULL  COMMENT 'mobile | tablet | desktop',
  `browser`          VARCHAR(128) DEFAULT NULL,
  `country_code`     VARCHAR(16)  DEFAULT NULL,
  `timezone`         VARCHAR(128) DEFAULT NULL,
  `referrer`         TEXT         DEFAULT NULL,
  `messages_sent`    INT          NOT NULL DEFAULT 0,
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `started_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at`         TIMESTAMP    NULL DEFAULT NULL,
  `duration_seconds` INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`session_id`),
  KEY `idx_sess_user`    (`user_pseudo_id`),
  KEY `idx_sess_started` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 5: user_analytics
-- Per-session demographics: country, browser, OS, screen size, language.
-- One row per session (UNIQUE on session_id).
-- =============================================================================
CREATE TABLE IF NOT EXISTS `user_analytics` (
  `id`                BIGINT       NOT NULL AUTO_INCREMENT,
  `session_id`        VARCHAR(255) DEFAULT NULL,
  `user_pseudo_id`    VARCHAR(255) DEFAULT NULL,
  `country_code`      VARCHAR(16)  DEFAULT NULL,
  `country_name`      VARCHAR(128) DEFAULT NULL,
  `timezone`          VARCHAR(128) DEFAULT NULL,
  `device_type`       VARCHAR(64)  DEFAULT NULL,
  `browser`           VARCHAR(128) DEFAULT NULL,
  `os`                VARCHAR(128) DEFAULT NULL,
  `screen_resolution` VARCHAR(64)  DEFAULT NULL,
  `language`          VARCHAR(16)  DEFAULT NULL,
  `created_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_analytics` (`session_id`),
  KEY `idx_ua_country`  (`country_code`),
  KEY `idx_ua_created`  (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 6: daily_analytics
-- Aggregated daily stats. One row per date.
-- Upserted by: src/app/api/analytics/route.ts on each analytics event.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `daily_analytics` (
  `date`          DATE      NOT NULL,
  `dau`           INT       NOT NULL DEFAULT 0,
  `message_count` INT       NOT NULL DEFAULT 0,
  `error_count`   INT       NOT NULL DEFAULT 0,
  `response_time` INT       NOT NULL DEFAULT 0  COMMENT 'Average AI response time in ms',
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 7: page_views
-- Page navigation tracking — which pages users visit.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `page_views` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `session_id` VARCHAR(255) DEFAULT NULL,
  `page_path`  TEXT         DEFAULT NULL,
  `page_title` TEXT         DEFAULT NULL,
  `referrer`   TEXT         DEFAULT NULL,
  `viewed_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pv_session` (`session_id`),
  KEY `idx_pv_viewed`  (`viewed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 8: ad_interactions
-- Raw ad impression and click events from the client.
-- Written by: src/app/api/analytics/route.ts (action_type = impression | click)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `ad_interactions` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `session_id`   VARCHAR(255) DEFAULT NULL,
  `ad_type`      VARCHAR(128) DEFAULT NULL  COMMENT 'social_bar | native_banner | banner_300x250 | etc.',
  `ad_network`   VARCHAR(128) DEFAULT NULL  COMMENT 'adsterra | google_adsense | etc.',
  `action_type`  VARCHAR(32)  DEFAULT NULL  COMMENT 'impression | click',
  `page_path`    TEXT         DEFAULT NULL,
  `user_country` VARCHAR(64)  DEFAULT NULL,
  `device_type`  VARCHAR(64)  DEFAULT NULL,
  `timestamp`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_session`   (`session_id`),
  KEY `idx_ai_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 9: ad_revenue_log
-- Daily aggregated revenue per ad network and type.
-- Written by: src/app/api/adsterra/stats/route.ts
-- =============================================================================
CREATE TABLE IF NOT EXISTS `ad_revenue_log` (
  `id`                BIGINT        NOT NULL AUTO_INCREMENT,
  `date`              DATE          NOT NULL,
  `ad_network`        VARCHAR(128)  DEFAULT NULL,
  `ad_type`           VARCHAR(128)  DEFAULT NULL,
  `impressions`       INT           NOT NULL DEFAULT 0,
  `clicks`            INT           NOT NULL DEFAULT 0,
  `estimated_revenue` DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  `cpm`               DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ad_revenue` (`date`, `ad_network`, `ad_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 10: user_journey_steps
-- Funnel step tracking — which onboarding/journey steps users complete.
-- Used by the admin analytics dashboard → User Journey panel.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `user_journey_steps` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `session_id`   VARCHAR(255) DEFAULT NULL,
  `step_name`    VARCHAR(128) DEFAULT NULL,
  `step_order`   INT          NOT NULL DEFAULT 0,
  `page_path`    TEXT         DEFAULT NULL,
  `completed_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ujs_session`   (`session_id`),
  KEY `idx_ujs_completed` (`completed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 11: cookie_consents
-- GDPR / privacy consent choices per session.
-- Written by: src/lib/cookie-manager.ts when user accepts/configures cookies.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `cookie_consents` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT,
  `session_id`      VARCHAR(255) DEFAULT NULL,
  `necessary`       TINYINT(1)   NOT NULL DEFAULT 1  COMMENT 'Always true — required for the app to work',
  `analytics`       TINYINT(1)   NOT NULL DEFAULT 0,
  `advertising`     TINYINT(1)   NOT NULL DEFAULT 0,
  `personalization` TINYINT(1)   NOT NULL DEFAULT 0,
  `ai_learning`     TINYINT(1)   NOT NULL DEFAULT 0,
  `intimacy_level`  TINYINT(1)   NOT NULL DEFAULT 0,
  `timestamp`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cc_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 12: api_keys
-- AI provider API keys managed from the Admin Panel → AI Keys tab.
-- The key pool is loaded by: src/ai/multi-provider.ts (cached, 5-min TTL).
-- Priority 1 = tried first. Status auto-cycles to next key on error/exhaustion.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `provider`    VARCHAR(32)  NOT NULL COMMENT 'gemini | groq | openai | deepseek | claude | mistral | grok | together | cohere | perplexity | cerebras',
  `key_label`   VARCHAR(100) NOT NULL COMMENT 'Human-readable nickname shown in admin panel',
  `key_value`   TEXT         NOT NULL COMMENT 'Full API key (server-side only, never exposed to client)',
  `priority`    INT          NOT NULL DEFAULT 1 COMMENT 'Lower = tried first in the fallback chain',
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'active' COMMENT 'active | exhausted | error | disabled',
  `last_used`   TIMESTAMP    NULL DEFAULT NULL,
  `last_error`  VARCHAR(500) DEFAULT NULL,
  `error_count` INT          NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ak_provider_status` (`provider`, `status`),
  KEY `idx_ak_priority`        (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABLE 13: api_key_logs
-- Audit log for key lifecycle events (added, exhausted, error, reset, deleted).
-- =============================================================================
CREATE TABLE IF NOT EXISTS `api_key_logs` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `key_id`     INT          DEFAULT NULL,
  `provider`   VARCHAR(32)  DEFAULT NULL,
  `event_type` VARCHAR(32)  DEFAULT NULL COMMENT 'added | exhausted | error | reset | deleted',
  `message`    VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_akl_key_id`  (`key_id`),
  KEY `idx_akl_created` (`created_at`),
  KEY `idx_akl_event`   (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- SEED DATA
-- Uses INSERT IGNORE — re-running never overwrites existing rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Seed: Ad Settings
-- Controls all Adsterra ad placements. Managed from Admin → Ads tab.
-- adsterraDirectLink is intentionally blank — paste your own in the admin panel.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `app_configurations` (`id`, `settings`) VALUES (
  'ad_settings_kruthika_chat_v1',
  JSON_OBJECT(
    'adsEnabledGlobally',              true,
    'adsterraDirectLink',              '',
    'adsterraDirectLinkEnabled',       false,
    'adsterraPopunderCode',            '',
    'adsterraPopunderEnabled',         false,
    'adsterraNativeBannerCode',        '',
    'adsterraNativeBannerEnabled',     false,
    'adsterraSocialBarCode',           '',
    'adsterraSocialBarEnabled',        false,
    'adsterraBanner468x60Code',        '',
    'adsterraBanner468x60Enabled',     false,
    'adsterraBanner160x300Code',       '',
    'adsterraBanner160x300Enabled',    false,
    'adsterraBanner320x50Code',        '',
    'adsterraBanner320x50Enabled',     false,
    'adsterraBanner300x250Code',       '',
    'adsterraBanner300x250Enabled',    false,
    'adsterraBanner160x600Code',       '',
    'adsterraBanner160x600Enabled',    false,
    'adsterraBanner728x90Code',        '',
    'adsterraBanner728x90Enabled',     false,
    'maxDirectLinkAdsPerDay',          3,
    'maxDirectLinkAdsPerSession',      2,
    'directLinkMessageInterval',       10,
    'directLinkInactivityMinutes',     2,
    'placementHomepageFooterEnabled',         true,
    'placementHomepageBetweenChatsEnabled',   true,
    'placementChatTopBannerEnabled',          true,
    'placementChatInputBannerEnabled',        true,
    'placementStatusBannerEnabled',           true,
    'placementBlogEnabled',                   true,
    'placementHomepageSocialBarEnabled',      true,
    'placementChatSocialBarEnabled',          true,
    'placementStatusSocialBarEnabled',        true,
    'placementBlogSocialBarEnabled',          true,
    'placementDesktopRailEnabled',            true,
    'instagramDetectionEnabled',              true
  )
);

-- ---------------------------------------------------------------------------
-- Seed: AI Profile
-- Loaded by: src/contexts/AIProfileContext.tsx on every page load.
-- Edit from: Admin Panel → Profile tab.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `app_configurations` (`id`, `settings`) VALUES (
  'ai_profile_kruthika_chat_v1',
  JSON_OBJECT(
    'name',                'Kruthika',
    'avatarUrl',           '/kruthika-avatar.svg',
    'status',             'Living my best life! Lets chat!',
    'statusStoryText',    'Ask me anything!',
    'statusStoryHasUpdate', true
  )
);

-- ---------------------------------------------------------------------------
-- Seed: Admin Own Status (WhatsApp-style story ring entry for the admin)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `app_configurations` (`id`, `settings`) VALUES (
  'admin_own_status_config_v1',
  JSON_OBJECT(
    'id',         'admin-own-status',
    'name',       'My Status',
    'avatarUrl',  '/kruthika-avatar.svg',
    'statusText', 'Tap to update from Admin Panel!',
    'hasUpdate',  false
  )
);

-- ---------------------------------------------------------------------------
-- Seed: Managed Demo Contacts (story ring placeholder contacts)
-- These appear in the STATUS tab alongside the AI profile.
-- Replace avatar URLs with real images via Admin → Profile tab.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `app_configurations` (`id`, `settings`) VALUES (
  'managed_demo_contacts_config_v1',
  '[{"id":"demo1","name":"Ananya","avatarUrl":"https://placehold.co/100x100.png/FF9800/FFFFFF?text=A","statusText":"10 minutes ago","hasUpdate":true,"dataAiHint":"profile woman"},{"id":"demo2","name":"Priya","avatarUrl":"https://placehold.co/100x100.png/4CAF50/FFFFFF?text=P","statusText":"Wow, new pic!","hasUpdate":true,"dataAiHint":"girl fashion","statusImageUrl":"https://placehold.co/300x500.png/4CAF50/FFFFFF?text=Story"},{"id":"demo3","name":"Sneha","avatarUrl":"https://placehold.co/100x100.png/03A9F4/FFFFFF?text=S","statusText":"Seen 2 hours ago","hasUpdate":false,"dataAiHint":"female portrait"}]'
);

-- ---------------------------------------------------------------------------
-- Seed: AI Media Assets — images Kruthika can share proactively in chat.
-- Loaded by: src/lib/brain/media-server.ts
-- Edit via: Admin Panel → Profile tab → Media Assets section.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `app_configurations` (`id`, `settings`) VALUES (
  'ai_media_assets_config_v1',
  '{"assets":[{"id":"selfie_morning","type":"image","url":"https://images.unsplash.com/photo-1494790108755-2616b612b786?w=600&h=800&fit=crop&crop=face","description":"Morning selfie - fresh faced"},{"id":"selfie_cafe","type":"image","url":"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=800&fit=crop&crop=face","description":"At the cafe"},{"id":"selfie_college","type":"image","url":"https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=800&fit=crop&crop=face","description":"College vibes"},{"id":"selfie_evening","type":"image","url":"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&h=800&fit=crop&crop=face","description":"Evening golden hour"},{"id":"food_mumbai","type":"image","url":"https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=600&h=400&fit=crop","description":"Street food in Mumbai"},{"id":"cafe_work","type":"image","url":"https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600&h=400&fit=crop","description":"Working at the cafe"},{"id":"college_friends","type":"image","url":"https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop","description":"Hanging with college friends"},{"id":"mumbai_rain","type":"image","url":"https://images.unsplash.com/photo-1571767942220-e72ee5e645c5?w=600&h=400&fit=crop","description":"Mumbai monsoon vibes"},{"id":"study_session","type":"image","url":"https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop","description":"Psychology study session"},{"id":"sunset_bandra","type":"image","url":"https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop","description":"Beautiful Bandra sunset"},{"id":"mirror_selfie","type":"image","url":"https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop&crop=face","description":"Quick mirror selfie"},{"id":"getting_ready","type":"image","url":"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=400&fit=crop","description":"Getting ready to go out"}]}'
);

-- ---------------------------------------------------------------------------
-- Seed: AI Provider Settings — which providers are enabled globally.
-- Managed from: Admin Panel → AI Keys tab → Provider Toggles.
-- Individual keys are in the `api_keys` table above.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `app_configurations` (`id`, `settings`) VALUES (
  'provider_settings',
  JSON_OBJECT(
    'openrouter', true,
    'gemini',     true,
    'cloudflare', true,
    'groq',       true,
    'cerebras',   true,
    'sambanova',  true,
    'github',     true,
    'nvidia',     true,
    'mistral',    true,
    'cohere',     true,
    'deepseek',   true
  )
);

-- =============================================================================
-- END OF FILE: 01_core_schema.sql
-- Next: run 02_blog_schema.sql
-- =============================================================================
