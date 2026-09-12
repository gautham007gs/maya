/**
 * Analytics Data Retention
 *
 * Purges raw, high-volume analytics tables older than a retention window so the
 * database does not grow without bound on shared hosting. Aggregated tables
 * (daily_analytics, daily_activity_log, ad_revenue_log) are KEPT indefinitely —
 * they are compact by design and drive the dashboards.
 *
 * Deletes run in small batches (default 1000 rows per statement) to avoid long
 * table locks on InnoDB, and iterate until a table is fully purged or a total
 * row budget is reached for this invocation.
 *
 * Triggered daily via POST /api/cron/cleanup (Hostinger cron), which applies
 * the idempotency lock so overlapping invocations cannot double-run.
 */

import { getMysqlClient } from '@/lib/mysql-client';

/** Raw tables and the timestamp column to purge by. */
export const RAW_RETENTION_TABLES: { table: string; column: string }[] = [
  { table: 'messages_log',          column: 'created_at'   },
  { table: 'page_views',            column: 'viewed_at'    },
  { table: 'user_sessions',         column: 'started_at'   },
  { table: 'user_analytics',        column: 'created_at'   },
  { table: 'user_journey_steps',    column: 'completed_at' },
  { table: 'cookie_consents',       column: 'timestamp'    },
  { table: 'ad_interactions',       column: 'timestamp'    },
  { table: 'ai_response_times',     column: 'created_at'   },
  { table: 'api_key_logs',          column: 'created_at'   },
];

export interface RetentionRunSummary {
  tablesScanned: number;
  deleted: Record<string, number>;
  errors: Record<string, string>;
  durationMs: number;
}

/**
 * Purge raw analytics rows older than `retentionDays` days.
 * Batched deletes per table; stops scanning further tables once `maxTotalRows`
 * rows have been deleted in this invocation (protects shared MySQL from a
 * monster single job).
 */
export async function runAnalyticsRetention(options?: {
  retentionDays?: number;
  batchSize?: number;
  maxTotalRows?: number;
}): Promise<RetentionRunSummary> {
  const retentionDays = options?.retentionDays ?? 90;
  const batchSize = options?.batchSize ?? 1000;
  const maxTotalRows = options?.maxTotalRows ?? 50_000;

  const started = Date.now();
  const summary: RetentionRunSummary = {
    tablesScanned: 0,
    deleted: {},
    errors: {},
    durationMs: 0,
  };

  const db = await getMysqlClient();

  for (const { table, column } of RAW_RETENTION_TABLES) {
    if (totalDeleted() >= maxTotalRows) break;
    summary.tablesScanned++;

    let purged = 0;
    try {
      // Verify the table actually exists (schemas may differ across deploys).
      const [exists]: any = await db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
        [table]
      );
      if (!Array.isArray(exists) || exists.length === 0) continue;

      // Delete in small batches so each statement holds a lock only briefly.
      for (;;) {
        if (totalDeleted() >= maxTotalRows) break;
        const [res]: any = await db.query(
          `DELETE FROM \`${table}\`
           WHERE \`${column}\` < NOW() - INTERVAL ? DAY
           LIMIT ?`,
          [retentionDays, batchSize]
        );
        const affected = res?.affectedRows ?? 0;
        purged += affected;
        if (affected < batchSize) break; // nothing left in this table
      }

      if (purged > 0) summary.deleted[table] = purged;
    } catch (err: any) {
      summary.errors[table] = err?.message ?? String(err);
      console.warn(`[Retention] Failed to purge ${table}:`, err?.message);
    }
  }

  summary.durationMs = Date.now() - started;
  console.log('[Retention] Summary:', summary);
  return summary;

  function totalDeleted(): number {
    return Object.values(summary.deleted).reduce((a, b) => a + b, 0);
  }
}
