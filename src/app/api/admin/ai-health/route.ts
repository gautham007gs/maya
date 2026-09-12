/**
 * GET /api/admin/ai-health
 * Returns a health snapshot for all AI providers:
 *  - Per-provider key counts, active/problem/error counts
 *  - Provider enabled/disabled state
 *  - Recent api_key_logs activity
 *  - Overall system health: 'healthy' | 'degraded' | 'critical'
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { verifyAdminSession } from '@/lib/admin-auth';
import { PROVIDER_ORDER, PROVIDER_META, type AIProvider } from '@/ai/multi-provider';

const ENV_KEY_MAP: Partial<Record<AIProvider, string>> = {
  groq: 'GROQ_API_KEY', cerebras: 'CEREBRAS_API_KEY', sambanova: 'SAMBANOVA_API_KEY',
  gemini: 'GEMINI_API_KEY', github: 'GITHUB_TOKEN', openrouter: 'OPENROUTER_API_KEY',
  nvidia: 'NVIDIA_API_KEY', mistral: 'MISTRAL_API_KEY', cohere: 'COHERE_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  // Cloudflare needs two env vars
  cloudflare: 'CLOUDFLARE_API_TOKEN',
};

function hasCfEnvKey(): boolean {
  return !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
}

function providerHealth(
  hasEnvKey: boolean,
  activeDbKeys: number,
  problemKeys: number,
  enabled: boolean,
): 'ok' | 'warning' | 'error' | 'disabled' | 'no-key' {
  if (!enabled) return 'disabled';
  if (!hasEnvKey && activeDbKeys === 0) return 'no-key';
  if (!hasEnvKey && activeDbKeys === 0 && problemKeys > 0) return 'error';
  if (problemKeys > 0 && activeDbKeys === 0) return 'error';
  if (problemKeys > 0) return 'warning';
  return 'ok';
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getMysqlClient();

    // Per-provider key summary
    const [keyRows]: any = await db.query(`
      SELECT
        provider,
        COUNT(*) AS total_keys,
        SUM(status = 'active')                              AS active_keys,
        SUM(status IN ('exhausted', 'error'))               AS problem_keys,
        SUM(status = 'disabled')                            AS disabled_keys,
        COALESCE(SUM(error_count), 0)                       AS total_errors,
        MAX(last_used)                                      AS last_used,
        MAX(CASE WHEN last_error IS NOT NULL THEN last_error END) AS last_error
      FROM api_keys
      GROUP BY provider
    `);

    // Provider enabled/disabled settings
    const [cfgRows]: any = await db.query(
      `SELECT settings FROM app_configurations WHERE id = 'provider_settings' LIMIT 1`
    );
    let providerSettings: Record<string, boolean> = Object.fromEntries(PROVIDER_ORDER.map(p => [p, true]));
    if (cfgRows?.[0]?.settings) {
      try {
        const raw = cfgRows[0].settings;
        providerSettings = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
    }

    // Recent activity logs (last 40 entries)
    const [logRows]: any = await db.query(`
      SELECT key_id, provider, event_type, message, created_at
      FROM api_key_logs
      ORDER BY created_at DESC
      LIMIT 40
    `);

    const keysByProvider: Record<string, any> = {};
    for (const row of (Array.isArray(keyRows) ? keyRows : [])) {
      keysByProvider[row.provider] = row;
    }

    const providers = PROVIDER_ORDER.map(p => {
      const s = keysByProvider[p];
      const hasEnvKey = p === 'cloudflare' ? hasCfEnvKey() : !!(process.env[ENV_KEY_MAP[p] ?? '']);
      const activeDbKeys = Number(s?.active_keys ?? 0);
      const problemKeys  = Number(s?.problem_keys ?? 0);
      const dbKeyCount   = Number(s?.total_keys ?? 0);
      const enabled      = providerSettings[p] !== false;
      return {
        id:          p,
        label:       PROVIDER_META[p].label,
        model:       PROVIDER_META[p].model,
        description: PROVIDER_META[p].description,
        enabled,
        hasEnvKey,
        dbKeyCount,
        activeDbKeys,
        problemKeys,
        disabledKeys: Number(s?.disabled_keys ?? 0),
        totalErrors:  Number(s?.total_errors ?? 0),
        lastUsed:     s?.last_used  ?? null,
        lastError:    s?.last_error ?? null,
        health:       providerHealth(hasEnvKey, activeDbKeys, problemKeys, enabled),
      };
    });

    // Overall system health
    const readyProviders = providers.filter(
      p => p.enabled && (p.hasEnvKey || p.activeDbKeys > 0)
    );
    const overallHealth =
      readyProviders.length === 0 ? 'critical' :
      readyProviders.length < 3   ? 'degraded'  : 'healthy';

    return NextResponse.json({
      providers,
      recentLogs: Array.isArray(logRows) ? logRows : [],
      overallHealth,
      readyCount: readyProviders.length,
      totalProviders: PROVIDER_ORDER.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[ai-health GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
