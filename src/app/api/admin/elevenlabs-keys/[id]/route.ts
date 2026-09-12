/**
 * DELETE /api/admin/elevenlabs-keys/[id]  — remove a DB key
 * PATCH  /api/admin/elevenlabs-keys/[id]  — reset exhaustion flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { verifyAdminSession } from '@/lib/admin-auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (!auth.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!id || id < 0) return NextResponse.json({ error: 'Invalid id (env keys cannot be deleted via UI)' }, { status: 400 });

  try {
    const db = await getMysqlClient();
    const [result]: any = await db.query('DELETE FROM elevenlabs_admin_keys WHERE id = ?', [id]);
    if (!result?.affectedRows) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[EL keys DELETE]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession(req);
  if (!auth.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body?.action !== 'reset') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const db = await getMysqlClient();

    if (id < 0) {
      // Env key — reset in elevenlabs_api_keys tracker
      // We identify env keys by negative id convention; reset all exhausted env keys is simplest
      await db.query(`UPDATE elevenlabs_api_keys SET is_exhausted = 0, exhausted_at = NULL WHERE id = ?`, [Math.abs(id)]).catch(() => {});
    } else {
      await db.query(
        `UPDATE elevenlabs_admin_keys SET is_exhausted = 0, exhausted_at = NULL WHERE id = ?`,
        [id]
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[EL keys PATCH]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
