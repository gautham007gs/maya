/**
 * GET /api/admin/provider-models
 *   → { defaults: Record<provider, string[]>, overrides: Record<provider, string[]> }
 *     `defaults`  = built-in verified cascades (PROVIDER_DEFAULT_MODELS)
 *     `overrides` = admin-saved replacements (empty object = all defaults)
 *
 * PUT /api/admin/provider-models
 *   Body: { provider: string, models: string[] | null }
 *     - models = list of model IDs in try-order (REPLACES the default cascade)
 *     - null / empty array → clear override, back to built-in defaults
 *   Body: { reset: true } → clear every override
 *
 * Models change frequently and providers decommission them without much
 * notice — this lets the admin hot-fix a stale cascade without a code deploy.
 * Saving busts the engine caches so the next chat request uses the new models.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { PROVIDER_ORDER, PROVIDER_DEFAULT_MODELS, invalidateKeysCache } from '@/ai/multi-provider';
import {
  getProviderModelOverrides,
  saveProviderModelOverrides,
  saveProviderModelOverride,
  MAX_MODELS_PER_PROVIDER,
} from '@/lib/provider-models';

export async function GET(req: NextRequest) {
  const session = await verifyAdminSession(req);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const overrides = await getProviderModelOverrides();
  return NextResponse.json({ defaults: PROVIDER_DEFAULT_MODELS, overrides });
}

export async function PUT(req: NextRequest) {
  const session = await verifyAdminSession(req);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.reset === true) {
    const overrides = await saveProviderModelOverrides({});
    invalidateKeysCache();
    return NextResponse.json({ success: true, overrides });
  }

  const provider: string = typeof body.provider === 'string' ? body.provider : '';
  if (!(PROVIDER_ORDER as string[]).includes(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${provider || '(empty)'}` }, { status: 400 });
  }

  // Clear override → back to defaults
  if (body.models === null || body.models === undefined || (Array.isArray(body.models) && body.models.length === 0)) {
    const overrides = await saveProviderModelOverride(provider, null);
    invalidateKeysCache();
    return NextResponse.json({ success: true, overrides });
  }

  if (!Array.isArray(body.models)) {
    return NextResponse.json({ error: 'models must be an array of model-ID strings or null' }, { status: 400 });
  }

  const rawModels: unknown[] = body.models;
  const models: string[] = [...new Set(
    rawModels
      .filter((m): m is string => typeof m === 'string')
      .map(m => m.trim())
      .filter(m => m.length > 0),
  )];

  if (models.length === 0) {
    return NextResponse.json({ error: 'models must contain at least one non-empty model ID' }, { status: 400 });
  }
  if (models.length > MAX_MODELS_PER_PROVIDER) {
    return NextResponse.json(
      { error: `Too many models (max ${MAX_MODELS_PER_PROVIDER}).` },
      { status: 400 },
    );
  }
  if (models.some(m => m.length > 80)) {
    return NextResponse.json({ error: 'Model IDs must be at most 80 characters.' }, { status: 400 });
  }

  const overrides = await saveProviderModelOverride(provider, models);
  invalidateKeysCache();
  return NextResponse.json({ success: true, overrides });
}
