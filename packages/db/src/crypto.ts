import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_VERSION = 'v1';

/**
 * Encrypts a plaintext string or object into an authenticated AES-256-GCM ciphertext payload.
 * Payload format: "v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptSecret(
  plaintext: string | Record<string, unknown>,
  hexKey: string
): string {
  const keyBuffer = Buffer.from(hexKey.slice(0, 64), 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters).');
  }

  const rawString = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const iv = randomBytes(12); // Recommended 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

  let ciphertext = cipher.update(rawString, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');

  return `${CURRENT_VERSION}:${ivHex}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts a versioned AES-256-GCM ciphertext payload.
 */
export function decryptSecret<T = string>(
  encryptedPayload: string,
  hexKey: string
): T {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted secret payload format');
  }

  const [version, ivHex, authTagHex, ciphertextHex] = parts;
  if (version !== 'v1') {
    throw new Error(`Unsupported secret encryption version: ${version}`);
  }

  const keyBuffer = Buffer.from(hexKey.slice(0, 64), 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters).');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
  }
}
