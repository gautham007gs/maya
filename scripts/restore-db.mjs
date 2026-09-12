#!/usr/bin/env node
/**
 * Kruthika AI — MySQL database restore script.
 *
 * Restores a `.sql.gz` backup (as produced by scripts/backup-db.mjs) into the
 * configured database. Requires a non-interactive password on the CLI or an
 * empty DB you intend to overwrite — this script DROPS nothing; it just pipes
 * the SQL into `mysql`. To restore onto a fresh database, create it first.
 *
 * USAGE:
 *   node scripts/restore-db.mjs ./backups/kruthika-daily-2026-08-11-10-30-00.sql.gz
 *   node scripts/restore-db.mjs --host=... --port=3306 --user=... --password=... --database=... ./file.sql.gz
 *
 * ENV (falls back to .env.local / .env): MYSQL_HOST, MYSQL_PORT, MYSQL_USER,
 * MYSQL_PASSWORD, MYSQL_DATABASE.
 *
 * WARNING: this overwrites the target database's tables with the backup's
 * contents. Run the restore test (docs/BACKUP_RESTORE.md) against a scratch DB
 * before ever pointing it at production.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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

function parseArgs(argv) {
  const opts = { _: [] };
  for (const a of argv.slice(2)) {
    const eq = a.match(/^--([^=]+)=(.*)$/);
    if (eq) opts[eq[1]] = eq[2];
    else if (a.startsWith('--')) opts[a.slice(2)] = true;
    else opts._.push(a);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  const backupFile = opts._[0];
  if (!backupFile || !fs.existsSync(backupFile)) {
    console.error('[Restore] Usage: node scripts/restore-db.mjs <backup.sql.gz>');
    process.exit(1);
  }
  if (!backupFile.endsWith('.gz')) {
    console.error('[Restore] Expected a .gz backup (produced by backup-db.mjs).');
    process.exit(1);
  }

  const cwd = process.cwd();
  const fileEnv = {
    ...loadEnvFile(path.join(cwd, '.env.local')),
    ...loadEnvFile(path.join(cwd, '.env')),
  };
  process.env = { ...fileEnv, ...process.env };

  const host = opts.host || process.env.MYSQL_HOST;
  const port = opts.port || process.env.MYSQL_PORT || '3306';
  const user = opts.user || process.env.MYSQL_USER;
  const password = opts.password || process.env.MYSQL_PASSWORD || '';
  const database = opts.database || process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    console.error('[Restore] Missing MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE.');
    process.exit(1);
  }

  console.log(`[Restore] Restoring ${backupFile} → ${database}@${host}:${port}`);

  const gunzip = spawn('gunzip', ['-c', backupFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  const mysql = spawn('mysql', [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    `--password=${password}`,
    '--default-character-set=utf8mb4',
    database,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });

  gunzip.stdout.pipe(mysql.stdin);
  gunzip.stderr.on('data', d => { if (d) console.error('[Restore] gunzip:', d.toString()); });
  mysql.stderr.on('data', d => { if (d) console.error('[Restore] mysql:', d.toString()); });

  const exitCode = await new Promise(resolve => {
    gunzip.on('error', () => resolve(2));
    mysql.on('exit', code => resolve(code ?? 1));
  });

  if (exitCode === 0) {
    console.log('[Restore] OK.');
  } else {
    console.error(`[Restore] FAILED (exit ${exitCode}).`);
    process.exit(exitCode);
  }
}

main().catch(err => {
  console.error('[Restore] ERROR:', err?.message || err);
  process.exit(2);
});
