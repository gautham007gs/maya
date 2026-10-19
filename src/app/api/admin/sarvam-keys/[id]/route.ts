/**
 * DELETE /api/admin/sarvam-keys/[id]  — remove a DB key (id > 0)
 * PATCH  /api/admin/sarvam-keys/[id]  — reset exhaustion status
 *   body: { action: 'reset' }
 *
 * Env-var keys (negative IDs) can only be reset (exhaustion cleared), not deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { verifyAdminSession } from '@/lib/admin-auth';

// const MAX_KEYS = 20; // reserved for future key-count enforcement

function keyHash(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0') + key.slice(-6);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id) || id <= 0)
    return NextResponse.json({ error: 'Only admin-added DB keys (positive IDs) can be deleted' }, { status: 400 });

  try {
    const db = await getMysqlClient();
    const [result]: any = await db.query(
      'DELETE FROM sarvam_admin_keys WHERE id = ?', [id]
    );
    if (result.affectedRows === 0)
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  if (body.action !== 'reset')
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  try {
    const db = await getMysqlClient();

    if (id > 0) {
      // DB key — reset exhaustion in sarvam_admin_keys
      const [result]: any = await db.query(
        'UPDATE sarvam_admin_keys SET is_exhausted = 0, exhausted_at = NULL WHERE id = ?', [id]
      );
      if (result.affectedRows === 0)
        return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    } else {
      // Env key — find and reset in sarvam_api_keys by hash
      const slot = Math.abs(id);
      const rawEnvKey = process.env[`SARVAM_API_KEY_${slot}`]?.trim();
      if (!rawEnvKey)
        return NextResponse.json({ error: 'Env key not found' }, { status: 404 });

      const hash = keyHash(rawEnvKey);
      await db.query(
        'UPDATE sarvam_api_keys SET is_exhausted = 0, exhausted_at = NULL WHERE key_hash = ?', [hash]
      ).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
