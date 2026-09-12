import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { getUnusedMedia } from '@/lib/blog-db';

export const dynamic = 'force-dynamic';

// ── GET /api/admin/media/unused ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session.isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const assets = await getUnusedMedia();
    return NextResponse.json({ assets, total: assets.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Could not scan for unused media. Run database/11_media_seo_upgrade.sql first.' },
      { status: 503 },
    );
  }
}
