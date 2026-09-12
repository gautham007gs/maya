import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { encryptSecret, isEncryptionEnabled } from '@/lib/key-encryption';
import { invalidateKeysCache, PROVIDER_META, PROVIDER_ORDER, type AIProvider } from '@/ai/multi-provider';

const MAX_KEYS_PER_PROVIDER = 25;

// For Cloudflare: we store "CF_API_TOKEN:::CF_ACCOUNT_ID" as a single value.
// The admin UI shows two separate fields and concatenates on save.
const ENV_KEY_PREFIX_MAP: Record<AIProvider, string[]> = {
  gemini:     ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'],
  cloudflare: [], // CF uses CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (shown in admin as combined)
  groq:       ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'],
  cerebras:   ['CEREBRAS_API_KEY', 'CEREBRAS_API_KEY_1', 'CEREBRAS_API_KEY_2'],
  sambanova:  ['SAMBANOVA_API_KEY', 'SAMBANOVA_API_KEY_1', 'SAMBANOVA_API_KEY_2'],
  github:     ['GITHUB_TOKEN', 'GITHUB_TOKEN_1', 'GITHUB_TOKEN_2'],
  openrouter: ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEY_1', 'OPENROUTER_API_KEY_2'],
  nvidia:     ['NVIDIA_API_KEY', 'NVIDIA_API_KEY_1', 'NVIDIA_API_KEY_2'],
  mistral:    ['MISTRAL_API_KEY', 'MISTRAL_API_KEY_1', 'MISTRAL_API_KEY_2'],
  cohere:     ['COHERE_API_KEY', 'COHERE_API_KEY_1', 'COHERE_API_KEY_2'],
  deepseek:   ['DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY_1', 'DEEPSEEK_API_KEY_2'],
};

// For Cloudflare env detection — show as env key if both tokens are set
function getCfEnvKey(): string | undefined {
  const t = process.env.CLOUDFLARE_API_TOKEN;
  const a = process.env.CLOUDFLARE_ACCOUNT_ID;
  return t && a ? `${t}:::${a}` : undefined;
}

function maskKey(value: string): string {
  if (!value || value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••' + value.slice(-4);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, 'api_keys');
  if (!auth.ok) return auth.response;

  try {
    const db = await getMysqlClient();

    const [keyRows] = await db.query(
      `SELECT id, provider, key_label, key_value, priority, status, last_used, last_error, error_count, created_at
       FROM api_keys ORDER BY provider, priority ASC`
    );
    const dbKeys = (Array.isArray(keyRows) ? keyRows : []).map((k: any) => ({
      id: k.id,
      provider: k.provider,
      key_label: k.key_label,
      key_value_masked: maskKey(k.key_value),
      priority: k.priority,
      status: k.status || 'active',
      last_used: k.last_used,
      last_error: k.last_error,
      error_count: k.error_count,
      created_at: k.created_at,
      is_env_key: false,
    }));

    // Append env-based keys (including numbered env keys)
    let envId = -1;
    const envKeys: any[] = [];
    for (const [provider, envVars] of Object.entries(ENV_KEY_PREFIX_MAP) as [AIProvider, string[]][]) {
      let counter = 1;
      for (const envVar of envVars) {
        const val = process.env[envVar];
        if (val && val.trim()) {
          envKeys.push({
            id: envId--,
            provider,
            key_label: `env-${provider}-${counter}`,
            key_value_masked: maskKey(val),
            priority: 99,
            status: 'active' as const,
            last_used: null, last_error: null, error_count: 0, created_at: '',
            is_env_key: true,
          });
          counter++;
        }
      }
    }
    // Cloudflare special env handling
    const cfVal = getCfEnvKey();
    if (cfVal) {
      envKeys.push({
        id: envId--,
        provider: 'cloudflare' as AIProvider,
        key_label: 'env-cloudflare',
        key_value_masked: 'CF_API_TOKEN + CF_ACCOUNT_ID (ENV)',
        priority: 99,
        status: 'active' as const,
        last_used: null, last_error: null, error_count: 0, created_at: '',
        is_env_key: true,
      });
    }

    const keys = [...dbKeys, ...envKeys];

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

    const countByProvider: Record<string, number> = {};
    for (const k of keys) countByProvider[k.provider] = (countByProvider[k.provider] || 0) + 1;

    const providers = PROVIDER_ORDER.map(p => ({
      id: p,
      label: PROVIDER_META[p]?.label || p,
      model: PROVIDER_META[p]?.model || '',
      description: PROVIDER_META[p]?.description || '',
      enabled: providerSettings[p] !== false,
      keyCount: countByProvider[p] || 0,
      maxKeys: MAX_KEYS_PER_PROVIDER,
      canAddKey: (dbKeys.filter((k: any) => k.provider === p).length) < MAX_KEYS_PER_PROVIDER,
    }));

    return NextResponse.json({ keys, providers, totalKeys: keys.length, dbKeysCount: dbKeys.length, envKeysCount: envKeys.length });
  } catch (err: unknown) {
    console.error('[api-keys GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, 'api_keys');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { provider, key_label, key_value, priority = 1 } = body;

    if (!provider || !key_value)
      return NextResponse.json({ error: 'provider and key_value are required' }, { status: 400 });
    if (!PROVIDER_META[provider as AIProvider])
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    if (String(key_value).trim().length < 8)
      return NextResponse.json({ error: 'key_value is too short' }, { status: 400 });

    const priorityNum = Number(priority);
    if (!Number.isInteger(priorityNum) || priorityNum < 1 || priorityNum > 100)
      return NextResponse.json({ error: 'priority must be an integer between 1 and 100' }, { status: 400 });

    const trimmedKey = String(key_value).trim();
    // Always encrypt at rest using AES-256-GCM envelope encryption
    const storedKey = encryptSecret(trimmedKey);

    const db = await getMysqlClient();
    // Count existing keys for smart label generation if empty
    const [countRows]: any = await db.query(
      `SELECT COUNT(*) AS cnt FROM api_keys WHERE provider = ?`, [provider]
    );
    const existingCount = countRows?.[0]?.cnt || 0;
    if (existingCount >= MAX_KEYS_PER_PROVIDER)
      return NextResponse.json({ error: `Maximum ${MAX_KEYS_PER_PROVIDER} keys reached for ${provider}` }, { status: 400 });

    const finalLabel = key_label && key_label.trim()
      ? key_label.trim().substring(0, 100)
      : `${provider}-key-${existingCount + 1}`;

    const [result]: any = await db.query(
      `INSERT INTO api_keys (provider, key_label, key_value, priority, status, error_count) VALUES (?, ?, ?, ?, 'active', 0)`,
      [provider, finalLabel, storedKey, priorityNum]
    );
    invalidateKeysCache();
    await db.query(
      `INSERT INTO api_key_logs (key_id, provider, event_type, message) VALUES (?, ?, 'added', 'Added via admin panel')`,
      [result.insertId, provider]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      id: result.insertId,
      key_label: finalLabel,
      encryption: isEncryptionEnabled() ? 'aes-256-gcm' : 'none',
    });
  } catch (err: unknown) {
    console.error('[api-keys POST]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
