# Deployment Guide — Kruthika AI

> **Last updated:** 2026-08-24  
> **Next re-scan trigger:** update this file whenever `next.config.js`, `package.json`, or the Hostinger server setup changes.  
> **AI Agent Note:** This is the authoritative deployment guide. If `next.config.js` version or Node.js requirement changes, update the table in Step 5 and the "Quick Summary" block. Next.js 16.3.0 renamed `middleware.ts` → `proxy.ts`; the build output confirms it as `ƒ Proxy (Middleware)`.
>
> **This file covers manual/VPS-style deployment (PM2, fixed port).** For
> Hostinger's Business-plan **Node.js Web App** panel (GitHub import,
> auto-build, auto-redeploy on push), use **`DEPLOY_ULTIMATE.md` → Method 0**
> instead — that panel assigns its own port dynamically via `PORT`, which this
> repo's `npm run start` already honors (`next start -p ${PORT:-5000} ...`).

---

## Quick Summary

| Property | Value |
|---|---|
| Framework | Next.js **16.3.0** (App Router, Turbopack) |
| Runtime | Node.js **20.9+** (pinned via `package.json` → `engines.node`; 22.x also works, do not use 18.x) |
| Build command | `npm run build` (≈ 2.5 min, 98 routes) |
| Start command | `npx next start -p ${PORT:-5000} -H 0.0.0.0` (binds to Hostinger's assigned `PORT` when present, falls back to 5000 for manual/VPS use) |
| Default port | **5000** when `PORT` is unset (e.g. manual PM2/VPS runs); Hostinger's Node.js Web App panel injects its own `PORT` |
| Database | MySQL 8.x (Hostinger shared or VPS) |

---

## Prerequisites

- Hostinger **Business Web Hosting** or higher (Node.js support required)
- Node.js 20.x LTS installed on the server
- MySQL database created in hPanel → Databases
- All environment variables ready (see `LOCAL_SETUP.md` or `.env.example`)

---

## Step 1 — Build locally

```bash
# Install dependencies
npm install

# Build production bundle (creates .next/ folder)
npm run build
```

Build takes 1–3 minutes. You must see `✓ Compiled successfully` at the end.

---

## Step 2 — Upload to Hostinger

**Option A — FTP (recommended for first upload)**  
Use FileZilla or any FTP client:
- Host: `ftp.kruthika.fun` (or your domain)
- Credentials: hPanel → FTP Accounts

Upload these files/folders:
```
.next/          ← compiled app bundle (always required)
public/         ← icons, manifest.json, sw.js, OG images
src/            ← source files (required for server functions)
package.json    ← dependency manifest
next.config.js  ← Next.js configuration
database/       ← SQL setup files (run once; not needed at runtime)
```

> **Tip:** Skip `node_modules/` — run `npm install --production` on the server instead (much faster than uploading 200 MB).

**Option B — Git (best for ongoing updates)**

```bash
# On Hostinger SSH
cd ~/domains/kruthika.fun/public_html
git pull origin main
npm install --production
npm run build
pm2 restart kruthika
```

---

## Step 3 — Set environment variables on Hostinger

In **hPanel → Node.js → Environment Variables**, add all variables from `.env.example`.

Minimum required set:

```bash
# Database
MYSQL_HOST=srv2204.hstgr.io
MYSQL_PORT=3306
MYSQL_USER=u717356599_chatbotdb
MYSQL_PASSWORD=<your db password>
MYSQL_DATABASE=u717356599_chatbotdb

# Admin panel
ADMIN_EMAIL=admin@kruthika.fun
ADMIN_PASSWORD=<strong password>
ADMIN_SESSION_SECRET=<32+ char random string>
COOKIE_SECRET=<32+ char random string>
REQUEST_SIGNATURE_SECRET=<32+ char random string>

# AI (at least one provider required)
GEMINI_API_KEY=<your key>
GROQ_API_KEY=<your key>

# Optional — Cloudflare Workers AI (provider #2 in the cascade, needs BOTH values)
# CLOUDFLARE_API_TOKEN=<your token>
# CLOUDFLARE_ACCOUNT_ID=<your account id>

# Site URL (important for SEO and cron callbacks)
# ⚠️ Set this to the EXACT canonical host you deploy on (e.g. https://www.kruthika.fun
# if you launch on www). In production the proxy 301s every other hostname to it,
# and all canonical/sitemap/hreflang/OG URLs are generated from it.
NEXT_PUBLIC_BASE_URL=https://kruthika.fun
NEXT_PUBLIC_SITE_URL=https://kruthika.fun

# Persistent CMS uploads: create this directory outside the app release folder.
# Replace <hosting-account> with the value shown in hPanel / SSH.
CMS_MEDIA_ROOT=/home/<hosting-account>/cms-media
CMS_MEDIA_PUBLIC_PATH=/uploads

# Security
NODE_ENV=production
BLOCK_INDEXING=false
```

Generate random secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4 — Set up the database

Run SQL files **in order** via phpMyAdmin (hPanel → Databases → phpMyAdmin):

```
database/01_core_schema.sql   ← core tables + seeds
database/02_blog_schema.sql   ← blog CMS tables
database/03_voice_schema.sql  ← voice message tables
database/04_migrations.sql    ← patches (safe to run on new or existing DB)
```

See `database/README.md` for full details and import instructions.

### CMS media directory (required for blog uploads)

Create the directory once via Hostinger File Manager or SSH. It must be outside
`public_html` / the Node application folder so application deployments cannot
replace it:

```bash
mkdir -p /home/<hosting-account>/cms-media
chmod 750 /home/<hosting-account>/cms-media
```

Set `CMS_MEDIA_ROOT` to that same absolute path in the Node.js environment,
then restart the app. The application serves uploaded images through
`/uploads/...`; do not point the public URL directly at a filesystem path.

---

## Step 5 — Configure Node.js app in hPanel

**hPanel → Node.js → Create Application:**

| Setting | Value |
|---|---|
| Node.js version | **20.x** (latest LTS) |
| Application mode | **Production** |
| Application root | `/home/u717356599/domains/kruthika.fun/public_html` |
| Application URL | `kruthika.fun` |
| Application startup file | `node_modules/.bin/next` |
| Startup command | `npx next start -p 5000 -H 0.0.0.0` |

---

## Step 6 — Start the app

**Via hPanel:** Node.js → Restart button

**Via SSH (recommended — use PM2 for auto-restart):**

```bash
ssh u717356599@srv2204.hstgr.io -p 65002
cd ~/domains/kruthika.fun/public_html

# Install PM2 globally (once)
npm install -g pm2

# Start the app
pm2 start "npx next start -p 5000 -H 0.0.0.0" --name "kruthika"
pm2 save
pm2 startup   # prints a command — run it to auto-start on server reboot
```

**Useful PM2 commands:**
```bash
pm2 status              # check if running
pm2 logs kruthika       # live logs
pm2 restart kruthika    # restart after a code update
pm2 stop kruthika       # stop the app
pm2 delete kruthika     # remove from PM2 list
```

---

## Step 7 — Domain & SSL

In **hPanel → Domains → DNS Zone Editor**:
```
A record:  kruthika.fun  →  <your Hostinger server IP>
CNAME:     www            →  kruthika.fun
```

Enable SSL: **hPanel → SSL → Let's Encrypt → Issue Certificate**

SSL is free and auto-renewed by Hostinger.

---

## Update workflow (future code changes)

```bash
# 1. Make and test changes locally
npm run build   # verify build passes

# 2. Upload changed files via FTP or Git pull on server

# 3. Rebuild on server (if using Git)
npm run build

# 4. Restart
pm2 restart kruthika
```

Only re-upload what changed:
- `.next/` — always (contains the compiled output)
- `src/` — only if server-side code changed
- `public/` — only if images/icons changed
- `package.json` + run `npm install --production` — only if packages changed

---

## Troubleshooting

| Error | Fix |
|---|---|
| `next: command not found` | Use `npx next start` instead of `next start` |
| `Cannot find module` | Run `npm install --production` on the server |
| `EADDRINUSE port 5000` | Run `pm2 restart kruthika` or change the port |
| `MySQL connection refused` | Verify `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER` in env vars |
| Build failed | Run `npm run build` locally first and fix errors before uploading |
| 500 error on site | Check `pm2 logs kruthika` for the actual error |
| App works but ads not showing | Check the CSP allowlist (`docs/SECURITY.md`) + `adsEnabledGlobally` toggle in Admin → Ads |
| Admin login not working | Check `ADMIN_EMAIL` / `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are set |
| DB "Access Denied" from proxy IP or remote host | Run `database/99_access_grants.sql` via phpMyAdmin |

---

## Server requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| Hostinger plan | Business Web Hosting | Cloud Hosting / VPS |
| Node.js | 20.x LTS | 20.x LTS |
| RAM | 512 MB | 1 GB |
| Storage | 500 MB | 2 GB |
| MySQL | 5.7+ | 8.0+ |
