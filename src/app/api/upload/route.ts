import { NextRequest, NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { ensureCmsMediaRoot } from '@/lib/cms-media';
import { randomUUID } from 'crypto';
import MaximumSecurity from '@/lib/enhanced-security';
import { APISecurityManager } from '@/lib/api-security';
import { CMS_IMAGE_MAX_BYTES } from '@/lib/cms-content';
import { mediaUrlFor, safeMediaPath, processImageForStorage } from '@/lib/cms-media';
import { registerMediaAsset } from '@/lib/blog-db';
import { putMediaBlob, deleteMediaBlob, sniffAvMime } from '@/lib/media-blobs';

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const MEDIA_BUCKETS = new Set(['media-images', 'media-audio', 'media-videos']);
const MEDIA_FILE_NAME = /^[0-9a-f-]{36}\.(?:mp3|wav|ogg|mp4|webm)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const safeFileStem = (filename: string) => {
  const stem = filename.replace(/\.[^.]+$/, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return stem || 'image';
};
// const MAX_UPLOADS_PER_DAY = 50; // Storage quota per user (reserved for future rate-limiting)

export async function POST(request: NextRequest) {
  // Apply MAXIMUM security protection
  const enhancedSecurityCheck = await MaximumSecurity.secureRequest(request);
  if (enhancedSecurityCheck) return enhancedSecurityCheck;

  // Verify admin authentication for uploads
  const { requireAdminAuth } = await import('@/lib/auth-utils');
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  // Apply comprehensive API security (rate limiting, method/bot checks).
  // NOTE: requireAuth is intentionally NOT set here — that flag checks for
  // an `authorization` or `x-session-id` HEADER from a separate legacy
  // in-memory session system that the browser never sends. The real,
  // cookie-based admin session was already verified above via
  // requireAdminAuth; adding requireAuth:true here made every upload
  // fail with 401 regardless of login state.
  const securityCheck = await APISecurityManager.secureAPIRoute(request, {
    allowedMethods: ['POST'],
    rateLimit: { requests: 10, window: 60000 },
  });
  if (securityCheck) return securityCheck;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'image', 'audio', or 'video'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!type || !['image', 'audio', 'video'].includes(type)) {
      return NextResponse.json({ error: 'Invalid file type specified' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` }, { status: 400 });
    }

    // Validate file MIME type
    let allowedTypes: string[] = [];
    let bucketName = '';
    
    if (type === 'image') {
      bucketName = 'media-images';
    } else if (type === 'audio') {
      allowedTypes = ALLOWED_AUDIO_TYPES;
      bucketName = 'media-audio';
    } else if (type === 'video') {
      allowedTypes = ALLOWED_VIDEO_TYPES;
      bucketName = 'media-videos';
    }

    if (type === 'image' && !file.type.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'Please upload a valid image file.' }, { status: 400 });
    }
    if (type !== 'image' && !allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` }, { status: 400 });
    }

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    // Optional destination folder from the Media Library UI (metadata only —
    // stored on cms_media_assets.folder so renaming the folder later updates
    // every asset at once).
    const folder = (() => {
      const raw = (formData.get('folder') as string | null)?.trim();
      return raw ? raw.slice(0, 500) : null;
    })();
    let fileName: string;
    let relativePath: string;
    let filePath: string;

    if (type === 'image') {
      if (file.size > CMS_IMAGE_MAX_BYTES) {
        return NextResponse.json({ error: 'Images must be 10MB or smaller.' }, { status: 413 });
      }
      // Decode and normalize every image to WebP. Sharp validates the actual
      // bytes, which also lets us accept formats beyond the browser's small
      // MIME allow-list without trusting a spoofed file extension.
      let processed;
      try {
        processed = await processImageForStorage(uint8Array, file.type);
      } catch (procError) {
        console.error('Image processing error:', procError);
        return NextResponse.json({ error: 'Could not process this image. Try a different file.' }, { status: 422 });
      }

      const now = new Date();
      // Human-readable and collision-safe: a user can recognize the source
      // in the media library while the short UUID means replacements never
      // overwrite a file a published post still references.
      const dateStamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
      fileName = `${safeFileStem(file.name)}-${dateStamp}-${randomUUID().slice(0, 8)}.${processed.extension}`;
      relativePath = path.posix.join('blog', String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), fileName);
      filePath = safeMediaPath(relativePath) ?? '';
      if (!filePath) return NextResponse.json({ error: 'Invalid media path.' }, { status: 400 });

      ensureCmsMediaRoot();
      // Disk copy is a best-effort warm cache — the DATABASE is the source of
      // truth (media_blobs), so files survive redeploys that wipe the disk.
      try {
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, processed.buffer);
      } catch (diskError) {
        console.warn('Upload: disk cache write failed (DB copy still persists):', diskError);
      }
      const publicUrl = mediaUrlFor(relativePath);

      // Persist the WebP bytes in MySQL — required for the asset to survive.
      try {
        await putMediaBlob(relativePath, processed.mimeType, processed.buffer);
      } catch (blobError) {
        console.error('Upload: failed to persist image to database:', blobError);
        return NextResponse.json({ error: 'Could not save the image to the database. Check the DB connection and retry.' }, { status: 500 });
      }

      try {
        await registerMediaAsset({
          storage_path: relativePath,
          public_url: publicUrl,
          filename: file.name.slice(0, 500),
          mime_type: processed.mimeType,
          bytes: processed.buffer.length,
          alt_text: null,
          caption: null,
          folder,
          width: processed.width,
          height: processed.height,
          uploaded_by: authCheck.user?.email || null,
        });
      } catch (mediaError) {
        console.warn('Media asset was uploaded but not indexed:', mediaError);
      }

      return NextResponse.json({
        success: true,
        url: publicUrl,
        path: relativePath,
        bucket: 'media-images',
        type: processed.mimeType,
        size: processed.buffer.length,
        width: processed.width,
        height: processed.height,
      });
    }

    // ── Audio / video — magic-byte sniffed, persisted in DB, indexed ─────────
    const rawExt = (file.name.split('.').pop() || '').toLowerCase();
    const safeExts = new Set(['mp3', 'wav', 'ogg', 'mp4', 'webm']);
    if (!safeExts.has(rawExt)) return NextResponse.json({ error: 'Unsupported file extension' }, { status: 400 });

    // Content sniffing: the decoded bytes decide the real type, never the
    // browser-declared MIME header (audit M8).
    const sniffed = sniffAvMime(uint8Array);
    if (!sniffed) {
      return NextResponse.json({ error: 'File content does not look like a valid audio/video file.' }, { status: 422 });
    }
    if (type === 'audio' && !sniffed.startsWith('audio/')) {
      return NextResponse.json({ error: `Audio upload rejected — content is ${sniffed}.` }, { status: 422 });
    }
    if (type === 'video' && !sniffed.startsWith('video/')) {
      return NextResponse.json({ error: `Video upload rejected — content is ${sniffed}.` }, { status: 422 });
    }

    fileName = `${randomUUID()}.${rawExt}`;
    relativePath = path.posix.join(bucketName, fileName);
    filePath = path.join(process.cwd(), 'public', 'uploads', relativePath);

    // Disk copy is best-effort; MySQL (media_blobs) is the source of truth.
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, uint8Array);
    } catch (diskError) {
      console.warn('Upload: disk cache write failed (DB copy still persists):', diskError);
    }

    // Persist bytes in MySQL so audio/video also survive redeploys.
    try {
      await putMediaBlob(relativePath, sniffed, Buffer.from(uint8Array));
    } catch (blobError) {
      console.error('Upload: failed to persist media to database:', blobError);
      return NextResponse.json({ error: 'Could not save the file to the database. Check the DB connection and retry.' }, { status: 500 });
    }

    // Index in the Media Library so video/audio are manageable like images.
    const publicUrlAv = `/uploads/${relativePath}`;
    try {
      await registerMediaAsset({
        storage_path: relativePath,
        public_url: publicUrlAv,
        filename: file.name.slice(0, 500),
        mime_type: sniffed,
        bytes: uint8Array.length,
        alt_text: null,
        caption: null,
        folder,
        width: null,
        height: null,
        uploaded_by: authCheck.user?.email || null,
      });
    } catch (mediaError) {
      console.warn('A/V asset was uploaded but not indexed:', mediaError);
    }

    return NextResponse.json({
      success: true,
      url: publicUrlAv,
      path: relativePath,
      bucket: bucketName,
      type: sniffed,
      size: uint8Array.length,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: `Upload failed: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Verify admin authentication for deletions
  const { requireAdminAuth } = await import('@/lib/auth-utils');
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const fileParam = searchParams.get('path');
    const bucket = searchParams.get('bucket');

    if (!fileParam || !bucket) {
      return NextResponse.json({ error: 'Missing path or bucket parameter' }, { status: 400 });
    }
    if (!MEDIA_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: 'Invalid media bucket' }, { status: 400 });
    }
    if (fileParam.includes('..') || fileParam.includes('\\')) {
      return NextResponse.json({ error: 'Invalid path parameter' }, { status: 400 });
    }

    // Upload responses include "media-audio/uuid.ext" as the path while
    // older records stored just "uuid.ext". Accept both canonical forms,
    // but never let the caller choose another directory.
    const mediaFileName = fileParam.startsWith(`${bucket}/`)
      ? fileParam.slice(bucket.length + 1)
      : fileParam;
    const filePath = bucket === 'media-images'
      ? safeMediaPath(fileParam)
      : !MEDIA_FILE_NAME.test(mediaFileName)
        ? null
        : path.join(process.cwd(), 'public', 'uploads', bucket, mediaFileName);
    if (!filePath) return NextResponse.json({ error: 'Invalid path parameter' }, { status: 400 });

    // Best-effort disk removal — the file may already be gone after a redeploy.
    try { await unlink(filePath); } catch { /* already deleted */ }

    // Purge the authoritative DB copy so the asset stops being served.
    await deleteMediaBlob(bucket === 'media-images' ? fileParam : `${bucket}/${mediaFileName}`);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: `Delete failed: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}
