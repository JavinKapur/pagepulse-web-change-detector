import { randomUUID } from 'node:crypto';
import type { WatchStatus } from '@pagepulse/config';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TargetRecord {
  id: string;
  canonicalUrl: string;
  targetKey: string;
  renderProfileJson: Record<string, unknown>;
  hostname: string;
  nextFetchAt: Date;
  lastHealthyAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchRecord {
  id: string;
  userId: string;
  targetId: string;
  name: string;
  intervalMinutes: number;
  enabled: boolean;
  sensitivity: 'low' | 'normal' | 'high' | 'custom';
  includeSelectors: string[];
  ignoreSelectors: string[];
  normalizationRules: Record<string, unknown>;
  status: WatchStatus;
  nextCheckAt: Date;
  baselineEstablishedAt?: Date | null;
  lastCheckedAt?: Date | null;
  lastChangedAt?: Date | null;
  lastErrorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckRunRecord {
  id: string;
  targetId: string;
  outcome: string;
  httpStatus?: number | null;
  finalUrl?: string | null;
  durationMs: number;
  errorCode?: string | null;
  textHash?: string | null;
  changedPixelRatio?: string | null;
  metadataJson: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date;
  createdAt: Date;
}

export interface WatchSnapshotRecord {
  id: string;
  watchId: string;
  checkRunId: string;
  sequenceNo: number;
  contentHash: string;
  normalizedText: string;
  screenshotObjectKey?: string | null;
  previousSnapshotId?: string | null;
  changeSummaryJson: Record<string, unknown>;
  createdAt: Date;
}

export interface NotificationEndpointRecord {
  id: string;
  userId: string;
  channel: 'email' | 'telegram' | 'discord';
  encryptedConfig: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertEventRecord {
  id: string;
  watchId: string;
  snapshotId?: string | null;
  type: string;
  idempotencyKey: string;
  createdAt: Date;
}

export interface NotificationDeliveryRecord {
  id: string;
  alertEventId: string;
  endpointId: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SUPPRESSED';
  attempts: number;
  providerMessageId?: string | null;
  lastErrorCode?: string | null;
  sentAt?: Date | null;
  createdAt: Date;
}

export interface IPagePulseRepository {
  // Users
  createUser(user: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserRecord>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;

  // Targets
  findOrCreateTarget(
    canonicalUrl: string,
    targetKey: string,
    hostname: string,
    renderProfile?: Record<string, unknown>
  ): Promise<TargetRecord>;
  getTargetById(id: string): Promise<TargetRecord | null>;
  updateTargetNextFetch(id: string, nextFetchAt: Date, lastHealthyAt?: Date | null): Promise<void>;

  // Watches
  createWatch(watch: Omit<WatchRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WatchRecord>;
  getWatchById(id: string, userId: string): Promise<WatchRecord | null>;
  listWatchesByUserId(userId: string): Promise<WatchRecord[]>;
  updateWatch(id: string, userId: string, patch: Partial<WatchRecord>): Promise<WatchRecord | null>;
  deleteWatch(id: string, userId: string): Promise<boolean>;
  findDueWatches(now?: Date, limit?: number): Promise<WatchRecord[]>;
  listWatchesForTarget(targetId: string): Promise<WatchRecord[]>;

  // CheckRuns
  createCheckRun(run: Omit<CheckRunRecord, 'id' | 'createdAt'>): Promise<CheckRunRecord>;
  getCheckRunsForTarget(targetId: string, limit?: number): Promise<CheckRunRecord[]>;

  // Snapshots
  createSnapshot(snap: Omit<WatchSnapshotRecord, 'id' | 'createdAt'>): Promise<WatchSnapshotRecord>;
  getLatestSnapshotForWatch(watchId: string): Promise<WatchSnapshotRecord | null>;
  listSnapshotsForWatch(watchId: string, userId: string, limit?: number): Promise<WatchSnapshotRecord[]>;
  getSnapshotById(snapshotId: string, userId: string): Promise<WatchSnapshotRecord | null>;

  // Notification Endpoints
  createNotificationEndpoint(
    endpoint: Omit<NotificationEndpointRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<NotificationEndpointRecord>;
  listNotificationEndpoints(userId: string): Promise<NotificationEndpointRecord[]>;
  getNotificationEndpoint(id: string, userId: string): Promise<NotificationEndpointRecord | null>;
  deleteNotificationEndpoint(id: string, userId: string): Promise<boolean>;

  // Alert Events & Deliveries
  createAlertEvent(event: Omit<AlertEventRecord, 'id' | 'createdAt'>): Promise<AlertEventRecord>;
  createNotificationDelivery(
    delivery: Omit<NotificationDeliveryRecord, 'id' | 'createdAt'>
  ): Promise<NotificationDeliveryRecord>;
  updateDeliveryStatus(
    id: string,
    status: 'SENT' | 'FAILED' | 'SUPPRESSED',
    attempts: number,
    providerMessageId?: string,
    errorCode?: string
  ): Promise<void>;
}

/**
 * High-performance In-Memory / Test implementation of IPagePulseRepository
 * with full tenant-isolation guarantees for fast unit and integration tests.
 */
export class MemoryRepository implements IPagePulseRepository {
  public users = new Map<string, UserRecord>();
  public targets = new Map<string, TargetRecord>();
  public watches = new Map<string, WatchRecord>();
  public checkRuns = new Map<string, CheckRunRecord>();
  public snapshots = new Map<string, WatchSnapshotRecord>();
  public endpoints = new Map<string, NotificationEndpointRecord>();
  public alertEvents = new Map<string, AlertEventRecord>();
  public deliveries = new Map<string, NotificationDeliveryRecord>();

  async createUser(data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserRecord> {
    const user: UserRecord = {
      id: `usr_${randomUUID()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) || null;
  }

  async findOrCreateTarget(
    canonicalUrl: string,
    targetKey: string,
    hostname: string,
    renderProfile: Record<string, unknown> = {}
  ): Promise<TargetRecord> {
    for (const t of this.targets.values()) {
      if (t.targetKey === targetKey) return t;
    }
    const target: TargetRecord = {
      id: `tgt_${randomUUID()}`,
      canonicalUrl,
      targetKey,
      hostname,
      renderProfileJson: renderProfile,
      nextFetchAt: new Date(),
      lastHealthyAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.targets.set(target.id, target);
    return target;
  }

  async getTargetById(id: string): Promise<TargetRecord | null> {
    return this.targets.get(id) || null;
  }

  async updateTargetNextFetch(id: string, nextFetchAt: Date, lastHealthyAt?: Date | null): Promise<void> {
    const target = this.targets.get(id);
    if (target) {
      target.nextFetchAt = nextFetchAt;
      if (lastHealthyAt !== undefined) {
        target.lastHealthyAt = lastHealthyAt;
      }
      target.updatedAt = new Date();
    }
  }

  async createWatch(data: Omit<WatchRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WatchRecord> {
    const watch: WatchRecord = {
      id: `wtc_${randomUUID()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.watches.set(watch.id, watch);
    return watch;
  }

  async getWatchById(id: string, userId: string): Promise<WatchRecord | null> {
    const watch = this.watches.get(id);
    if (!watch || watch.userId !== userId) return null;
    return watch;
  }

  async listWatchesByUserId(userId: string): Promise<WatchRecord[]> {
    return Array.from(this.watches.values())
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateWatch(id: string, userId: string, patch: Partial<WatchRecord>): Promise<WatchRecord | null> {
    const watch = await this.getWatchById(id, userId);
    if (!watch) return null;
    Object.assign(watch, patch, { updatedAt: new Date() });
    return watch;
  }

  async deleteWatch(id: string, userId: string): Promise<boolean> {
    const watch = await this.getWatchById(id, userId);
    if (!watch) return false;
    this.watches.delete(id);
    return true;
  }

  async findDueWatches(now: Date = new Date(), limit = 100): Promise<WatchRecord[]> {
    return Array.from(this.watches.values())
      .filter((w) => w.enabled && w.nextCheckAt <= now)
      .sort((a, b) => a.nextCheckAt.getTime() - b.nextCheckAt.getTime())
      .slice(0, limit);
  }

  async listWatchesForTarget(targetId: string): Promise<WatchRecord[]> {
    return Array.from(this.watches.values()).filter((w) => w.targetId === targetId && w.enabled);
  }

  async createCheckRun(data: Omit<CheckRunRecord, 'id' | 'createdAt'>): Promise<CheckRunRecord> {
    const run: CheckRunRecord = {
      id: `chk_${randomUUID()}`,
      ...data,
      createdAt: new Date(),
    };
    this.checkRuns.set(run.id, run);
    return run;
  }

  async getCheckRunsForTarget(targetId: string, limit = 20): Promise<CheckRunRecord[]> {
    return Array.from(this.checkRuns.values())
      .filter((r) => r.targetId === targetId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  async createSnapshot(data: Omit<WatchSnapshotRecord, 'id' | 'createdAt'>): Promise<WatchSnapshotRecord> {
    const snap: WatchSnapshotRecord = {
      id: `snp_${randomUUID()}`,
      ...data,
      createdAt: new Date(),
    };
    this.snapshots.set(snap.id, snap);
    return snap;
  }

  async getLatestSnapshotForWatch(watchId: string): Promise<WatchSnapshotRecord | null> {
    const watchSnaps = Array.from(this.snapshots.values())
      .filter((s) => s.watchId === watchId)
      .sort((a, b) => b.sequenceNo - a.sequenceNo);
    return watchSnaps[0] || null;
  }

  async listSnapshotsForWatch(watchId: string, userId: string, limit = 50): Promise<WatchSnapshotRecord[]> {
    const watch = await this.getWatchById(watchId, userId);
    if (!watch) return [];
    return Array.from(this.snapshots.values())
      .filter((s) => s.watchId === watchId)
      .sort((a, b) => b.sequenceNo - a.sequenceNo)
      .slice(0, limit);
  }

  async getSnapshotById(snapshotId: string, userId: string): Promise<WatchSnapshotRecord | null> {
    const snap = this.snapshots.get(snapshotId);
    if (!snap) return null;
    const watch = await this.getWatchById(snap.watchId, userId);
    if (!watch) return null;
    return snap;
  }

  async createNotificationEndpoint(
    data: Omit<NotificationEndpointRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<NotificationEndpointRecord> {
    const endpoint: NotificationEndpointRecord = {
      id: `nep_${randomUUID()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.endpoints.set(endpoint.id, endpoint);
    return endpoint;
  }

  async listNotificationEndpoints(userId: string): Promise<NotificationEndpointRecord[]> {
    return Array.from(this.endpoints.values()).filter((e) => e.userId === userId);
  }

  async getNotificationEndpoint(id: string, userId: string): Promise<NotificationEndpointRecord | null> {
    const ep = this.endpoints.get(id);
    if (!ep || ep.userId !== userId) return null;
    return ep;
  }

  async deleteNotificationEndpoint(id: string, userId: string): Promise<boolean> {
    const ep = await this.getNotificationEndpoint(id, userId);
    if (!ep) return false;
    this.endpoints.delete(id);
    return true;
  }

  async createAlertEvent(data: Omit<AlertEventRecord, 'id' | 'createdAt'>): Promise<AlertEventRecord> {
    for (const evt of this.alertEvents.values()) {
      if (evt.idempotencyKey === data.idempotencyKey) {
        return evt;
      }
    }
    const event: AlertEventRecord = {
      id: `alt_${randomUUID()}`,
      ...data,
      createdAt: new Date(),
    };
    this.alertEvents.set(event.id, event);
    return event;
  }

  async createNotificationDelivery(
    data: Omit<NotificationDeliveryRecord, 'id' | 'createdAt'>
  ): Promise<NotificationDeliveryRecord> {
    const delivery: NotificationDeliveryRecord = {
      id: `dlv_${randomUUID()}`,
      ...data,
      createdAt: new Date(),
    };
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  async updateDeliveryStatus(
    id: string,
    status: 'SENT' | 'FAILED' | 'SUPPRESSED',
    attempts: number,
    providerMessageId?: string,
    errorCode?: string
  ): Promise<void> {
    const dlv = this.deliveries.get(id);
    if (dlv) {
      dlv.status = status;
      dlv.attempts = attempts;
      if (providerMessageId) dlv.providerMessageId = providerMessageId;
      if (errorCode) dlv.lastErrorCode = errorCode;
      if (status === 'SENT') dlv.sentAt = new Date();
    }
  }
}
