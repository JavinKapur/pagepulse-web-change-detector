import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from './crypto.js';

describe('AES-256-GCM Secret Encryption', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('encrypts and decrypts string secrets successfully', () => {
    const secret = 'https://discord.com/api/webhooks/123456789/abcdef-secret-token';
    const encrypted = encryptSecret(secret, testKey);

    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted.split(':')).toHaveLength(4);

    const decrypted = decryptSecret<string>(encrypted, testKey);
    expect(decrypted).toBe(secret);
  });

  it('encrypts and decrypts structured JSON secrets', () => {
    const payload = { botToken: '12345:ABCDE', chatId: '987654321', threadId: 42 };
    const encrypted = encryptSecret(payload, testKey);
    const decrypted = decryptSecret<typeof payload>(encrypted, testKey);

    expect(decrypted).toEqual(payload);
  });

  it('fails decryption if ciphertext or auth tag is tampered with', () => {
    const secret = 'super-secret-key';
    const encrypted = encryptSecret(secret, testKey);
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('a') ? 'b' : 'a');
    const tampered = parts.join(':');

    expect(() => decryptSecret(tampered, testKey)).toThrow();
  });

  it('rejects keys that are not 32 bytes (64 hex characters)', () => {
    expect(() => encryptSecret('data', 'shortkey')).toThrow('exactly 32 bytes');
  });
});
