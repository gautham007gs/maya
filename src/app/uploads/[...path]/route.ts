import { readFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { safeMediaPath } from '@/lib/cms-media';
import { getMediaBlob } from '@/lib/media-blobs';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const relativePath = parts.join('/');
  const extension = path.extname(relativePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType) return new NextResponse('Not found', { status: 404 });
  if (relativePath.includes('..')) return new NextResponse('Not found', { status: 404 });

  const headers = {
    'Content-Type': contentType,
    // Immutable caching is safe: storage paths contain a UUID + date stamp and
    // are never mutated in place — edits create NEW paths.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'none',
  };

  // Primary location: configurable CMS media root (e.g. .cms-media/blog/...)
  const filePath = safeMediaPath(relativePath);
  // Fallback: older installs or video/audio storage may use the public/uploads folder
  const publicUploadsPath = path.join(process.cwd(), 'public', 'uploads', relativePath.split('/').join(path.sep));

  // 1) Disk cache (CMS media root first, then public/uploads)
  for (const candidate of filePath ? [filePath, publicUploadsPath] : [publicUploadsPath]) {
    try {
      const content = await readFile(candidate);
      return new NextResponse(content, { headers });
    } catch {
      // try next source
    }
  }

  // 2) Database — the authoritative store. Media uploaded through /api/upload
  //    is persisted here, so it survives redeploys that wipe the server disk.
  const blob = await getMediaBlob(relativePath);
  if (blob) {
    return new NextResponse(new Uint8Array(blob.content), { headers });
  }

  // 3) Not found anywhere. For images serve the local fallback graphic so
  //    Next/Image and social crawlers retain a valid response; audio/video
  //    get an honest 404.
  if (contentType.startsWith('image/')) {
    try {
      const fallback = await readFile(path.join(process.cwd(), 'public', 'og-image.webp'));
      return new NextResponse(fallback, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'no-store',
          'X-Media-Fallback': 'missing-source',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch { /* fall through */ }
  }
  return new NextResponse('Not found', { status: 404 });
}
