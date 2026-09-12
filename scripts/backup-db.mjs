#!/usr/bin/env node
/**
 * Kruthika AI — MySQL database backup script.
 *
 * Creates a consistent logical backup via `mysqldump`, gzip-compresses it into
 * the BACKUP_DIR with a dated filename, prunes old backups beyond
 * BACKUP_RETENTION_DAYS, and (optionally) copies the newest backup off-server
 * using BACKUP_OFFSITE_CMD (e.g. an rclone/scp command template).
 *
 * USAGE:
 *   node scripts/backup-db.mjs [--dir=/path] [--days=14] [--label=morning]
 *
 * ENV (reads .env.local first, then .env, then process env):
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *   BACKUP_DIR          (default: ./backups)
 *   BACKUP_RETENTION_DAYS (default: 14)
 *   BACKUP_OFFSITE_CMD  (optional, e.g. "rclone copy {file} remote:kruthika-backups")
 *                       {file} is replaced with the full backup path.
 *
 * SCHEDULING (Hostinger cron): run daily.
 *   Minute Hour Day Month Weekday
 *   10     22    *   *     *      ← 22:10 UTC = 03:40 IST
 *
 * The script exits non-zero on failure so Hostinger can email you about it.
 */

import fs from 'fs';
import path from 'path';

// ── Load .env.local / .env (tiny parser, no dotenv dependency) ─────────────
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) out[key] = value;
  }
  return out;
}

function env(name, fallback) {
  return process.env[name] ?? fallback ?? '';
}

function parseArgs(argv) {
  const opts = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);

  const cwd = process.cwd();
  const fileEnv = {
    ...loadEnvFile(path.join(cwd, '.env.local')),
    ...loadEnvFile(path.join(cwd, '.env')),
  };
  process.env = { ...fileEnv, ...process.env };

  const host = env('MYSQL_HOST');
  const user = env('MYSQL_USER');
  const password = env('MYSQL_PASSWORD');
  const database = env('MYSQL_DATABASE');
  const port = env('MYSQL_PORT', '3306');

  if (!host || !user || !database) {
    console.error('[Backup] Missing MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE. Aborting.');
    process.exit(1);
  }

  const backupDir = opts.dir || env('BACKUP_DIR', path.join(cwd, 'backups'));
  const retentionDays = parseInt(opts.days || env('BACKUP_RETENTION_DAYS', '14'), 10);
  const label = opts.label || 'daily';

  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19); // 2026-08-11-10-30-00
  const backupFile = path.join(backupDir, `kruthika-${label}-${stamp}.sql.gz`);

  console.log(`[Backup] Dumping ${database}@${host}:${port} → ${backupFile}`);

  const dumpArgs = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    `--password=${password}`,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    '--no-tablespaces',
    database,
  ];

  // Run mysqldump with a gzip child pipeline, streaming directly to disk.
  const { spawn } = await import('child_process');
  await new Promise((resolve, reject) => {
    const dumper = spawn('mysqldump', dumpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const gzipper = spawn('gzip', ['-9'], { stdio: ['pipe', 'fs', 'pipe'] });
    const out = fs.createWriteStream(backupFile);

    dumper.stdout.pipe(gzipper.stdin);
    gzipper.stdout.pipe(out);
    gzipper.stderr.on('data', d => { if (d) gzipper._err = (gzipper._err || '') + d.toString(); });
    dumper.stderr.on('data', d => { if (d) dumper._err = (dumper._err || '') + d.toString(); });

    out.on('error', reject);
    out.on('finish', () => {
      if (dumper._err) {
        fs.unlinkSync(backupFile);
        reject(new Error(`mysqldump stderr: ${dumper._err.slice(0, 2000)}`));
      } else {
        resolve();
      }
    });
    gzipper.on('error', reject);
    dumper.on('error', reject);
  });

  const sizeMb = (fs.statSync(backupFile).size / 1024 / 1024).toFixed(2);
  console.log(`[Backup] OK — ${backupFile} (${sizeMb} MB)`);

  // ── 2. Prune old backups (keep newest retentionDays) ─────────────────────
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('kruthika-') && f.endsWith('.sql.gz'))
    .map(f => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  const toPrune = files.slice(retentionDays);
  for (const { f } of toPrune) {
    fs.unlinkSync(path.join(backupDir, f));
    console.log(`[Backup] Pruned old backup: ${f}`);
  }
  console.log(`[Backup] Retention: keeping ${Math.min(files.length, retentionDays)}/${files.length} backups (${retentionDays} days).`);

  // ── 3. Optional off-server copy ──────────────────────────────────────────
  const offsiteCmd = env('BACKUP_OFFSITE_CMD');
  if (offsiteCmd) {
    const cmd = offsiteCmd.replace(/\{file\}/g, backupFile);
    console.log(`[Backup] Off-site copy: ${cmd}`);
    try {
      const { execSync } = await import('child_process');
      execSync(cmd, { stdio: 'inherit', timeout: 300_000 });
      console.log('[Backup] Off-site copy OK.');
    } catch (err) {
      console.error('[Backup] Off-site copy FAILED:', err?.message);
      process.exit(3);
    }
  } else {
    console.log('[Backup] No BACKUP_OFFSITE_CMD set — skipping off-site copy.');
  }

  console.log('[Backup] Done.');
}

main().catch(err => {
  console.error('[Backup] ERROR:', err?.message || err);
  process.exit(2);
});
