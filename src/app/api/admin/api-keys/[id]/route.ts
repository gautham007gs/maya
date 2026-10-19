import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { requireAdminPermission } from '@/lib/admin-rbac';
import { encryptSecret } from '@/lib/key-encryption';
import { invalidateKeysCache } from '@/ai/multi-provider';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission(request, 'api_keys');
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const keyId = Number(id);
    if (!keyId || isNaN(keyId)) return NextResponse.json({ error: 'Valid key ID required' }, { status: 400 });

    const body = await request.json();
    const { status, priority, key_value, key_label } = body;
    const db = await getMysqlClient();
    const updates: string[] = [];
    const values: any[] = [];

    if (key_value && typeof key_value === 'string' && key_value.trim().length >= 8) {
      const encrypted = encryptSecret(key_value.trim());
      updates.push('key_value = ?', 'status = ?', 'error_count = 0', 'last_error = NULL');
      values.push(encrypted, 'active');
    }

    if (key_label && typeof key_label === 'string' && key_label.trim().length > 0) {
      updates.push('key_label = ?');
      values.push(key_label.trim().substring(0, 100));
    }

    if (status && ['active', 'exhausted', 'error', 'disabled'].includes(status)) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'active') {
        updates.push('error_count = 0', 'last_error = NULL');
      }
    }

    if (priority !== undefined) {
      const priorityNum = Number(priority);
      if (!isNaN(priorityNum) && priorityNum >= 1 && priorityNum <= 100) {
        updates.push('priority = ?');
        values.push(priorityNum);
      }
    }

    if (!updates.length) return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });

    values.push(keyId);
    await db.query(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`, values);
    invalidateKeysCache();

    await db.query(
      `INSERT INTO api_key_logs (key_id, provider, event_type, message) 
       SELECT id, provider, 'updated', 'Updated via admin panel' FROM api_keys WHERE id = ?`,
      [keyId]
    ).catch(() => {});

    return NextResponse.json({ success: true, updated: true });
  } catch (err: any) {
    console.error('[api-keys PATCH error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission(request, 'api_keys');
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const keyId = Number(id);
    if (!keyId || isNaN(keyId)) return NextResponse.json({ error: 'Valid key ID required' }, { status: 400 });

    const db = await getMysqlClient();
    await db.query(`DELETE FROM api_keys WHERE id = ?`, [keyId]);
    await db.query(`DELETE FROM api_key_logs WHERE key_id = ?`, [keyId]).catch(() => {});
    invalidateKeysCache();
    return NextResponse.json({ success: true, deleted: true });
  } catch (err: any) {
    console.error('[api-keys DELETE error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
