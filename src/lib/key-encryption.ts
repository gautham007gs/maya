/**
 * Envelope Encryption for API provider credentials (AES-256-GCM)
 *
 * Provider API keys are encrypted at rest using AES-256-GCM envelope encryption:
 *
 *   MASTER_ENCRYPTION_KEY ──► AES-256-GCM ──► { iv, ciphertext, authTag } ──► MySQL
 *
 * Stored format (single TEXT column, no schema change required):
 *
 *   enc:v1:<base64url(iv)>:<base64url(authTag)>:<base64url(ciphertext)>
 *
 * Decryption happens ONLY immediately before the credential is used by a provider.
 * Existing plaintext rows are still readable (backward compatible) and are re-encrypted
 * opportunistically on update.
 */

import crypto from 'crypto';

const FORMAT_PREFIX = 'enc:v1:';
const KEY_ENV = 'MASTER_ENCRYPTION_KEY';
const VERSION = 'v1';

function getMasterKey(): Buffer | null {
  const explicitKey = process.env[KEY_ENV];
  if (explicitKey && explicitKey.trim() !== '') {
    return crypto.createHash('sha256').update(explicitKey.trim()).digest();
  }

  // If explicit dev-only plaintext is requested, don't encrypt
  if (process.env.DEV_ONLY === 'true') {
    return null;
  }

  // Derive secure key from existing secrets so encryption works automatically
  const fallback =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.COOKIE_SECRET ||
    process.env.REQUEST_SIGNATURE_SECRET ||
    'kruthika-ai-master-encryption-seed-2026';
  return crypto.createHash('sha256').update(fallback.trim()).digest();
}

/** Whether at-rest encryption is enabled for this process. */
export function isEncryptionEnabled(): boolean {
  return getMasterKey() !== null;
}

/**
 * Encrypt a secret for storage using AES-256-GCM.
 * Returns `enc:v1:<iv>:<authTag>:<ciphertext>` when encryption is active,
 * or the plaintext unchanged in dev-only fallback mode.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;

  const key = getMasterKey();
  if (!key) {
    return plaintext;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const parts = [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ];
  return `${FORMAT_PREFIX}${parts.join(':')}`;
}

/**
 * Decrypt a stored secret.
 * Understands the `enc:v1:` envelope format; anything else is treated as a
 * legacy plaintext value and returned unchanged.
 *
 * @throws if the envelope is malformed or authentication fails (tampered data).
 */
export function decryptSecret(stored: string): string {
  if (!stored || typeof stored !== 'string') return stored;

  if (!stored.startsWith(FORMAT_PREFIX)) {
    // Legacy plaintext row — still supported for backwards compatibility.
    return stored;
  }

  const key = getMasterKey();
  if (!key) {
    throw new Error(
      `[KeyEncryption] ${KEY_ENV} not set but stored credential uses "${FORMAT_PREFIX}" format. ` +
      'Cannot decrypt — configure MASTER_ENCRYPTION_KEY.'
    );
  }

  const body = stored.slice(FORMAT_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) {
    throw new Error('[KeyEncryption] Malformed encrypted credential envelope');
  }
  const [ivB64, tagB64, ciphertextB64] = parts;

  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Version marker embedded in encrypted values (for future key rotation).
 */
export function getEncryptionVersion(): string {
  return VERSION;
}

/**
 * Re-encrypt a legacy plaintext value when encryption becomes enabled.
 * No-op when the value is already encrypted.
 */
export function normalizeSecret(stored: string): string {
  if (stored && typeof stored === 'string' && stored.startsWith(FORMAT_PREFIX)) {
    return stored;
  }
  if (stored && typeof stored === 'string' && isEncryptionEnabled()) {
    return encryptSecret(stored);
  }
  return stored;
}

export default {
  encryptSecret,
  decryptSecret,
  isEncryptionEnabled,
  normalizeSecret,
  getEncryptionVersion,
};
