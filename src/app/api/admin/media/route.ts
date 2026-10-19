import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getMediaAssetsList, bulkDeleteMediaAssets, getMediaAssetById, clearAuthorAvatarReference, getReferencedMediaUrls } from '@/lib/blog-db';
import { safeMediaPath, safePublicUploadPath, getCmsMediaRoot } from '@/lib/cms-media';
import { bulkDeleteMediaBlobs } from '@/lib/media-blobs';
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
// Body: { ids: number[], force?: boolean }
export async function DELETE(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Boolean) : [];
    const force = Boolean(body?.force);

    if (!ids.length) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });

    const assets = (await Promise.all(ids.map(id => getMediaAssetById(id)))).filter(Boolean);
    if (!assets.length) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    let idsToDelete = ids;
    let referencedCount = 0;
    let referencedUrls: string[] = [];

    if (!force) {
      const referenced = await getReferencedMediaUrls(assets.map(asset => asset!.public_url));
      if (referenced.size > 0) {
        referencedUrls = [...referenced];
        const referencedSet = new Set(referencedUrls);
        const unreferencedAssets = assets.filter(a => !referencedSet.has(a!.public_url));
        referencedCount = assets.length - unreferencedAssets.length;

        // If every single selected image is referenced, return 409 prompting for force confirmation
        if (unreferencedAssets.length === 0) {
          return NextResponse.json({
            error: `${referencedCount} selected media asset${referencedCount > 1 ? 's are' : ' is'} referenced in blog posts.`,
            referenced: referencedUrls,
            canForce: true,
          }, { status: 409 });
        }

        // Delete the unreferenced ones
        idsToDelete = unreferencedAssets.map(a => a!.id);
      }
    }

    // Clear author avatars for the assets being deleted
    const assetsToDelete = assets.filter(a => idsToDelete.includes(a!.id));
    await Promise.all(assetsToDelete.map(asset => clearAuthorAvatarReference(asset!.public_url)));

    // Bulk delete rows from cms_media_assets table
    const storagePaths = await bulkDeleteMediaAssets(idsToDelete);
    const root = getCmsMediaRoot();

    // Remove disk files and batch purge DB blobs
    const relativePaths: string[] = [];
    for (const sp of storagePaths) {
      const relativePath = sp.startsWith(root) ? sp.slice(root.length + 1) : sp;
      relativePaths.push(relativePath);
      let absPath = safeMediaPath(relativePath) || safePublicUploadPath(relativePath);
      if (absPath) {
        try { fs.unlinkSync(absPath); } catch { /* file may already be removed */ }
      }
    }

    // Batch purge media_blobs table
    await bulkDeleteMediaBlobs(relativePaths);

    return NextResponse.json({
      ok: true,
      deleted: idsToDelete.length,
      skipped: referencedCount,
      referencedUrls,
    });
  } catch (err: any) {
    console.error('Bulk delete media error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete assets' }, { status: 500 });
  }
}
