/**
 * GET  /api/admin/voice-settings — read current voice provider toggles
 * PUT  /api/admin/voice-settings — update voice provider toggles
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getVoiceProviderSettings, saveVoiceProviderSettings } from '@/lib/voice-router';

export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getVoiceProviderSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const patch: Record<string, boolean> = {};
  if (typeof body.elevenlabs_enabled === 'boolean') patch.elevenlabs_enabled = body.elevenlabs_enabled;
  if (typeof body.sarvam_enabled     === 'boolean') patch.sarvam_enabled     = body.sarvam_enabled;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  await saveVoiceProviderSettings(patch);
  const updated = await getVoiceProviderSettings();
  return NextResponse.json({ success: true, settings: updated });
}
