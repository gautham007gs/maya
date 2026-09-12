# 🚀 KRUTHIKA AI — ULTIMATE HOSTINGER DEPLOYMENT GUIDE

> **Target:** Hostinger **Business Plan** (Node.js hosting) · Domain: `kruthika.fun`
> **Stack:** Next.js 16 (App Router) · MySQL 8 · Node.js 20+
> **Last verified:** 2026-08-24 against this exact codebase (added Method 0 —
> hPanel's current one-click "Node.js Web App" GitHub-import flow — and made
> `package.json`'s start script honor Hostinger's dynamic `PORT`).
>
> This file covers EVERYTHING: 3 deployment methods, Git setup, env variables,
> database migrations, cron jobs (with exact times & commands), notification
> customization, site updates, and error troubleshooting.
>
> Companion docs: `docs/CRON.md` (cron internals) · `docs/BACKUP_RESTORE.md`
> · `database/README.md` (schema) · `LOCAL_SETUP.md` (local dev)

---

## 📋 TABLE OF CONTENTS

0. [Method 0 — hPanel "Node.js Web App" GitHub Import (FASTEST, CURRENT 2026 UI)](#0-method-0--hpanel-nodejs-web-app-github-import-fastest-current-2026-ui)
1. [Prerequisites](#1-prerequisites)
2. [Method A — GitHub → Hostinger Node.js Panel (SSH, advanced/manual)](#2-method-a--github--hostinger-nodejs-panel-recommended)
3. [Method B — GitHub Actions CI/CD (auto-deploy on push)](#3-method-b--github-actions-cicd-auto-deploy-on-push)
4. [Method C — Manual Upload (File Manager / FTP)](#4-method-c--manual-upload-file-manager--ftp)
5. [What to Push & Ignore (.gitignore)](#5-what-to-push--ignore-gitignore)
6. [Environment Variables — production checklist](#6-environment-variables--production-checklist)
7. [Database Setup & Migrations](#7-database-setup--migrations)
8. [Cron Jobs — exact setup, step by step](#8-cron-jobs--exact-setup-step-by-step)
9. [Customizing Cron Notification Messages](#9-customizing-cron-notification-messages)
10. [Updating the Site After Launch](#10-updating-the-site-after-launch)
11. [Troubleshooting — every common error & fix](#11-troubleshooting--every-common-error--fix)
12. [Post-Deploy Verification Checklist](#12-post-deploy-verification-checklist)

---

## 0. METHOD 0 — hPanel "Node.js Web App" GitHub Import (FASTEST, CURRENT 2026 UI)

Hostinger's Business plan now has a dedicated **"Node.js Web App"** product inside
hPanel that builds and runs the app for you — no SSH, no PM2, no manual `npm run
build` on the server. This is the recommended path for this repo. (The older
SSH-based flow in **Method A** below still works and is kept for advanced/manual
control or troubleshooting.)

This project's `package.json` has already been prepared for this flow:
- `"engines": { "node": ">=20.9.0" }` — tells Hostinger which runtime to use.
- OpenAI `6.21.0` and sanitize-html `2.16.0` are pinned to versions that install
  cleanly on Node.js 20. Do not let an automated dependency update move them to
  the newer Node.js 22-only major/minor releases.
- `"start": "next start -p ${PORT:-5000} -H 0.0.0.0"` — automatically binds to
  **whatever port Hostinger's proxy assigns via the `PORT` env var**, instead of
  a hardcoded port. This is the #1 cause of "green build, dead site" on
  Hostinger's Node.js panel, and it's already fixed here.

### Step 0.1 — Push this codebase to GitHub

```bash
git init
git add .
git commit -m "Initial production commit"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/kruthika-ai.git
git push -u origin main
```

> Confirm `.env` is never committed — `git status` must never list it. The
> included `.gitignore` already blocks every `.env*` file except `.env.example`.

### Step 0.2 — Create the Node.js Web App in hPanel

1. hPanel → **Websites** → **Add Website**.
2. Choose **Node.js Web App** (on Business plan this also appears as **Deploy Web App**).
3. Pick **Import Git repository** → **Connect with GitHub** → authorize the
   Hostinger GitHub App → grant it access to this repository (or all repos).
4. Select the repo and the branch (`main`) → click **Deploy**.
5. Hostinger auto-detects **Next.js** and pre-fills:
   | Field | Value to confirm |
   |---|---|
   | Framework preset | Next.js |
   | Node.js version | **20.x or 22.x** — **do NOT pick 18**, Next.js 16 requires Node ≥ 20.9 |
   | Package manager | npm (auto-detected from `package-lock.json`) |
   | Build command | `npm run build` |
   | Output directory | `.next` |
   | Entry file / Start command | should resolve to `npm run start` — leave as detected |
6. Before clicking **Deploy**, open **Environment Variables** and add the
   production values from `.env.example` (see §6 below). Use the **Import
   .env** button to paste the whole block at once instead of typing each key.
7. Click **Deploy**. Watch the live build log; a failed build gets an
   AI-generated diagnosis with a **Fix and redeploy** button.

### Step 0.3 — Database (MySQL)

Hostinger's Node.js panel has a one-click **Connect a database** wizard, but it
currently only supports **Supabase** and **MongoDB Atlas** — not MySQL. Since
this app uses MySQL, create it the normal way and point the app at it manually:

1. hPanel → **Databases** → **MySQL Databases** → create a database + user.
2. Copy the host/user/password/dbname into this app's environment variables
   (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`) — same
   panel as Step 0.2.6, or later via **Website Dashboard → Environment
   Variables → Settings & Redeploy**.
3. Run the SQL files in `database/` against that database once (phpMyAdmin,
   or `mysql -h HOST -u USER -p DBNAME < database/01_core_schema.sql`, in the
   numbered order — see §7 below for the full list and `database/README.md`).

### Step 0.4 — Ongoing updates

Nothing to do manually. Once connected, every `git push` to the selected
branch triggers an automatic rebuild + redeploy (visible as an
**Auto-deployment** chip on the app dashboard). Changing environment
variables always requires an explicit **Save and redeploy** to take effect.

### Step 0.5 — Verify

Open `https://<your-domain>/api/health` — expect `{"status":"ok", ...}`. If
the build is green but the site doesn't respond, check **Runtime Logs** in
the app dashboard first — per Hostinger, the #1 cause is "missing env vars,
or binding to the wrong port" (already handled by the `PORT`-aware start
script above, so a green-but-dead app almost always means a missing/incorrect
env var — cross-check against §6).

---

## 1. PREREQUISITES

| Requirement | Where to get it | Notes |
|---|---|---|
| Hostinger **Business** plan with Node.js | hPanel → Website → Node.js app | Business supports Node.js apps + SSH |
| MySQL database created | hPanel → Databases → MySQL | Note host/user/pass/dbname |
| GitHub account + repo (private recommended) | github.com | Method A/B only |
| Domain connected to hosting | hPanel → Domains | SSL enabled (free Let's Encrypt) |
| Secrets generated | Commands in §6 | COOKIE_SECRET etc. |
| AI provider keys (≥1) | See `.env.example` §5 | Or add later via Admin Panel |
| OneSignal account (optional) | onesignal.com | For push notifications/cron |

**Business plan limits to know:**
- Entry processes / RAM are limited → keep `MYSQL_CONNECTION_LIMIT` at 10 (default).
- Build can be memory-hungry → if `npm run build` dies inside hPanel, build
  locally and upload `.next` too (Method C), or use Method B which builds on
  GitHub's runners instead.

---

## 2. METHOD A — GITHUB → HOSTINGER NODE.JS PANEL (RECOMMENDED)

Best balance: push to GitHub, pull on the server over SSH, build there.

### Step A1 — Create the repo & push your code

```bash
# On your local machine, inside the project folder:
git init
git add .
git commit -m "Initial production commit"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/kruthika-ai.git
git push -u origin main
```

> Verify `.env` is NOT committed: `git status` must never list `.env`.
> The included `.gitignore` already excludes it (see §5).

### Step A2 — Prepare the server (SSH)

In hPanel → **Websites → Manage → SSH access**, enable SSH, note the SSH
command shown (e.g. `ssh u717356599@157.173.x.x -p 65002`) and connect:

```bash
ssh u717356599@your-server-ip -p 65002
```

Then clone the repository into the app directory that hPanel's Node.js panel
created (hPanel → Websites → Manage → **Node.js** → create app first):

```bash
cd ~/domains/kruthika.fun/nodeapp   # default Node.js app path on Hostinger
git init && git remote add origin https://github.com/<YOUR-USERNAME>/kruthika-ai.git
git fetch origin && git checkout -f main
```

> If git asks for credentials, use a GitHub **Personal Access Token**
> (github.com → Settings → Developer settings → PAT classic) as the password,
> or set up an SSH key: `ssh-keygen -t ed25519` then add the pubkey to GitHub.

### Step A3 — Configure the Node.js application

hPanel → **Websites → Manage → Node.js**:

| Setting | Value |
|---|---|
| Node.js version | **20.x or 22.x** (20.x is supported by the pinned lockfile) |
| Application root | `domains/kruthika.fun/nodeapp` |
| Application startup file | leave default |
| **Custom command** (see below) | — |

Set these **custom commands** in the panel (or run them via SSH):

```bash
# Install command (keep dev dependencies because Next.js compiles TypeScript during build):
npm ci --include=dev

# Start command (production):
npm run start
```

`npm run start` runs `next start -p 5000 -H 0.0.0.0` — hPanel proxies your
domain to this port automatically.

### Step A4 — Environment variables

Create the production env file on the server (NEVER upload your dev `.env`):

```bash
nano ~/domains/kruthika.fun/nodeapp/.env
```

Paste production values following `.env.example` exactly. The MUST-HAVE list
is in **§6** of this file. Save (`Ctrl+O`, Enter, `Ctrl+X`).

### Step A5 — Build & start

```bash
cd ~/domains/kruthika.fun/nodeapp
source ~/.bashrc                       # ensure node/npm in PATH
npm run build                          # ~2–3 min on Business plan
```

Back in hPanel → Node.js → click **Restart** (or run `npm run start` under
screen/pm2 if you manage the process yourself). Visit
`https://kruthika.fun/api/health` — you should get
`{"status":"ok", ...}`.

### Step A6 — Future updates with this method

```bash
ssh …                                    # connect
cd ~/domains/kruthika.fun/nodeapp
git fetch origin && git reset --hard origin/main   # match GitHub exactly
npm ci                                   # only if package.json changed
npm run build                            # only if source changed
```

Then **Restart** the Node.js app in hPanel. Done — see §10 for details.

---

## 3. METHOD B — GITHUB ACTIONS CI/CD (OPTIONAL)

The repository includes `.github/workflows/hostinger-build.yml`, which runs the
same install, typecheck, test, lint, and production-build checks used before a
Hostinger release. It does **not** deploy automatically; Hostinger's GitHub
import remains the deployment mechanism unless you configure your own SSH
deployment workflow and secrets.

If you later add an SSH deployment workflow, deploy into
`~/domains/kruthika.fun/nodeapp` (NOT `public_html`).

> ### ⚠️ WHY NOT `public_html` / FTP?
> Kruthika AI is a Next.js **server** application (`/api/chat`, `/api/cron/*`,
> SSR). It needs a running Node process — static files dropped into
> `public_html` cannot execute it. Additionally, your FTP user
> `u717356599.chatBot` is chrooted inside `public_html` and physically cannot
> reach any sibling `nodeapp` folder. Keep those FTP creds for FileZilla
> emergencies; deployment itself uses SSH.

### Step B1 — Generate a deploy key pair (local machine)

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
# creates:  deploy_key      (PRIVATE — goes into GitHub Secrets)
#           deploy_key.pub  (PUBLIC  — goes onto the server)
```

### Step B2 — Authorize the key on the server (one-time)

hPanel → **Websites → Manage → SSH access** → note the port (usually `65002`)
and connect once manually, then:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<contents of deploy_key.pub>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Test from local: `ssh -i deploy_key -p 65002 u717356599@145.79.213.77` — must
log in WITHOUT asking a password.

### Step B3 — Add GitHub Secrets

Repo **github.com/gautham007gs/maya → Settings → Secrets and variables →
Actions → New repository secret**. Add EXACTLY these four:

| Secret name | Value | Where it comes from |
|---|---|---|
| `SSH_HOST` | `145.79.213.77` | Your Hostinger panel (FTP IP) |
| `SSH_PORT` | `65002` | hPanel → SSH access page (verify yours!) |
| `SSH_USERNAME` | `u717356599` | Main account username |
| `SSH_PRIVATE_KEY` | full contents of `deploy_key` file | Step B1 — include the `-----BEGIN/END-----` lines |

(FTP credentials are NOT used by this pipeline.)

### Step B4 — One-time server preparation (SSH)
>
> 🖥️ **All commands in Steps B1–B4 run on the HOSTINGER SERVER** (via SSH).
> Git commands (`git add/commit/push`) are the opposite — they ALWAYS run on
> your LOCAL PC. The server never touches git; GitHub Actions delivers the
> code to it automatically.

**4a. Get Node/npm onto the SSH PATH** (Hostinger doesn't add it by default):

```bash
# Check what exists first:
which node; ls -d /opt/alt/alt-nodejs*/root/bin 2>/dev/null

# If /opt/alt/alt-nodejsXX appeared → use Hostinger's Node:
echo 'export PATH=/opt/alt/alt-nodejs20/root/bin:$PATH' >> ~/.bashrc

# Otherwise → install user-space Node 20 LTS (no root needed):
cd ~
curl -fsSL https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.xz -o node.tar.xz
mkdir -p ~/.local/node
tar -xJf node.tar.xz -C ~/.local/node --strip-components=1
rm node.tar.xz
echo 'export PATH=$HOME/.local/node/bin:$PATH' >> ~/.bashrc

source ~/.bashrc
node -v && npm -v      # must print versions before continuing!
```

**4b. App folder, env file, pm2:**

```bash
mkdir -p ~/domains/kruthika.fun/nodeapp
cd ~/domains/kruthika.fun/nodeapp
nano .env              # paste PRODUCTION values from DEPLOY_ULTIMATE §6 — save
npm config set prefix ~/.local
npm install -g pm2 --prefix ~/.local
export PATH="$HOME/.local/bin:$PATH"
pm2 -v                 # verify pm2 works
```

> The deploy workflow exports BOTH `$HOME/.local/node/bin` and
> `/opt/alt/alt-nodejs20/root/bin` itself, so GitHub Actions deploys work
> regardless of which path you chose here.

Run the DB migrations via phpMyAdmin now if you haven't (guide §7).

### Step B5 — Deploy! (💻 run on your LOCAL PC)

```bash
git add .github/workflows/hostinger-build.yml
git commit -m "ci: add Hostinger build check"
git push origin main
```

Watch it live in the repository's **Actions** tab. After the build check passes,
Hostinger's connected GitHub app can build and redeploy the selected branch.
If you use the manual SSH method instead, run the server preparation and restart
steps in Method A.

With Hostinger GitHub import enabled, every push to the selected branch triggers
Hostinger's own rebuild/redeploy flow.

### Useful commands (server)

```bash
export PATH="$HOME/.local/bin:$PATH"
pm2 logs kruthika --lines 50     # app logs
pm2 restart kruthika              # manual restart
pm2 status                        # uptime/CPU/memory
curl -s http://127.0.0.1:5000/api/health
```

---

## 4. METHOD C — MANUAL UPLOAD (FILE MANAGER / FTP)

No Git at all. Good for a one-time launch or emergency fix.

### Step C1 — Build locally

```bash
npm ci
# Create a production .env locally first (see §6), then:
npm run build
```

### Step C2 — Upload these items to `domains/kruthika.fun/nodeapp/`

Via hPanel **File Manager** (zip + upload + extract) or an FTP client
(FileZilla):

| Item | Why |
|---|---|
| `.next/` | the production build |
| `public/` | static assets |
| `package.json` + `package-lock.json` | dependency install |
| `next.config.js`, `tailwind.config.ts`, `postcss.config.mjs` | build/runtime config |
| `src/` | required by Next.js runtime for App Router manifests |
| `scripts/` | backup-db / restore-db utilities |
| `database/` | SQL migrations (run once, §7) |

**Do NOT upload:** `node_modules/` (install fresh on server — native modules
like `sharp` must match the server's OS), `.env*`, `.git*`, `backups/`.

### Step C3 — On the server (SSH)

```bash
cd ~/domains/kruthika.fun/nodeapp
nano .env                 # paste production values (§6)
npm ci                    # installs exactly per lockfile
npm run build             # optional if you uploaded .next from the same OS/arch — safe to always run
```

Start/restart via hPanel → Node.js → Restart.

---

## 5. WHAT TO PUSH & IGNORE (.gitignore)

The repo already ships a correct `.gitignore`. Summary of what it protects:

| Ignored | Reason |
|---|---|
| `.env`, `.env.local`, `.env.*.local` | real secrets — NEVER in git |
| `/node_modules/` | reinstalled from lockfile |
| `/.next/`, `/out/`, `*.tsbuildinfo` | build artifacts |
| `/.cms-media/` | runtime media uploads |
| `*.log`, `npm-debug.log*` | runtime noise |
| `*.pfx`, `*.p12`, `/certs/` | TLS keys/certs |
| OS/editor cruft (`.DS_Store`, `.idea/`, `.vscode/*`) | local-only settings |

**Must be committed:** all of `src/`, `public/`, `database/`, `docs/`,
`scripts/`, config files, `package-lock.json`, and `.env.example`.

**Recommended additions before first push** (one-time):

```bash
# keep DB backups out of git
echo "/backups/" >> .gitignore
# keep local helper scripts out (if any)
echo "*.local.ps1" >> .gitignore
git add .gitignore && git commit -m "chore: ignore backups dir"
```

---

## 6. ENVIRONMENT VARIABLES — PRODUCTION CHECKLIST

Full reference with per-field comments: **`.env.example`**. This is the
minimum-viable PRODUCTION set — copy into the server's `.env`:

### 🔴 REQUIRED (app will not work correctly without these)

```ini
# Site
NEXT_PUBLIC_BASE_URL=https://kruthika.fun
NEXT_PUBLIC_SITE_URL=https://kruthika.fun

# MySQL (hPanel → Databases → MySQL)
MYSQL_HOST=<from hPanel>
MYSQL_PORT=3306
MYSQL_USER=<from hPanel>
MYSQL_PASSWORD=<from hPanel>
MYSQL_DATABASE=<from hPanel>
MYSQL_CONNECTION_LIMIT=10

# Admin panel login (/admin)
ADMIN_EMAIL=you@kruthika.fun
ADMIN_PASSWORD_HASH=<generate — command in .env.example §3>
ADMIN_PASSWORD_SALT=<generate>
ADMIN_SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
ADMIN_ROLE=super_admin

# Security secrets (each: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
COOKIE_SECRET=<32+ random chars>
REQUEST_SIGNATURE_SECRET=<32+ random chars>
MASTER_ENCRYPTION_KEY=<32+ random chars>

# Cron scheduler token (powers ALL /api/cron/* jobs)
CRON_SECRET=<32+ random chars>
```

> ⚠️ Do **NOT** set `DEV_ONLY` in production (leave unset or `false`).
> ⚠️ `NEXT_PUBLIC_BASE_URL` decides your canonical host — apex vs www matters!

### 🟡 STRONGLY RECOMMENDED (core features)

```ini
# At least ONE AI provider key (or add keys later via Admin Panel → AI Keys):
OPENROUTER_API_KEY=...        # flagship provider
GEMINI_API_KEY=...            # strong multilingual fallback

# Push notifications (proactive + re-engagement cron messages):
NEXT_PUBLIC_ONESIGNAL_APP_ID=...
ONESIGNAL_REST_API_KEY=

# Media disk-cache location OUTSIDE the app folder (files are DB-backed anyway):
CMS_MEDIA_ROOT=/home/<hosting-user>/cms-media
CMS_MEDIA_PUBLIC_PATH=/uploads

# Voice replies (optional but user-loved):
ELEVENLABS_API_KEY_1=...
SARVAM_API_KEY_1=...

# Analytics/ads:
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
ADSTERRA_API_KEY=...
```

### 🟢 OPTIONAL (fine to skip)

```ini
UPSTASH_REDIS_REST_URL=...          # cache; falls back to memory
UPSTASH_REDIS_REST_TOKEN=...
GOOGLE_SITE_VERIFICATION=...        # Search Console
BING_SITE_VERIFICATION=...
PINTEREST_VERIFICATION=...
QUOTA_TIMEZONE=Asia/Kolkata         # default IST
BACKUP_DIR=/home/<hosting-user>/backups
BACKUP_RETENTION_DAYS=14
ANALYTICS_RETENTION_DAYS=90
```

After writing `.env`, sanity-check it on the server:

```bash
cd ~/domains/kruthika.fun/nodeapp
grep -c '=' .env                    # should list ~40+ entries
grep -c 'change_me' .env            # MUST print 0 — no placeholder secrets left!
```

---

## 7. DATABASE SETUP & MIGRATIONS

### 7.1 — Which files, in which order

All 14 SQL files live in `/database`. Run them **in numeric order** — every
file is idempotent (safe to re-run, never destroys data):

| Order | File | Creates |
|---|---|---|
| 1 | `01_core_schema.sql` | Core app tables (config, analytics, sessions, API keys) + seed data |
| 2 | `02_blog_schema.sql` | Blog categories + posts (full lifecycle status) |
| 3 | `03_voice_schema.sql` | Sarvam key pool + pending voice messages |
| 4 | `04_migrations.sql` | Patches: indexes, cron idempotency table |
| 5 | `05_audit_remediation.sql` | Voice-retry columns, quota tables, admin sessions |
| 6 | `06_cms_foundation_migration.sql` | CMS foundation columns |
| 7 | `07_cms_publishing_upgrade.sql` | Post revisions + media assets |
| 8 | `08_cms_publication_structure.sql` | Authors, post-authors, redirects |
| 9 | `09_cms_publishing_lifecycle.sql` | Full publishing status workflow |
| 10 | `10_taxonomy_management.sql` | Tags + author/category management |
| 11 | `11_media_seo_upgrade.sql` | Media/SEO columns (OG, Twitter, scores) |
| 12 | `12_media_folders.sql` | Media folder registry |
| 13 | `13_media_blobs.sql` | DB-backed media storage *(optional — app self-creates)* |
| — | `99_access_grants.sql` | ONLY if you get "Access Denied" |

### 7.2 — How to run via phpMyAdmin (Hostinger), step by step

1. hPanel → **Databases → MySQL** → note your DB name → click **Enter phpMyAdmin**.
2. Select your database in the **left sidebar** (click its name — important:
   statements like `DATABASE()` resolve against the selected DB).
3. Open the **SQL** tab (or **Import** tab — both work).
4. For each file in order (01 → 13):
   - **Option A (Import):** Import tab → *Choose file* → pick e.g.
     `01_core_schema.sql` → format SQL → **Go**. Repeat for each file.
   - **Option B (paste):** open the `.sql` file in a text editor → copy ALL →
     paste into the SQL tab → **Go**.
5. After each file you should see a green success banner. Move to the next.

> 💡 Every file is **idempotent**: if you lose track of which ones you already
> ran, just run all 13 again from the top — nothing breaks, no data is lost.

### 7.3 — If it ALREADY EXISTS / shows errors — error playbook

| Error message | Meaning | Action |
|---|---|---|
| `<table> already exists` | Table created before (by a previous run or app self-healing) | Harmless — files use `CREATE TABLE IF NOT EXISTS`; if you see it anyway it came from an old-style statement → safe to ignore and continue |
| `Duplicate column name '…'` on ALTER | Column added previously | Safe to skip that one statement — but our files use `IF NOT EXISTS`, so this shouldn't appear; if it does, you're running an outdated file — re-pull latest |
| `#1064 … near 'DELIMITER'` | You pasted a file containing `DELIMITER` | Fixed in this repo — re-download latest SQL files; none contain DELIMITER anymore |
| `#1071 Specified key was too long` | Old index-length bug (`VARCHAR(1000) UNIQUE`) | Fixed — `storage_path` is now `VARCHAR(500)`; drop the half-created table (`DROP TABLE cms_media_assets;`) and re-run file 07 |
| `#1215 Cannot add foreign key constraint` | Referenced table doesn't exist yet = files ran out of order | Run files strictly 01→13; check both tables use identical ENGINE=InnoDB + CHARSET |
| `#1146 Table … doesn't exist` during a later file | An earlier file failed silently | Re-run from file 01; watch for the first red banner |
| `Access denied for user …` | DB user lacks privileges | hPanel → Databases → Remote MySQL → whitelist IP; if still failing, adapt & run `99_access_grants.sql` (read its header first) |
| Import times out / page freezes (phpMyAdmin) | Large file on slow plan | Use Option A (Import tab) not pasting; these files are small (<25 KB each) so timeouts are unlikely |
| `Unknown collation: 'utf8mb4_unicode_ci'` | Very old MariaDB | Hostinger's current servers all support it — contact support if seen |

### 7.4 — Verify everything landed

In phpMyAdmin SQL tab:

```sql
SHOW TABLES;
-- Expect ≥ 30 tables including:
--   app_configurations, api_keys, api_key_logs,
--   blog_posts, blog_categories, blog_authors, blog_tags,
--   blog_post_revisions, blog_slug_redirects, cms_media_assets,
--   media_folders, media_blobs, cron_job_runs, chat_quota,
--   pending_voice_messages, sarvam_api_keys, kruthika_user_memory

SELECT COUNT(*) AS config_rows FROM app_configurations;   -- > 0 (seeded)
SELECT COUNT(*) AS categories FROM blog_categories;       -- 10 seeded
```

Then restart the Node.js app so connection caches reset — done.

---

## 8. CRON JOBS — EXACT SETUP, STEP BY STEP

All jobs are authenticated HTTP calls fired by the Hostinger scheduler.
Every endpoint requires header `Authorization: Bearer <CRON_SECRET>` and has a
DB idempotency lock (`cron_job_runs`) so double-fires are skipped safely.

### Step 8.1 — Where

hPanel → **Websites → Manage → Advanced → Cron Jobs** → *Add Cron Job* →
type **Custom**.

### Step 8.2 — Create these entries (⚠️ Hostinger cron = UTC time)

Replace `YOUR_CRON_SECRET` with your real §6 secret in every command.

| # | Min | Hour (UTC) | IST | Job |
|---|---|---|---|---|
| 1 | 30 | 2 | 08:00 | reengagement morning |
| 2 | 30 | 2 | 08:00 | proactive morning |
| 3 | 30 | 7 | 13:00 | reengagement afternoon |
| 4 | 30 | 13 | 19:00 | reengagement evening |
| 5 | 30 | 13 | 19:00 | proactive evening |
| 6 | 30 | 16 | 22:00 | reengagement night |
| 7 | 0 | * | hourly | SEO publisher |

Commands (one per cron entry):

```bash
curl -s -X POST https://kruthika.fun/api/cron/reengagement -H "Authorization: Bearer YOUR_CRON_SECRET"
curl -s -X POST https://kruthika.fun/api/cron/proactive    -H "Authorization: Bearer YOUR_CRON_SECRET"
```
(Combine with the minute/hour columns above; jobs 1&2 share the same schedule,
as do 4&5.)

Plus one daily cleanup entry (03:00 IST):

```bash
30 21 * * * curl -s -X POST https://kruthika.fun/api/cron/cleanup -H "Authorization: Bearer YOUR_CRON_SECRET"
```

And optionally an automated nightly DB backup via the bundled script:

```bash
30 21 * * * cd ~/domains/kruthika.fun/nodeapp && node scripts/backup-db.mjs >> backups/backup.log 2>&1
```

### Step 8.3 — Test each job manually BEFORE relying on the schedule

```bash
curl -i -X POST https://kruthika.fun/api/cron/reengagement \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- `200 {"success":…}` → ran ✅
- `200 {"skipped":true,…}` → already ran inside its window (idempotency lock) ✅
- `401` → CRON_SECRET mismatch between curl and `.env` ❌
- Safe dry-run preview (GET, sends nothing):
  `https://kruthika.fun/api/cron/reengagement` returns all waves/segments.

Verify runs log correctly:

```sql
SELECT job_key, started_at, status FROM cron_job_runs ORDER BY started_at DESC LIMIT 10;
```

---

## 9. CUSTOMIZING CRON NOTIFICATION MESSAGES

Everything is editable in your code — changes go live on the next deploy.

### 9.1 — Re-engagement pushes (static templates)

**File:** `src/app/api/cron/reengagement/route.ts`
**Constant:** `WAVE_MESSAGES` (~line 109) — a map of
`wave → segment → { title, body }`:

```ts
const WAVE_MESSAGES: Record<Wave, Record<string, WaveMessage>> = {
  morning:  { warm: {…}, cooling: {…}, dormant: {…}, at_risk: {…}, lost: {…} },
  afternoon:{ … }, evening: { … }, night: { … },
};
```

- **Waves** = time buckets (`morning/afternoon/evening/night`) chosen
  automatically from IST when each cron fires.
- **Segments** = inactivity buckets from OneSignal `last_session`:
  `warm` (<3d) · `cooling` (3–7d) · `dormant` (7–21d) · `at_risk` (21–45d) ·
  `lost` (>45d).
- Edit any title/body freely → commit → deploy. Copy guidelines are inline in
  the file (honest companion framing, no fabricated feelings or fake urgency).

### 9.2 — Proactive AI messages (LLM-generated + fallbacks)

**File:** `src/ai/flows/proactive-messaging-actions.ts`

- Primary path: an LLM generates a personalized message per user.
- If the LLM fails or returns empty,
  `getFallbackProactiveMessages(timeOfDay, lastMessageTime)` picks a random
  hand-written fallback — edit that array to control the "backup voice".

### 9.3 — Other things you can tune

| What | Where |
|---|---|
| Inactivity thresholds per segment | segment logic in `reengagement/route.ts` |
| Wave time buckets | `currentISTWave()` in `reengagement/route.ts` |
| Cron schedule times | §8 table + hPanel entries |
| Notification icon/image | env `ONESIGNAL_DEFAULT_ICON_URL/_IMAGE_URL` |
| Click-through target | env `NEXT_PUBLIC_SITE_URL` (+ optional per-send override) |
| Enable/disable providers & voice | Admin → AI Models / Voice toggles |

Preview without sending anything:

```
GET https://kruthika.fun/api/cron/reengagement
→ returns every wave × segment message currently configured (safe dry-run)
```

---

## 10. UPDATING THE SITE AFTER LAUNCH

### Standard update (Method A flow)

```bash
# local: make changes → commit → push
git add . && git commit -m "…" && git push origin main

# server:
ssh …
cd ~/domains/kruthika.fun/nodeapp
git fetch origin && git reset --hard origin/main
npm ci                    # ONLY if package.json/package-lock.json changed
npm run build             # ONLY if source changed (always safe to run)
```

Then **Restart** in hPanel → Node.js. Downtime ≈ the restart seconds.

### Update matrix — what needs which step

| You changed… | Server steps |
|---|---|
| Only docs/comments | nothing |
| Pages/components/CSS/API/libs | `git pull` + `npm run build` + Restart |
| `package.json` deps | `git pull` + `npm ci` + `npm run build` + Restart |
| Env variables | edit `.env` + Restart only |
| New DB schema migration | run SQL file, then Restart |

### Safety rails

- Tag before risky releases: `git tag pre-launch && git push --tags` — roll
  back with `git reset --hard pre-launch && npm ci && npm run build`.
- Media/uploads survive redeploys automatically (stored in `media_blobs`).
- Blog pages revalidate themselves via ISR after restart.

---

## 11. TROUBLESHOOTING — EVERY COMMON ERROR & FIX

| Symptom / error | Cause | Fix |
|---|---|---|
| 502/503 after deploy | app crashed on boot or wrong port | Check hPanel Node.js logs; start command must be `npm run start` (port 5000) |
| Build killed/frozen mid-build on server | Business-plan memory cap during `next build` | Build locally and upload `.next/` (Method C), or use Method B (GitHub builds it) |
| `connect ETIMEDOUT` to MySQL | remote DB network blip / wrong host | Verify MYSQL_HOST exactly from hPanel; retry (code auto-retries once); check remote-access setting if building off-server |
| `#1064 … near 'CAST(… AS JSON)'` (e.g. in `04_migrations.sql`) | `CAST(x AS JSON)` is MySQL-only syntax; MariaDB rejects it | Already fixed — file 04 now uses portable `JSON_EXTRACT('true','$')`. Re-download latest SQL files and re-run file 04 from the top (it's idempotent) |
| Old uploaded images show fallback art | legacy uploads whose disk files were wiped pre-media_blobs | Re-upload via Admin → Media (new ones persist in MySQL forever) |
| `/uploads/...` audio/video returns 404 | deleted from DB+disk | Expected — re-upload; images get a fallback graphic instead |
| Cron endpoint 401 Unauthorized | CRON_SECRET mismatch | Compare curl header vs `.env` value exactly (no spaces/newlines) |
| Cron always `{"skipped":true}` | idempotency lock — ran this window | Normal ✅ verify timestamps in `cron_job_runs` |
| Push sends but has no link | `NEXT_PUBLIC_SITE_URL` missing | Set in `.env`, Restart |
| Admin login loops/401 | SESSION_SECRET rotated or HASH/SALT mismatched | Re-login fresh; regenerate HASH+SALT as a pair |
| Saved provider keys fail to decrypt | MASTER_ENCRYPTION_KEY changed after saving | Restore original key OR re-save all keys in Admin → AI Keys |
| `Cannot find module 'sharp'` | node_modules copied from Windows | Run `npm ci` on the server — never upload node_modules across OSes |
| Site loads unstyled CSS | partial `.next/` upload (Method C) | Upload full `.next/` or rebuild on server |
| Chat says "All AI providers unavailable" | every key exhausted/invalid/disabled | Admin → AI Keys: review statuses & errors; see `/admin/ai-health` |
| Quotas/waves off by hours | cron=UTC vs waves=IST confusion | Use §8 UTC times; never shift twice |
| Google indexing dev environment | `BLOCK_INDEXING=true` left on | Set false/unset + redeploy + request re-indexing |
| `next: command not found` over SSH | PATH missing npm global bin | `source ~/.bashrc`; or use `npx next start -p 5000 -H 0.0.0.0` |

### Where to look when debugging

- App logs: hPanel Node.js log viewer (or your supervisor's `.log` files).
- Cron outcomes: MySQL table `cron_job_runs`.
- Provider key failures: `api_key_logs` + `api_keys.last_error` /
  Admin → ai-health page.

---

## 12. POST-DEPLOY VERIFICATION CHECKLIST

Run top-to-bottom after first deploy:

```bash
curl -s https://kruthika.fun/api/health            # {"status":"ok",…}
curl -s https://kruthika.fun/blog | grep -i title  # server-rendered <title>
curl -sI https://kruthika.fun/sitemap.xml          # HTTP 200
curl -s https://kruthika.fun/robots.txt            # sitemap listed, crawl allowed
```

Manual walkthrough:
1. `/admin` login works · AI Keys lists providers · Analytics renders.
2. Admin → Media: upload a test image → open its URL → serves `image/webp`.
3. `/maya-chat`: send a message → reply arrives; server logs show
   `[AI][pre-request] <provider>/<model>` matching your rank #1 choice.
4. Cron: fire one real POST per job → rows appear in `cron_job_runs`.
5. SEO: view-source home page — single `<h1>`, canonical = your host,
   Article/Breadcrumb JSON-LD present, hreflang alternates present.
6. Search Console: submit `https://kruthika.fun/sitemap.xml`.

Launch-day extras:
- Set `BLOCK_INDEXING` off / remove `DEV_ONLY`.
- Baseline backup: `node scripts/backup-db.mjs`.
- Bookmark `/admin/ai-health` for daily health monitoring.

---

*Companion docs: `ARCHITECTURE.md` · `docs/AI_SYSTEM.md` · `docs/CRON.md` ·
`docs/BACKUP_RESTORE.md` · `docs/SECURITY.md`*

