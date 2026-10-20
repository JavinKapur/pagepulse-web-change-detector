import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc, lte } from 'drizzle-orm';
import * as schema from './schema.js';
import type {
  IPagePulseRepository,
  UserRecord,
  TargetRecord,
  WatchRecord,
  CheckRunRecord,
  WatchSnapshotRecord,
  NotificationEndpointRecord,
  AlertEventRecord,
  NotificationDeliveryRecord,
} from './repository.js';
import type { WatchStatus } from '@pagepulse/config';

export class DrizzleRepository implements IPagePulseRepository {
  public db: PostgresJsDatabase<typeof schema>;
  private sql: ReturnType<typeof postgres>;

  constructor(connectionString?: string) {
    const url =
      connectionString ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/pagepulse';
    this.sql = postgres(url, { max: 10 });
    this.db = drizzle(this.sql, { schema });
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  // --- Users ---
  async createUser(data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserRecord> {
    const id = `usr_${randomUUID()}`;
    const now = new Date();
    const [user] = await this.db
      .insert(schema.users)
      .values({
        id,
        email: data.email,
        displayName: data.displayName,
        passwordHash: data.passwordHash || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return user || null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user || null;
  }

  // --- Targets ---
  async findOrCreateTarget(
    canonicalUrl: string,
    targetKey: string,
    hostname: string,
    renderProfile: Record<string, unknown> = {}
  ): Promise<TargetRecord> {
    const [existing] = await this.db
      .select()
      .from(schema.targets)
      .where(eq(schema.targets.targetKey, targetKey))
      .limit(1);
    if (existing) {
      return {
        ...existing,
        renderProfileJson: existing.renderProfileJson as Record<string, unknown>,
      };
    }

    const id = `tgt_${randomUUID()}`;
    const now = new Date();
    const [created] = await this.db
      .insert(schema.targets)
      .values({
        id,
        canonicalUrl,
        targetKey,
        hostname,
        renderProfileJson: renderProfile,
        nextFetchAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return {
      ...created,
      renderProfileJson: created.renderProfileJson as Record<string, unknown>,
    };
  }

  async getTargetById(id: string): Promise<TargetRecord | null> {
    const [target] = await this.db
      .select()
      .from(schema.targets)
      .where(eq(schema.targets.id, id))
      .limit(1);
    if (!target) return null;
    return {
      ...target,
      renderProfileJson: target.renderProfileJson as Record<string, unknown>,
    };
  }

  async updateTargetNextFetch(id: string, nextFetchAt: Date, lastHealthyAt?: Date | null): Promise<void> {
    await this.db
      .update(schema.targets)
      .set({
        nextFetchAt,
        ...(lastHealthyAt !== undefined ? { lastHealthyAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.targets.id, id));
  }

  // --- Watches ---
  async createWatch(data: Omit<WatchRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WatchRecord> {
    const id = `wtc_${randomUUID()}`;
    const now = new Date();
    const [watch] = await this.db
      .insert(schema.watches)
      .values({
        id,
        userId: data.userId,
        targetId: data.targetId,
        name: data.name,
        intervalMinutes: data.intervalMinutes,
        enabled: data.enabled,
        sensitivity: data.sensitivity,
        includeSelectors: data.includeSelectors,
        ignoreSelectors: data.ignoreSelectors,
        normalizationRules: data.normalizationRules,
        status: data.status,
        nextCheckAt: data.nextCheckAt,
        baselineEstablishedAt: data.baselineEstablishedAt || null,
        lastCheckedAt: data.lastCheckedAt || null,
        lastChangedAt: data.lastChangedAt || null,
        lastErrorMessage: data.lastErrorMessage || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return this.mapWatch(watch);
  }

  async getWatchById(id: string, userId: string): Promise<WatchRecord | null> {
    const [watch] = await this.db
      .select()
      .from(schema.watches)
      .where(and(eq(schema.watches.id, id), eq(schema.watches.userId, userId)))
      .limit(1);
    return watch ? this.mapWatch(watch) : null;
  }

  async listWatchesByUserId(userId: string): Promise<WatchRecord[]> {
    const records = await this.db
      .select()
      .from(schema.watches)
      .where(eq(schema.watches.userId, userId))
      .orderBy(desc(schema.watches.createdAt));
    return records.map(this.mapWatch);
  }

  async updateWatch(id: string, userId: string, patch: Partial<WatchRecord>): Promise<WatchRecord | null> {
    const [updated] = await this.db
      .update(schema.watches)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.watches.id, id), eq(schema.watches.userId, userId)))
      .returning();
    return updated ? this.mapWatch(updated) : null;
  }

  async deleteWatch(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.watches)
      .where(and(eq(schema.watches.id, id), eq(schema.watches.userId, userId)))
      .returning();
    return deleted.length > 0;
  }

  async findDueWatches(now: Date = new Date(), limit = 100): Promise<WatchRecord[]> {
    const records = await this.db
      .select()
      .from(schema.watches)
      .where(and(eq(schema.watches.enabled, true), lte(schema.watches.nextCheckAt, now)))
      .limit(limit);
    return records.map(this.mapWatch);
  }

  async listWatchesForTarget(targetId: string): Promise<WatchRecord[]> {
    const records = await this.db
      .select()
      .from(schema.watches)
      .where(and(eq(schema.watches.targetId, targetId), eq(schema.watches.enabled, true)));
    return records.map(this.mapWatch);
  }

  // --- CheckRuns ---
  async createCheckRun(data: Omit<CheckRunRecord, 'id' | 'createdAt'>): Promise<CheckRunRecord> {
    const id = `chk_${randomUUID()}`;
    const now = new Date();
    const [run] = await this.db
      .insert(schema.checkRuns)
      .values({
        id,
        targetId: data.targetId,
        outcome: data.outcome,
        httpStatus: data.httpStatus ?? null,
        finalUrl: data.finalUrl ?? null,
        durationMs: data.durationMs,
        errorCode: data.errorCode ?? null,
        textHash: data.textHash ?? null,
        changedPixelRatio: data.changedPixelRatio ?? null,
        metadataJson: data.metadataJson,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
        createdAt: now,
      })
      .returning();
    return {
      ...run,
      metadataJson: run.metadataJson as Record<string, unknown>,
    };
  }

  async getCheckRunsForTarget(targetId: string, limit = 20): Promise<CheckRunRecord[]> {
    const runs = await this.db
      .select()
      .from(schema.checkRuns)
      .where(eq(schema.checkRuns.targetId, targetId))
      .orderBy(desc(schema.checkRuns.startedAt))
      .limit(limit);
    return runs.map((r) => ({
      ...r,
      metadataJson: r.metadataJson as Record<string, unknown>,
    }));
  }

  // --- Snapshots ---
  async createSnapshot(data: Omit<WatchSnapshotRecord, 'id' | 'createdAt'>): Promise<WatchSnapshotRecord> {
    const id = `snp_${randomUUID()}`;
    const now = new Date();
    const [snapshot] = await this.db
      .insert(schema.watchSnapshots)
      .values({
        id,
        watchId: data.watchId,
        checkRunId: data.checkRunId,
        sequenceNo: data.sequenceNo,
        contentHash: data.contentHash,
        normalizedText: data.normalizedText,
        screenshotObjectKey: data.screenshotObjectKey ?? null,
        previousSnapshotId: data.previousSnapshotId ?? null,
        changeSummaryJson: data.changeSummaryJson,
        createdAt: now,
      })
      .returning();
    return {
      ...snapshot,
      changeSummaryJson: snapshot.changeSummaryJson as Record<string, unknown>,
    };
  }

  async getLatestSnapshotForWatch(watchId: string): Promise<WatchSnapshotRecord | null> {
    const [snap] = await this.db
      .select()
      .from(schema.watchSnapshots)
      .where(eq(schema.watchSnapshots.watchId, watchId))
      .orderBy(desc(schema.watchSnapshots.sequenceNo))
      .limit(1);
    if (!snap) return null;
    return {
      ...snap,
      changeSummaryJson: snap.changeSummaryJson as Record<string, unknown>,
    };
  }

  async listSnapshotsForWatch(watchId: string, userId: string, limit = 20): Promise<WatchSnapshotRecord[]> {
    const [watch] = await this.db
      .select({ id: schema.watches.id })
      .from(schema.watches)
      .where(and(eq(schema.watches.id, watchId), eq(schema.watches.userId, userId)))
      .limit(1);
    if (!watch) return [];

    const snaps = await this.db
      .select()
      .from(schema.watchSnapshots)
      .where(eq(schema.watchSnapshots.watchId, watchId))
      .orderBy(desc(schema.watchSnapshots.sequenceNo))
      .limit(limit);
    return snaps.map((s) => ({
      ...s,
      changeSummaryJson: s.changeSummaryJson as Record<string, unknown>,
    }));
  }

  async getSnapshotById(snapshotId: string, userId: string): Promise<WatchSnapshotRecord | null> {
    const [snap] = await this.db
      .select()
      .from(schema.watchSnapshots)
      .innerJoin(schema.watches, eq(schema.watchSnapshots.watchId, schema.watches.id))
      .where(and(eq(schema.watchSnapshots.id, snapshotId), eq(schema.watches.userId, userId)))
      .limit(1);
    if (!snap) return null;
    return {
      ...snap.watch_snapshots,
      changeSummaryJson: snap.watch_snapshots.changeSummaryJson as Record<string, unknown>,
    };
  }

  // --- Notification Endpoints ---
  async createNotificationEndpoint(
    data: Omit<NotificationEndpointRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<NotificationEndpointRecord> {
    const id = `end_${randomUUID()}`;
    const now = new Date();
    const [ep] = await this.db
      .insert(schema.notificationEndpoints)
      .values({
        id,
        userId: data.userId,
        channel: data.channel,
        encryptedConfig: data.encryptedConfig,
        enabled: data.enabled,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return ep as NotificationEndpointRecord;
  }

  async listNotificationEndpoints(userId: string): Promise<NotificationEndpointRecord[]> {
    const eps = await this.db
      .select()
      .from(schema.notificationEndpoints)
      .where(eq(schema.notificationEndpoints.userId, userId));
    return eps as NotificationEndpointRecord[];
  }

  async getNotificationEndpoint(id: string, userId: string): Promise<NotificationEndpointRecord | null> {
    const [ep] = await this.db
      .select()
      .from(schema.notificationEndpoints)
      .where(and(eq(schema.notificationEndpoints.id, id), eq(schema.notificationEndpoints.userId, userId)))
      .limit(1);
    return (ep as NotificationEndpointRecord) || null;
  }

  async deleteNotificationEndpoint(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.notificationEndpoints)
      .where(and(eq(schema.notificationEndpoints.id, id), eq(schema.notificationEndpoints.userId, userId)))
      .returning();
    return deleted.length > 0;
  }

  // --- Alert Events ---
  async createAlertEvent(data: Omit<AlertEventRecord, 'id' | 'createdAt'>): Promise<AlertEventRecord> {
    const [existing] = await this.db
      .select()
      .from(schema.alertEvents)
      .where(eq(schema.alertEvents.idempotencyKey, data.idempotencyKey))
      .limit(1);
    if (existing) return existing;

    const id = `alt_${randomUUID()}`;
    const now = new Date();
    const [created] = await this.db
      .insert(schema.alertEvents)
      .values({
        id,
        watchId: data.watchId,
        snapshotId: data.snapshotId ?? null,
        type: data.type,
        idempotencyKey: data.idempotencyKey,
        createdAt: now,
      })
      .returning();
    return created;
  }

  // --- Notification Deliveries ---
  async createNotificationDelivery(
    data: Omit<NotificationDeliveryRecord, 'id' | 'createdAt'>
  ): Promise<NotificationDeliveryRecord> {
    const id = `dlv_${randomUUID()}`;
    const now = new Date();
    const [dlv] = await this.db
      .insert(schema.notificationDeliveries)
      .values({
        id,
        alertEventId: data.alertEventId,
        endpointId: data.endpointId,
        status: data.status,
        attempts: data.attempts,
        providerMessageId: data.providerMessageId ?? null,
        lastErrorCode: data.lastErrorCode ?? null,
        sentAt: data.sentAt ?? null,
        createdAt: now,
      })
      .returning();
    return dlv as NotificationDeliveryRecord;
  }

  async updateDeliveryStatus(
    id: string,
    status: 'SENT' | 'FAILED' | 'SUPPRESSED',
    attempts: number,
    providerMessageId?: string,
    errorCode?: string
  ): Promise<void> {
    await this.db
      .update(schema.notificationDeliveries)
      .set({
        status,
        attempts,
        providerMessageId: providerMessageId ?? null,
        lastErrorCode: errorCode ?? null,
        sentAt: status === 'SENT' ? new Date() : undefined,
      })
      .where(eq(schema.notificationDeliveries.id, id));
  }

  private mapWatch(raw: typeof schema.watches.$inferSelect): WatchRecord {
    return {
      ...raw,
      sensitivity: raw.sensitivity as 'low' | 'normal' | 'high' | 'custom',
      status: raw.status as WatchStatus,
      includeSelectors: (raw.includeSelectors || []) as string[],
      ignoreSelectors: (raw.ignoreSelectors || []) as string[],
      normalizationRules: (raw.normalizationRules || {}) as Record<string, unknown>,
    };
  }
}
