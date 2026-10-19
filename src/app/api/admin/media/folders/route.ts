import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { createMediaFolder, deleteMediaFolder, getMediaFolders, renameMediaFolder } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

// ── GET /api/admin/media/folders ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const folders = await getMediaFolders();
    return NextResponse.json({ folders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list folders' }, { status: 500 });
  }
}

// ── POST /api/admin/media/folders ────────────────────────────────────────────
// Creates a folder immediately, even before any file is uploaded into it, so
// it survives a page reload instead of only living in client-side state.
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name } = await request.json();
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 });
    }
    await createMediaFolder(name, session.email || 'Admin');
    const folders = await getMediaFolders();
    return NextResponse.json({ ok: true, folders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create folder' }, { status: 500 });
  }
}

// ── PATCH /api/admin/media/folders ───────────────────────────────────────────
// Renames a folder and re-points every asset in it atomically. Folder is
// library metadata (not part of any asset URL), so the change applies
// site-wide in the admin UI without breaking any image path.
export async function PATCH(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const newName = typeof body?.newName === 'string' ? body.newName.trim() : '';
    if (!name || !newName) {
      return NextResponse.json({ error: 'Both "name" and "newName" are required.' }, { status: 400 });
    }
    if (newName.length > 300) {
      return NextResponse.json({ error: 'Folder names are limited to 300 characters.' }, { status: 400 });
    }
    await renameMediaFolder(name, newName);
    return NextResponse.json({ ok: true, folders: await getMediaFolders() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to rename folder' }, { status: 500 });
  }
}

// ── DELETE /api/admin/media/folders ─────────────────────────────────────────
// Removes the folder only; files are kept and become unfiled media.
export async function DELETE(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const name = new URL(request.url).searchParams.get('name') || '';
    if (!name.trim()) {
      return NextResponse.json({ error: 'Folder name is required.' }, { status: 400 });
    }
    await deleteMediaFolder(name);
    return NextResponse.json({ ok: true, folders: await getMediaFolders() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete folder' }, { status: 500 });
  }
}
