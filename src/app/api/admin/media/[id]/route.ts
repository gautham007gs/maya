import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getMediaAssetById, updateMediaAsset, deleteMediaAsset, clearAuthorAvatarReference } from '@/lib/blog-db';
import { safeMediaPath, safePublicUploadPath, getCmsMediaRoot } from '@/lib/cms-media';
import { deleteMediaBlob } from '@/lib/media-blobs';
import fs from 'fs';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/admin/media/[id] ─────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const asset = await getMediaAssetById(id);
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ asset });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch asset' }, { status: 500 });
  }
}

// ── PATCH /api/admin/media/[id] ───────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const body = await request.json();
    const patch: { alt_text?: string | null; caption?: string | null; folder?: string | null } = {};
    if ('alt_text' in body) patch.alt_text = typeof body.alt_text === 'string' ? body.alt_text.slice(0, 255) : null;
    if ('caption'  in body) patch.caption  = typeof body.caption  === 'string' ? body.caption.slice(0, 2000) : null;
    if ('folder'   in body) patch.folder   = typeof body.folder   === 'string' ? body.folder.slice(0, 500)  : null;

    await updateMediaAsset(id, patch);
    const updated = await getMediaAssetById(id);
    return NextResponse.json({ asset: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update asset' }, { status: 500 });
  }
}

// ── DELETE /api/admin/media/[id] ──────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const asset = await getMediaAssetById(id);
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await clearAuthorAvatarReference(asset.public_url);
    const storagePath = await deleteMediaAsset(id);

    // Best-effort delete the physical file
    if (storagePath) {
      const root = getCmsMediaRoot();
      const relativePath = storagePath.startsWith(root) ? storagePath.slice(root.length + 1) : storagePath;
      let absPath = safeMediaPath(relativePath);
      if (!absPath) {
        // Final fallback: some installations store media under public/uploads
        absPath = safePublicUploadPath(relativePath);
      }
      if (absPath) {
        try { fs.unlinkSync(absPath); } catch { /* file may already be gone */ }
      }
      // Purge the authoritative DB copy so the asset stops being served.
      await deleteMediaBlob(relativePath);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete asset' }, { status: 500 });
  }
}
