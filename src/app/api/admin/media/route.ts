import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getMediaAssetsList, bulkDeleteMediaAssets, getMediaAssetById, clearAuthorAvatarReference, getReferencedMediaUrls } from '@/lib/blog-db';
import { safeMediaPath, safePublicUploadPath, getCmsMediaRoot } from '@/lib/cms-media';
import { deleteMediaBlob } from '@/lib/media-blobs';
import fs from 'fs';

export const dynamic = 'force-dynamic';

// ── GET /api/admin/media ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sp = new URL(request.url).searchParams;
    const search = sp.get('q') || sp.get('search') || '';
    const folder = sp.has('folder') ? sp.get('folder')! : undefined;
    const kindParam = sp.get('kind');
    const kind = kindParam === 'image' || kindParam === 'video' || kindParam === 'audio' ? kindParam : undefined;
    const page   = Number(sp.get('page')    || 1);
    const perPage = Number(sp.get('perPage') || 40);

    const result = await getMediaAssetsList({ search, folder, kind, page, perPage });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'Media library is not available. Run database/07_cms_publishing_upgrade.sql first.' },
      { status: 503 },
    );
  }
}

// ── DELETE /api/admin/media ───────────────────────────────────────────────────
// Body: { ids: number[] }
export async function DELETE(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });

    const assets = (await Promise.all(ids.map(id => getMediaAssetById(id)))).filter(Boolean);
    const referenced = await getReferencedMediaUrls(assets.map(asset => asset!.public_url));
    if (referenced.size > 0) {
      return NextResponse.json({ error: 'Referenced media cannot be deleted. Replace it in the linked blog post first.', referenced: [...referenced] }, { status: 409 });
    }
    await Promise.all(assets.map(asset => clearAuthorAvatarReference(asset!.public_url)));
    const storagePaths = await bulkDeleteMediaAssets(ids);
    const root = getCmsMediaRoot();

    // Best-effort file removal + DB blob purge
    for (const sp of storagePaths) {
      const relativePath = sp.startsWith(root) ? sp.slice(root.length + 1) : sp;
      let absPath = safeMediaPath(relativePath);
      if (!absPath) {
        // Final fallback: try public/uploads
        absPath = safePublicUploadPath(relativePath);
      }
      if (absPath) {
        try { fs.unlinkSync(absPath); } catch { /* file may already be gone */ }
      }
      await deleteMediaBlob(relativePath);
    }

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete assets' }, { status: 500 });
  }
}
