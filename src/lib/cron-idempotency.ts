/**
 * Cron Job Idempotency — DB-backed lock / dedup for externally-triggered jobs.
 *
 * PROBLEM: Cron jobs are now fired by an external scheduler (Hostinger cron)
 * instead of node-cron inside the app. External schedulers can double-fire a
 * job (overlapping executions, retries after a timeout, multiple cron rows in
 * the panel). Without a lock, a duplicate run would send a SECOND batch of
 * push notifications to the same users.
 *
 * SOLUTION: a `cron_job_runs` table that records, per (job_name, run_key),
 * whether the job already completed. A run is either:
 *   - ACQUIRED  — we hold the lock and must run the job, then call finish().
 *   - SKIPPED   — an identical run already completed (idempotent no-op) OR a
 *                 concurrent run holds the lock and hasn't timed out.
 *
 * A 'running' lock older than `staleTimeoutMs` is reclaimed automatically so a
 * crashed job doesn't permanently block future runs. The job name + key must be
 * scoped to the wave/date so each intended run has a UNIQUE key (e.g.
 * `reengagement:morning:2026-08-10`).
 */

import { getMysqlClient } from '@/lib/mysql-client';

export type CronJobStatus = 'running' | 'done' | 'failed';

export interface CronRunResult {
  acquired: boolean;
  /** true when a completed run already exists for this key (idempotent skip). */
  alreadyDone: boolean;
  /** true when a concurrent run is still in progress (skip this invocation). */
  concurrent: boolean;
  /** true when the DB lock could not be acquired — caller should abort (503). */
  lockUnavailable: boolean;
  /** Call to mark the run complete / failed. Only valid when acquired=true. */
  finish: (status: 'done' | 'failed', result?: Record<string, any>) => Promise<void>;
}

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = getMysqlClient()
      .then(client =>
        client.query(`
          CREATE TABLE IF NOT EXISTS cron_job_runs (
            job_name     VARCHAR(64)  NOT NULL,
            run_key      VARCHAR(191) NOT NULL,
            status       ENUM('running','done','failed') NOT NULL DEFAULT 'running',
            started_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finished_at  TIMESTAMP    NULL DEFAULT NULL,
            result_json  JSON         NULL,
            PRIMARY KEY (job_name, run_key),
            KEY idx_cjr_started (started_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
      )
      .then(() => undefined)
      .catch(err => {
        // Allow table-init failure to be retried on the next acquire call.
        tableReady = null;
        throw err;
      });
  }
  await tableReady;
}

/**
 * Try to acquire the lock for (jobName, runKey). Returns metadata about the
 * outcome and (when acquired) a `finish` callback. Never throws — callers can
 * run the job without idempotency if the DB is down (fail-open, but logged).
 */
export async function acquireCronRun(
  jobName: string,
  runKey: string,
  opts: { staleTimeoutMs?: number } = {},
): Promise<CronRunResult> {
  const staleTimeoutMs = opts.staleTimeoutMs ?? 30 * 60 * 1000; // 30 min default
  const noopFinish = async () => {};

  try {
    await ensureTable();
  } catch (err: any) {
    console.error(
      `[Cron:lock] Idempotency table unavailable (${jobName}:${runKey}) — aborting (fail closed):`,
      err?.message
    );
    return { acquired: false, alreadyDone: false, concurrent: false, lockUnavailable: true, finish: noopFinish };
  }

  try {
    const db = await getMysqlClient();

    // 1) Try to insert a fresh 'running' row. PK(job_name, run_key) makes this
    //    atomic — only ONE concurrent caller can succeed.
    const [insertRes]: any = await db.query(
      `INSERT IGNORE INTO cron_job_runs (job_name, run_key, status, started_at)
       VALUES (?, ?, 'running', NOW())`,
      [jobName, runKey]
    );
    if (insertRes.affectedRows === 1) {
      return {
        acquired: true,
        alreadyDone: false,
        concurrent: false,
        lockUnavailable: false,
        finish: (status, result) => finishCronRun(jobName, runKey, status, result),
      };
    }

    // 2) Row exists. Check whether it completed or is still running.
    const [rows]: any = await db.query(
      `SELECT status, started_at FROM cron_job_runs WHERE job_name = ? AND run_key = ? LIMIT 1`,
      [jobName, runKey]
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) {
      // Race: row vanished — treat as acquired (rare).
      return {
        acquired: true,
        alreadyDone: false,
        concurrent: false,
        lockUnavailable: false,
        finish: (status, result) => finishCronRun(jobName, runKey, status, result),
      };
    }

    if (row.status === 'done' || row.status === 'failed') {
      // Already finished — idempotent skip. A failed run is NOT retried on the
      // same key; a new key (new date/wave) will be used by the caller.
      return { acquired: false, alreadyDone: true, concurrent: false, lockUnavailable: false, finish: noopFinish };
    }

    // 3) Status is 'running'. Reclaim if stale (crashed run), else skip.
    const staleSince = new Date(Date.now() - staleTimeoutMs);
    const [reclaim]: any = await db.query(
      `UPDATE cron_job_runs
       SET started_at = NOW()
       WHERE job_name = ? AND run_key = ? AND status = 'running' AND started_at < ?`,
      [jobName, runKey, staleSince]
    );
    if (reclaim.affectedRows === 1) {
      return {
        acquired: true,
        alreadyDone: false,
        concurrent: false,
        lockUnavailable: false,
        finish: (status, result) => finishCronRun(jobName, runKey, status, result),
      };
    }

    // A live concurrent run holds the lock.
    return { acquired: false, alreadyDone: false, concurrent: true, lockUnavailable: false, finish: noopFinish };
  } catch (err: any) {
    console.error(
      `[Cron:lock] Idempotency check failed (${jobName}:${runKey}) — aborting (fail closed):`,
      err?.message
    );
    return { acquired: false, alreadyDone: false, concurrent: false, lockUnavailable: true, finish: noopFinish };
  }
}

/** Mark an acquired run as finished (done or failed). */
export async function finishCronRun(
  jobName: string,
  runKey: string,
  status: 'done' | 'failed',
  result?: Record<string, any>,
): Promise<void> {
  try {
    const db = await getMysqlClient();
    await db.query(
      `UPDATE cron_job_runs
       SET status = ?, finished_at = NOW(), result_json = ?
       WHERE job_name = ? AND run_key = ?`,
      [status, result ? JSON.stringify(result) : null, jobName, runKey]
    );
  } catch (err: any) {
    // Non-fatal: next run's idempotency just won't see completion and may re-run.
    console.warn(`[Cron:lock] Failed to mark ${jobName}:${runKey} as ${status}:`, err?.message);
  }
}

/** Helper: build a unique run key for a per-wave daily cron (IST date). */
export function waveRunKey(jobName: string, wave: string): string {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + IST_OFFSET).toISOString().slice(0, 10);
  return `${jobName}:${wave}:${istDate}`;
}

/** Helper: daily run key (e.g. cleanup, backup). */
export function dailyRunKey(jobName: string): string {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + IST_OFFSET).toISOString().slice(0, 10);
  return `${jobName}:daily:${istDate}`;
}
