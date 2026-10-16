import { describe, it, expect } from 'vitest';
import {
  computeContentHash,
  createAlertIdempotencyKey,
  generateDeterministicJobId,
} from './idempotency.js';

describe('Idempotency & Cryptographic Hashes', () => {
  it('computes consistent SHA-256 hashes for normalized text', () => {
    const text = 'PagePulse Sample Normalized Body';
    const hash1 = computeContentHash(text);
    const hash2 = computeContentHash(text);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('generates unique alert idempotency keys for different endpoints or types', () => {
    const key1 = createAlertIdempotencyKey('watch-1', 'snap-1', 'ep-1', 'email');
    const key2 = createAlertIdempotencyKey('watch-1', 'snap-1', 'ep-2', 'email');
    const key3 = createAlertIdempotencyKey('watch-1', 'snap-1', 'ep-1', 'discord');

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toBe(createAlertIdempotencyKey('watch-1', 'snap-1', 'ep-1', 'email'));
  });

  it('coalesces job IDs within the same time bucket window', () => {
    const baseTime = 1700000000000;
    const jobId1 = generateDeterministicJobId('target-abc', baseTime, 1);
    const jobId2 = generateDeterministicJobId('target-abc', baseTime + 25000, 1); // 25s later, same 1-min bucket
    expect(jobId1).toBe(jobId2);

    const jobId3 = generateDeterministicJobId('target-abc', baseTime + 65000, 1); // 65s later, next bucket
    expect(jobId1).not.toBe(jobId3);
  });
});
