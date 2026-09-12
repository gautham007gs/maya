import 'server-only';

import fs from 'fs';
import path from 'path';

const FALLBACK_MEDIA_ROOT = path.join(process.cwd(), '.cms-media');
const PUBLIC_PATH = '/uploads';

export const CMS_ALLOWED_IMAGES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

export function getCmsMediaRoot(): string {
  return process.env.CMS_MEDIA_ROOT?.trim() || FALLBACK_MEDIA_ROOT;
}

export function ensureCmsMediaRoot(): string {
  const root = getCmsMediaRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function getCmsMediaPublicPath(): string {
  const configured = process.env.CMS_MEDIA_PUBLIC_PATH?.trim() || PUBLIC_PATH;
  return `/${configured.replace(/^\/+|\/+$/g, '')}`;
}

export function mediaUrlFor(relativePath: string): string {
  return `${getCmsMediaPublicPath()}/${relativePath.split(path.sep).join('/')}`;
}

export function safeMediaPath(relativePath: string): string | null {
  const normalised = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalised || normalised.includes('\0')) return null;
  // Turbopack traces filesystem calls statically. The CMS media root is
  // configurable via CMS_MEDIA_ROOT in production which would otherwise cause
  // the bundler to include the whole project. Opt out of static tracing for
  // this call — the function runs only on the server so this is safe.
  const root = path.resolve(/*turbopackIgnore: true*/ getCmsMediaRoot());
  const candidate = path.resolve(root, normalised);
  return candidate.startsWith(`${root}${path.sep}`) ? candidate : null;
}

/** Resolve a legacy public/uploads asset without permitting path traversal. */
export function safePublicUploadPath(relativePath: string): string | null {
  const normalised = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalised || normalised.includes('\0')) return null;
  const root = path.resolve(process.cwd(), 'public', 'uploads');
  const candidate = path.resolve(root, normalised);
  return candidate.startsWith(`${root}${path.sep}`) ? candidate : null;
}

export function imageExtensionFromBytes(bytes: Uint8Array): keyof typeof CMS_ALLOWED_IMAGES | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return null;
}

// ── WebP normalization ───────────────────────────────────────────────────────
// Every image uploaded through the CMS is decoded and re-encoded to WebP.
// Sharp supports the common camera, design, and browser image formats (including
// animated GIF/WebP), so the browser's declared MIME type is not used as the
// format allow-list. The decoded image is the source of truth.
//
// Max dimension of 2000px covers every real placement on this site (featured
// image, OG image, in-article figure) at full retina width without shipping
// pixels nobody will ever see.
const MAX_IMAGE_DIMENSION = 2000;
const WEBP_QUALITY = 82;

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: 'image/webp';
  extension: 'webp';
  width: number | null;
  height: number | null;
}

export async function processImageForStorage(
  bytes: Uint8Array,
  _declaredType?: string,
): Promise<ProcessedImage> {
  const input = Buffer.from(bytes);

  const sharpMod = (await import('sharp')).default;
  // `animated: true` preserves all frames when the source is an animated GIF
  // or animated WebP instead of silently saving only its first frame.
  const image = sharpMod(input, { failOn: 'none', animated: true }).rotate();
  const meta = await image.metadata();

  const resized = (meta.width && meta.width > MAX_IMAGE_DIMENSION) || (meta.height && meta.height > MAX_IMAGE_DIMENSION)
    ? image.resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
    : image;

  const buffer = await resized.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
  const finalMeta = await sharpMod(buffer).metadata();

  return {
    buffer,
    mimeType: 'image/webp',
    extension: 'webp',
    width: finalMeta.width ?? null,
    height: finalMeta.height ?? null,
  };
}
