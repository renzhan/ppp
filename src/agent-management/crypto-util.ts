import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from the ENCRYPTION_KEY environment variable using SHA-256.
 * This ensures we always have a valid 256-bit key regardless of the env var length.
 */
function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return createHash('sha256').update(envKey).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @returns Encrypted string in format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt an encrypted string produced by the encrypt function.
 * @param encrypted String in format: base64(iv):base64(authTag):base64(ciphertext)
 * @returns Original plaintext string
 */
export function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Mask a plaintext string for display purposes.
 * For strings >= 8 chars: returns first 3 chars + "****" + last 4 chars
 * For shorter strings: returns "****"
 *
 * Example: "sk-abc123xyz" → "sk-****2xyz"  (first 3 + **** + last 4)
 */
export function mask(plaintext: string): string {
  if (plaintext.length >= 8) {
    return `${plaintext.slice(0, 3)}****${plaintext.slice(-4)}`;
  }
  return '****';
}
