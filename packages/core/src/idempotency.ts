import { createHash } from 'node:crypto';

/**
 * Computes a SHA-256 hash of normalized text.
 */
export function computeContentHash(normalizedText: string): string {
  return createHash('sha256').update(normalizedText).digest('hex');
}

/**
 * Generates an idempotency key for alert deliveries:
 * (watchId, snapshotId, endpointId, notificationType)
 */
export function createAlertIdempotencyKey(
  watchId: string,
  snapshotId: string,
  endpointId: string,
  notificationType: string
): string {
  const rawKey = `${watchId}:${snapshotId}:${endpointId}:${notificationType}`;
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generates a deterministic job ID for a target within a check window so
 * duplicate enqueue requests coalesce automatically in Redis / BullMQ.
 */
export function generateDeterministicJobId(
  targetId: string,
  windowTimestampMs: number = Date.now(),
  windowBucketMinutes = 1
): string {
  const bucket = Math.floor(windowTimestampMs / (windowBucketMinutes * 60 * 1000));
  return `job:${targetId}:${bucket}`;
}
