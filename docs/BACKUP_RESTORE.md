# Database Backup & Restore — Kruthika AI

> **Last updated:** 2026-08-11 → re-verified **2026-08-21**

Daily automated backups of the MySQL database, plus a tested restore procedure.

---

## Overview

| Concern | Answer |
|---|---|
| What is backed up | Full logical dump (`mysqldump`) of `MYSQL_DATABASE` incl. stored routines + triggers |
| Tooling | `scripts/backup-db.mjs` (dump + gzip + retention + optional off-site copy) |
| Schedule | Hostinger cron, daily 22:10 UTC (= 03:40 IST) |
| Retention | Newest 14 backups kept locally (configurable via `BACKUP_RETENTION_DAYS`) |
| Off-site copy | Optional — `BACKUP_OFFSITE_CMD` (e.g. `rclone` / `scp`) |
| Restore | `scripts/restore-db.mjs <file.sql.gz>` |
| Restore test | Documented below — run quarterly against a scratch DB |

---

## Backup script

`scripts/backup-db.mjs` reads `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
`MYSQL_PASSWORD`, `MYSQL_DATABASE` from `.env.local` (then `.env`), so no extra
config is needed on the box.

Flags used by the dump:
- `--single-transaction` — consistent snapshot, **no table locks** (InnoDB).
- `--quick` — streams rows instead of buffering (low-memory friendly).
- `--routines --triggers` — stored procedures/functions + triggers are included.
- `--no-tablespaces` — avoids permission errors on shared hosting.

Output: `backups/kruthika-<label>-<timestamp>.sql.gz`.

### Run manually

```bash
node scripts/backup-db.mjs
```

Optional flags:

```bash
# Custom directory + retention
node scripts/backup-db.mjs --dir=/var/backups/kruthika --days=30

# Named run (e.g. pre-deploy snapshot)
node scripts/backup-db.mjs --label=predeploy
```

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `BACKUP_DIR` | Where `.sql.gz` files are written | `./backups` |
| `BACKUP_RETENTION_DAYS` | Number of daily backups to keep | `14` |
| `BACKUP_OFFSITE_CMD` | Optional off-site copy command. `{file}` is replaced with the backup path. | none |

Off-site example (rclone → another host / object storage):

```bash
BACKUP_OFFSITE_CMD="rclone copy {file} remote:kruthika-backups"
```

---

## Schedule (Hostinger cron)

In Hostinger cPanel → **Cron Jobs**, add:

```
# Daily backup — 22:10 UTC = 03:40 IST
10 22 * * * cd /home/USER/htdocs/kruthika && node scripts/backup-db.mjs
```

The script exits non-zero on failure, so Hostinger can email you about missed backups.

> Make sure `backups/` is NOT served publicly (block via `.htaccess` / nginx) —
> the files contain the entire database.

---

## Restore

`scripts/restore-db.mjs` pipes the gunzipped dump into `mysql`. It never drops
anything itself — target the correct, empty/scratch database.

### Restore onto a fresh scratch DB (restore test)

```bash
# 1. Create a scratch database
mysql -h $MYSQL_HOST -u $MYSQL_USER -p -e "CREATE DATABASE kruthika_restore_test"

# 2. Restore into it
node scripts/restore-db.mjs --database=kruthika_restore_test ./backups/kruthika-daily-*.sql.gz

# 3. Verify
mysql -h $MYSQL_HOST -u $MYSQL_USER -p kruthika_restore_test \
  -e "SELECT COUNT(*) AS messages FROM messages_log; SELECT COUNT(*) AS sessions FROM kruthika_user_memory;"

# 4. Clean up the scratch DB afterwards
mysql -h $MYSQL_HOST -u $MYSQL_USER -p -e "DROP DATABASE kruthika_restore_test"
```

### Restore production (only when needed)

```bash
# Pick the newest backup
ls -t backups/kruthika-*.sql.gz | head -1

# Restore — this overwrites existing tables in the target DB
node scripts/restore-db.mjs ./backups/kruthika-daily-<latest>.sql.gz
```

---

## Restore test policy

- Run the scratch-DB restore test **quarterly** (or after any schema migration).
- Verify critical tables have sensible row counts after restore:
  - `kruthika_user_memory` (user memories)
  - `messages_log` (chat history)
  - `api_keys` (AI provider key pool)
  - `app_configurations`, `posts` (CMS content)
- Confirm `--routines` restored your stored procedures by checking `SHOW PROCEDURE STATUS;`.

---

## Notes & caveats

- `backups/` grows by one gzip per day and is pruned to `BACKUP_RETENTION_DAYS`.
- Local retention alone does NOT protect against server disk loss — enable
  `BACKUP_OFFSITE_CMD` (or a periodic `rsync`) for real disaster recovery.
- Backups are logical (SQL), so they restore cleanly across MySQL versions/engine.
- Cron retention (Issue 22) purges raw analytics >90 days — this keeps backups
  small; aggregated dashboards are unaffected.
