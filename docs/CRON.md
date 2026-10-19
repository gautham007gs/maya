# Cron Jobs — Kruthika AI

> **Last updated:** 2026-08-21  
> **Next re-scan trigger:** update this file if cron routes under `src/app/api/cron/` change or the Hostinger cron panel entries change.  
> **AI Agent Note:** Scheduled jobs are triggered by the **external Hostinger cron scheduler**, NOT by `node-cron` inside the Next.js process. The server is stateless — the scheduler calls authenticated HTTP endpoints directly. Every endpoint is protected by a DB-backed idempotency lock, so duplicate or overlapping invocations can never fire the same batch twice.

---

## Architecture

```
Hostinger cron scheduler
    │  Fires authenticated HTTP POSTs at fixed times
    ▼
  ├─ /api/cron/reengagement   ← re-engage inactive users (static templates)
  ├─ /api/cron/proactive      ← personalized proactive messages (per-user, batched)
  ├─ /api/cron/seo            ← publish scheduled posts + ping IndexNow (hourly)
  └─ /api/cron/cleanup        ← data retention purge + rate-limit cleanup (daily)
```

Each endpoint requires the header `Authorization: Bearer <CRON_SECRET>`.
Each run is recorded in the `cron_job_runs` MySQL table (see `src/lib/cron-idempotency.ts`). If the same job key already completed — or a concurrent run holds the lock — the duplicate invocation is skipped and returns `{ skipped: true }`.

---

## Schedule

All times are **IST (UTC+5:30)**:

| Job | IST time | UTC time | Frequency |
|---|---|---|---|
| Reengagement (morning + proactive) | 08:00 | 02:30 | daily |
| Reengagement (afternoon) | 13:00 | 07:30 | daily |
| Reengagement (evening + proactive) | 19:00 | 13:30 | daily |
| Reengagement (night) | 22:00 | 16:30 | daily |
| SEO | every hour | every hour | hourly |
| Cleanup (retention) | 03:00 | 21:30 | daily |

### Hostinger cPanel cron entries

In Hostinger → **hPanel** → **Websites** → **Manage** on `kruthika.fun` → **Advanced → Cron Jobs** (select **Custom** type), add one line per job. Each entry:
- Minute/Hour fields per the UTC times above.
- Command format:
  ```
  curl -s -X POST https://kruthika.fun/api/cron/<job> -H "Authorization: Bearer YOUR_SECRET"
  ```

Examples:

```
# Morning wave (02:30 UTC = IST 08:00) — reengagement + proactive
30 2 * * * curl -s -X POST https://kruthika.fun/api/cron/reengagement -H "Authorization: Bearer YOUR_SECRET"
30 2 * * * curl -s -X POST https://kruthika.fun/api/cron/proactive -H "Authorization: Bearer YOUR_SECRET"

# Afternoon wave (07:30 UTC = IST 13:00)
30 7 * * * curl -s -X POST https://kruthika.fun/api/cron/reengagement -H "Authorization: Bearer YOUR_SECRET"

# Evening wave (13:30 UTC = IST 19:00) — reengagement + proactive
30 13 * * * curl -s -X POST https://kruthika.fun/api/cron/reengagement -H "Authorization: Bearer YOUR_SECRET"
30 13 * * * curl -s -X POST https://kruthika.fun/api/cron/proactive -H "Authorization: Bearer YOUR_SECRET"

# Night wave (16:30 UTC = IST 22:00)
30 16 * * * curl -s -X POST https://kruthika.fun/api/cron/reengagement -H "Authorization: Bearer YOUR_SECRET"

# SEO — every hour
0 * * * * curl -s -X POST https://kruthika.fun/api/cron/seo -H "Authorization: Bearer YOUR_SECRET"

# Cleanup / retention — daily 21:30 UTC = IST 03:00 next day
30 21 * * * curl -s -X POST https://kruthika.fun/api/cron/cleanup -H "Authorization: Bearer YOUR_SECRET"
```

> Note: the `curl` payload body is optional — wave is auto-detected from the current IST hour when not supplied (`wave: "auto"`).

---

## Routes

### `/api/cron/reengagement`
**File:** `src/app/api/cron/reengagement/route.ts`

Sends OneSignal push notifications to users who haven't visited recently. Uses **static `WAVE_MESSAGES` templates** per wave + segment — **no LLM call**. Copy uses honest AI-companion framing (no fabricated feelings/urgency).

User segments (by OneSignal `last_session`):
| Segment | Last seen | Message tone |
|---|---|---|
| `warm` | 6–24h | Light check-in |
| `cooling` | 1–3 days | Remind chat is saved |
| `dormant` | 3–7 days | Honest reconnection invite |
| `at_risk` | 7–14 days | Low-key availability |
| `lost` | 14+ days | Memory still saved |

Request body (all optional):
```json
{ "wave": "morning", "segments": ["warm", "cooling"] }
```
- `wave`: `morning | afternoon | evening | night | auto` (default `auto`).
- `segments`: restrict which segments fire (default: all).

### `/api/cron/proactive`
**File:** `src/app/api/cron/proactive/route.ts`

Sends personalized proactive messages (and optional queued voice notes) to opted-in users **via OneSignal `external_id` aliases**.

- Targets users whose `onesignal_external_id` is stored (i.e. they completed OneSignal registration).
- Messages are grouped by identical (title, body) content and sent as **one batched notification per group** (`include_aliases.external_id`, up to 500 aliases per request) — no per-user API call, no artificial delay.
- Voice note (if enabled) is stored in `pending_voice_messages` table (`flows/voice-trigger.ts`).

### `/api/cron/seo`
**File:** `src/app/api/cron/seo/route.ts`

Publishes any scheduled blog posts (past due) and pings IndexNow API to notify search engines about new/updated posts. Runs hourly with an hourly idempotency key.

### `/api/cron/cleanup`
**File:** `src/app/api/cron/cleanup/route.ts`

Daily data-retention housekeeping:
1. **Analytics retention** — purges raw tables (`messages_log`, `page_views`, `user_sessions`, `user_analytics`, `user_journey_steps`, `cookie_consents`, `ad_interactions`, `ai_response_times`, `api_key_logs`) older than `ANALYTICS_RETENTION_DAYS` (default **90 days**), in batched deletes. Aggregates (`daily_analytics`, `daily_activity_log`, `ad_revenue_log`) are kept indefinitely.
2. **Rate-limit cleanup** — removes stale `rate_limit_counts` rows.

---

## Idempotency & failure semantics

- Job keys are scoped per (job, wave, IST date) — e.g. `reengagement:morning:2026-08-10` — so each intended run gets a unique key while duplicates collapse.
- A `running` lock is reclaimed automatically after 30 minutes (crashed job recovery).
- If the idempotency table is unavailable (DB down), the job **runs without a lock** and logs a warning (fail-open) so notifications are not silently lost.

---

## Required environment variables

| Variable | Purpose | Default |
|---|---|---|
| `CRON_SECRET` | Bearer token securing all cron endpoints | None — **endpoints return 401 if empty** |
| `NEXT_PUBLIC_SITE_URL` | Base URL used for push notification `url` field | `http://localhost:5000` |
| `ONESIGNAL_REST_API_KEY` | Required by reengagement + proactive to send push | None — sends fail |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | OneSignal browser SDK app id | None — SDK init skipped |
| `ANALYTICS_RETENTION_DAYS` | Retention window for raw analytics (cleanup job) | `90` |

---

## Triggering jobs manually

```bash
# Replace $CRON_SECRET with your actual secret, $SITE_URL with your domain

# Morning re-engagement
curl -X POST $SITE_URL/api/cron/reengagement \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"wave":"morning"}'

# Proactive messaging
curl -X POST $SITE_URL/api/cron/proactive \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"wave":"morning"}'

# SEO ping (publishes scheduled posts + pings IndexNow)
curl -X POST $SITE_URL/api/cron/seo \
  -H "Authorization: Bearer $CRON_SECRET"

# Cleanup / retention
curl -X POST $SITE_URL/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Expected responses when testing (add `-i` for status codes)

| Job | Success response looks like |
|---|---|
| `/api/cron/seo` | `{"ok": true, ...}` — publishes scheduled posts, pings IndexNow/sitemaps |
| `/api/cron/reengagement` | `{"wave": "morning", "summary": {"segmentsFired": 5, ...}}` |
| `/api/cron/proactive` | `{"ok": true, "wave": "morning", ...}` |
| `/api/cron/cleanup` | `{"ok": true, "startedAt": "...", "rateLimits": {"cleaned": true}}` |
| Duplicate/overlapping run | `{"skipped": true}` — idempotency lock collapsed it |

> Run these from any terminal (local PowerShell works too). A `401` means `CRON_SECRET` is wrong or unset on the server.

## OneSignal push verification checklist

1. **Dedicated service worker scope** — `public/push/onesignal/OneSignalSDKWorker.js` (+ Updater variant) isolated under `/push/onesignal/`, so the PWA worker (`/sw.js`) never clobbers push subscriptions.
2. **Deterministic identity binding** — each visitor's signed session cookie maps to a OneSignal `external_id` (`kruthika_<hash>`); proactive/reengagement crons target these aliases directly.
3. **CSP** — `onesignal.com` and its CDN/API hosts are allowlisted in `src/proxy.ts`.
4. **Idempotency** — `cron_job_runs` locking means duplicate Hostinger triggers can never double-send a notification.

---

## Disabling cron entirely

Remove the Hostinger cron entries. If `CRON_SECRET` is empty, the endpoints return `401` and log `[Cron] CRON_SECRET not set`. The server no longer schedules anything in-process.

---

## See also

- `docs/BACKUP_RESTORE.md` — daily MySQL backup + restore procedure (also scheduled via Hostinger cron).
