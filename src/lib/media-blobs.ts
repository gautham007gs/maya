import 'server-only';

import { getMysqlClient } from './mysql-client';

/**
 * Database-backed media blob store — the SOURCE OF TRUTH for uploaded media.
 *
 * Why: previously uploads lived only on the server's local disk
 * (.cms-media/ or public/uploads/). A Hostinger redeploy/rebuild wipes the
 * working directory, so every stored file vanished while its
 * `cms_media_assets` row survived — the whole library degraded to fallback
 * images. Storing the bytes in MySQL makes media survive any redeploy:
 * an asset exists until it is explicitly deleted.
 *
 * The on-disk copy is now just a warm cache: writes are best-effort and reads
 * fall through to this table. Table is self-healing (created on first use) so
 * no manual migration step is required.
 */

export interface MediaBlob {
  mime_type: string;
  bytes: number;
  content: Buffer;
}

export async function ensureMediaBlobsTable(): Promise<void> {
  const client = await getMysqlClient();
  await client.query(`
    CREATE TABLE IF NOT EXISTS media_blobs (
      storage_path VARCHAR(500) PRIMARY KEY,
      mime_type    VARCHAR(150) NOT NULL,
      bytes        INT NOT NULL,
      content      LONGBLOB NOT NULL,
      updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

/** Store (or replace) the binary content for a storage path. */
export async function putMediaBlob(storagePath: string, mimeType: string, content: Buffer): Promise<void> {
  await ensureMediaBlobsTable();
  const client = await getMysqlClient();
  await client.query(
    `INSERT INTO media_blobs (storage_path, mime_type, bytes, content)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), bytes = VALUES(bytes), content = VALUES(content)`,
    [storagePath, mimeType, content.length, content],
  );
}

export async function getMediaBlob(storagePath: string): Promise<MediaBlob | null> {
  try {
    await ensureMediaBlobsTable();
    const client = await getMysqlClient();
    const [rows]: any = await client.query(
      `SELECT mime_type, bytes, content FROM media_blobs WHERE storage_path = ? LIMIT 1`,
      [storagePath],
    );
    if (!Array.isArray(rows) || !rows[0]) return null;
    return {
      mime_type: rows[0].mime_type,
      bytes: Number(rows[0].bytes),
      // mysql2 returns LONGBLOB as Buffer already; guard anyway.
      content: Buffer.isBuffer(rows[0].content) ? rows[0].content : Buffer.from(rows[0].content),
    };
  } catch (err) {
    console.error('[MediaBlobs] read failed:', err);
    return null;
  }
}

export async function deleteMediaBlob(storagePath: string): Promise<void> {
  try {
    await ensureMediaBlobsTable();
    const client = await getMysqlClient();
    await client.query(`DELETE FROM media_blobs WHERE storage_path IN (?, ?)`, [
      storagePath,
      storagePath.replace(/\\/g, '/').replace(/^\/+/, ''),
    ]);
  } catch (err) {
    console.warn('[MediaBlobs] delete failed (non-fatal):', err);
  }
}

// ── Audio / video magic-byte sniffing ────────────────────────────────────────
// Uploads were previously trusted by declared MIME type + extension alone.
// Sniffing actual bytes closes that gap without rejecting valid files whose
// browsers send unusual MIME types.

export function sniffAvMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  const ascii = (start: number, text: string) =>
    text.split('').every((c, i) => b[start + i] === c.charCodeAt(0));

  // MP3: ID3 tag or MPEG frame sync (0xFFEx/0xFFFx)
  if (ascii(0, 'ID3')) return 'audio/mpeg';
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  // WAV: RIFF....WAVE
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'audio/wav';
  // OGG: OggS
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
  // MP4: ....ftyp
  if (ascii(4, 'ftyp')) return 'video/mp4';
  // WEBM: EBML header 0x1A45DFA3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}
