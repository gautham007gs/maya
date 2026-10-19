# Database — Kruthika AI
| provider_priority_v1 | Provider cascade rank per provider (lower = tried earlier; missing = Auto) | Admin → AI Keys tab → rank dropdown |

> **Last full scan:** 2026-08-21  
> **Next recommended re-scan:** if any file in `src/lib/` or `src/app/api/` was modified after this date, re-run a schema audit.
>
> **AI Agent Note:** This directory is the single source of truth for all MySQL schema, seed data, migrations, and access grants. If you are an AI agent onboarding to this project, read this file first, then read the numbered SQL files in order. Do not read the old root-level `.sql` files — they have been removed and consolidated here.

---

## Run Order (fresh install)

Run these files **in order** against your MySQL database:

| Step | File | Purpose |
|------|------|---------|
| 1 | `01_core_schema.sql` | Core tables: app config, analytics, sessions, API keys |
| 2 | `02_blog_schema.sql` | Blog CMS base tables (categories, posts, full lifecycle status) |
| 3 | `03_voice_schema.sql` | Sarvam AI key pool + pending voice messages |
| 4 | `04_migrations.sql` | Safe patch scripts — run on existing DBs to apply updates |
| 5 | `05_audit_remediation.sql` | Voice-retry columns on `pending_voice_messages`, `idx_dal_activity_date`, `ai_response_times`, quota tables, `admin_sessions` |
| 6 | `06_cms_foundation_migration.sql` | CMS foundation: featured-image alt + content sanitization marker |
| 7 | `07_cms_publishing_upgrade.sql` | Post revisions + media assets tables |
| 8 | `08_cms_publication_structure.sql` | Authors, post-authors, post-categories, slug redirects |
| 9 | `09_cms_publishing_lifecycle.sql` | Publishing lifecycle columns (status workflow, trash) |
| 10 | `10_taxonomy_management.sql` | Tags + author/category management columns |
| 11 | `11_media_seo_upgrade.sql` | Media SEO columns (dimensions, OG/Twitter overrides, scores) |
| 12 | `12_media_folders.sql` | Media folders registry |
| 13 | `13_media_blobs.sql` | DB-backed media storage (uploads survive redeploys; also self-heals at runtime) |
| — | `99_access_grants.sql` | MySQL user permission grants — ONLY if you get "Access Denied" |

**All files are idempotent** — safe to re-run without data loss. Every file is
**phpMyAdmin-safe**: no `DELIMITER` or stored procedures anywhere; idempotency
uses MariaDB-native `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
`CREATE TABLE IF NOT EXISTS`, and `INSERT IGNORE`.

> **Note:** Some tables are created **at runtime** by the code, not the SQL files: `kruthika_user_memory` (chat memory, auto-created by `/api/memory`), and the CMS tables are also auto-ensured by `src/lib/blog-db.ts` on first write. The SQL files above are the canonical schema — keep them in sync with runtime DDL.

---

## How to import (phpMyAdmin / Hostinger)

```
1. hPanel → Databases → phpMyAdmin
2. Click your database name in the left sidebar
3. Click the "Import" tab
4. Upload the file → click "Go"
5. Repeat for each file in the order above
```

Or via SSH:
```bash
mysql -h localhost -u YOUR_USER -p YOUR_DB < database/01_core_schema.sql
mysql -h localhost -u YOUR_USER -p YOUR_DB < database/02_blog_schema.sql
mysql -h localhost -u YOUR_USER -p YOUR_DB < database/03_voice_schema.sql
mysql -h localhost -u YOUR_USER -p YOUR_DB < database/04_migrations.sql
# CMS/migration files 05–11 (see run-order table above), then:
mysql -h localhost -u YOUR_USER -p YOUR_DB < database/99_access_grants.sql
```

---

## Table Index

### Core tables (`01_core_schema.sql`)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `app_configurations` | All app settings as JSON blobs (AI profile, ads, media, statuses) | `id` (named key), `settings` (JSON) |
| `messages_log` | Every user + AI message for analytics | `message_id`, `sender_type`, `chat_id`, `created_at` |
| `daily_activity_log` | One row per (user, date, chat) — DAU source | `user_pseudo_id`, `activity_date` |
| `user_sessions` | One row per browser session | `session_id`, `device_type`, `country_code`, `duration_seconds` |
| `user_analytics` | Per-session demographics (country, browser, OS) | `session_id`, `country_code`, `device_type` |
| `daily_analytics` | Aggregated daily stats (DAU, messages, errors, response time) | `date` (PK) |
| `page_views` | Page navigation events | `session_id`, `page_path`, `viewed_at` |
| `ad_interactions` | Ad impression + click events | `session_id`, `ad_type`, `action_type` |
| `ad_revenue_log` | Daily aggregated ad revenue by network + type | `date`, `ad_network`, `ad_type` |
| `user_journey_steps` | Funnel step completions | `session_id`, `step_name`, `step_order` |
| `cookie_consents` | GDPR consent per session | `session_id`, consent booleans |
| `api_keys` | AI provider keys managed from admin panel | `provider`, `key_value`, `priority`, `status` |
| `api_key_logs` | Audit log for key events | `key_id`, `event_type` |
| `ai_response_times` | LLM latency samples (moved here from runtime DDL by `05_audit_remediation.sql`) | `session_id`, `duration_ms` |

### Blog tables (`02_blog_schema.sql` + `06`–`09`)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `blog_categories` | Blog post categories | `slug` (unique), `name` |
| `blog_posts` | Full blog posts with SEO fields + structured data | `slug`, `status`, `schema_type`, `date_published` |
| `blog_authors` | Author profiles (author pages) | `slug`, `name`, `bio` |
| `blog_post_authors` | Many-to-many post ↔ author | `post_id`, `author_id` |
| `blog_post_categories` | Many-to-many post ↔ category | `post_id`, `category_id` |
| `blog_post_revisions` | Post edit history | `post_id`, `content_snapshot` |
| `blog_slug_redirects` | Old-slug → new-slug 301 mapping | `old_slug`, `new_slug` |
| `blog_tags` | Post tags + taxonomy | `slug`, `name` |

### Media tables (`05`–`07`, `10`–`11`)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `cms_media_assets` | Uploaded CMS media (images) | `id`, `file_path`, `width`, `height`, `alt_text` |
| `media_folders` | Media library folder organisation | `id`, `name`, `parent_id` |

### Voice tables (`03_voice_schema.sql`)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `sarvam_api_keys` | Sarvam TTS key pool (tracks exhausted keys) | `key_hash`, `is_exhausted` |
| `pending_voice_messages` | Cron-generated voice messages awaiting delivery | `session_id`, `is_delivered`, `expires_at` |

### Runtime-created tables

| Table | Purpose | Created by |
|-------|---------|------------|
| `kruthika_user_memory` | Per-session chat memory (plain-text facts) | `src/app/api/memory/route.ts` |
| `cron_job_runs` | Idempotency ledger for external cron jobs | `src/lib/cron-idempotency.ts` (M-005) |

---

## Named configuration keys (`app_configurations`)

The `app_configurations` table stores JSON blobs by a named `id` key. These are the active keys the codebase reads:

| Key | What it controls | Managed by |
|-----|-----------------|------------|
| `ai_profile_kruthika_chat_v1` | AI name, avatar, status, story text | Admin → Profile tab |
| `ad_settings_kruthika_chat_v1` | All ad toggles, codes, placements | Admin → Ads tab |
| `admin_own_status_config_v1` | Admin's own WhatsApp-style status | Admin → Profile tab |
| `managed_demo_contacts_config_v1` | Demo contacts in the status ring | Admin → Profile tab |
| `ai_media_assets_config_v1` | Images Kruthika can share in chat | Admin → Profile tab |
| `provider_settings` | Which AI providers are enabled | Admin → AI Keys tab |
| `voice_provider_settings` | Global voice on/off per provider (elevenlabs/sarvam) | Admin → Voice Settings tab |
| `ai_ignore_settings` | Global AI-ignore feature toggle (`ignore_enabled`) — OFF = Kruthika replies to every message | Admin → AI Replies tab |
 | | `notification_banner_config_v1` | In-app notification banner | Admin → Notifications tab |

---

## Environment variables required for DB connection

| Variable | Example | Notes |
|----------|---------|-------|
| `MYSQL_HOST` | `srv2204.hstgr.io` | Hostinger DB host |
| `MYSQL_PORT` | `3306` | Default MySQL port |
| `MYSQL_USER` | `u717356599_chatbotdb` | DB username |
| `MYSQL_PASSWORD` | `***` | DB password (use env, never hardcode) |
| `MYSQL_DATABASE` | `u717356599_chatbotdb` | DB name |

The app connects via `src/lib/mysql-client.ts` using a connection pool (`connectionLimit` = `MYSQL_CONNECTION_LIMIT` clamped to 6–20, default **10**; `connectTimeout: 3000 ms`; `queueLimit: 50`; keep-alive with 10 s initial delay). Every pool `.query()`/`.execute()` is raced against an **8 s query timeout** so a stalled query can never hang an SSR page (the JS promise rejects and callers fall back to cached/empty data; MySQL itself keeps running a timed-out query until it finishes). After **5 consecutive pool errors** the pool resets, and if the DB host is unreachable the client **fails fast for 5 s** (`DATABASE_RETRY_DELAY_MS`) instead of stalling every request with TCP timeouts. If the DB is unreachable the app runs in **degraded mode** — chat works, user memory does not persist.

---

## Staleness policy for AI agents

This document was last verified against the live codebase on **2026-08-21**.

If you are an AI agent and today's date is more than **30 days** after the last scan date above, treat this document as potentially stale and re-scan:
1. `src/lib/mysql-client.ts` — pool config
2. `src/lib/dbServer.ts` — query patterns
3. `src/app/api/**` — any new routes that query tables not listed above
4. Update the "Last full scan" date at the top of this file when done.
