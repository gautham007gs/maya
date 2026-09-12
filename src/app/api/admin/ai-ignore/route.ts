/**
 * GET  /api/admin/ai-ignore — read the global AI-ignore toggle
 * PUT  /api/admin/ai-ignore — update it
 *
 * Stored in app_configurations ('ai_ignore_settings') via
 * src/lib/ai-ignore-settings.ts. Saving busts the in-process cache, so the
 * change applies to all users immediately on this instance (≤10 s elsewhere).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getAIIgnoreSettings, saveAIIgnoreSettings } from '@/lib/ai-ignore-settings';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getAIIgnoreSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (typeof body.ignore_enabled !== 'boolean') {
    return NextResponse.json({ error: 'ignore_enabled must be a boolean' }, { status: 400 });
  }

  const updated = await saveAIIgnoreSettings({ ignore_enabled: body.ignore_enabled });
  return NextResponse.json({ success: true, settings: updated });
}
