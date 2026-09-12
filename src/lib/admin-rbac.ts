import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from './admin-auth';

export type AdminRole = 'super_admin' | 'editor' | 'content_manager' | 'analytics' | 'marketing' | 'notification_manager';

export type AdminPermission =
  | 'cms'
  | 'media'
  | 'analytics'
  | 'notifications'
  | 'marketing'
  | 'api_keys'
  | 'settings';

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ['cms', 'media', 'analytics', 'notifications', 'marketing', 'api_keys', 'settings'],
  editor: ['cms', 'media'],
  content_manager: ['cms', 'media', 'marketing'],
  analytics: ['analytics'],
  marketing: ['marketing', 'cms'],
  notification_manager: ['notifications', 'analytics'],
};

export function getConfiguredAdminRole(): AdminRole {
  const raw = (process.env.ADMIN_ROLE || 'super_admin').toLowerCase();
  if (raw in ROLE_PERMISSIONS) return raw as AdminRole;
  return 'super_admin';
}

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function requireAdminPermission(
  request: NextRequest,
  permission: AdminPermission,
): Promise<{ ok: true; email: string; role: AdminRole } | { ok: false; response: NextResponse }> {
  const session = await verifyAdminSession(request);
  if (!session.isValid) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const role = getConfiguredAdminRole();
  if (!roleHasPermission(role, permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden — insufficient admin permissions' }, { status: 403 }),
    };
  }
  return { ok: true, email: session.email!, role };
}
