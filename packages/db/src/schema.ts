import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const targets = pgTable(
  'targets',
  {
    id: text('id').primaryKey(),
    canonicalUrl: text('canonical_url').notNull(),
    targetKey: text('target_key').notNull().unique(),
    renderProfileJson: jsonb('render_profile_json').default({}).notNull(),
    hostname: text('hostname').notNull(),
    nextFetchAt: timestamp('next_fetch_at', { withTimezone: true }).defaultNow().notNull(),
    lastHealthyAt: timestamp('last_healthy_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('targets_hostname_idx').on(table.hostname),
    index('targets_next_fetch_idx').on(table.nextFetchAt),
  ]
);

export const watches = pgTable(
  'watches',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetId: text('target_id')
      .notNull()
      .references(() => targets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    intervalMinutes: integer('interval_minutes').default(60).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    sensitivity: text('sensitivity').default('normal').notNull(), // 'low' | 'normal' | 'high' | 'custom'
    includeSelectors: jsonb('include_selectors').default([]).notNull(),
    ignoreSelectors: jsonb('ignore_selectors').default([]).notNull(),
    normalizationRules: jsonb('normalization_rules').default({}).notNull(),
    status: text('status').default('UNKNOWN').notNull(), // 'OK' | 'ERROR' | 'BLOCKED' | 'PAUSED' | 'UNKNOWN'
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }).defaultNow().notNull(),
    baselineEstablishedAt: timestamp('baseline_established_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    lastChangedAt: timestamp('last_changed_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watches_user_id_idx').on(table.userId),
    index('watches_target_id_idx').on(table.targetId),
    index('watches_due_idx').on(table.enabled, table.nextCheckAt),
  ]
);

export const checkRuns = pgTable(
  'check_runs',
  {
    id: text('id').primaryKey(),
    targetId: text('target_id')
      .notNull()
      .references(() => targets.id, { onDelete: 'cascade' }),
    outcome: text('outcome').notNull(), // 'OK' | 'ERROR' | 'BLOCKED' | 'RATE_LIMITED'
    httpStatus: integer('http_status'),
    finalUrl: text('final_url'),
    durationMs: integer('duration_ms').default(0).notNull(),
    errorCode: text('error_code'),
    textHash: text('text_hash'),
    changedPixelRatio: text('changed_pixel_ratio'),
    metadataJson: jsonb('metadata_json').default({}).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('check_runs_target_id_idx').on(table.targetId),
    index('check_runs_started_at_idx').on(table.startedAt),
  ]
);

export const watchSnapshots = pgTable(
  'watch_snapshots',
  {
    id: text('id').primaryKey(),
    watchId: text('watch_id')
      .notNull()
      .references(() => watches.id, { onDelete: 'cascade' }),
    checkRunId: text('check_run_id')
      .notNull()
      .references(() => checkRuns.id, { onDelete: 'cascade' }),
    sequenceNo: integer('sequence_no').notNull(),
    contentHash: text('content_hash').notNull(),
    normalizedText: text('normalized_text').notNull(),
    screenshotObjectKey: text('screenshot_object_key'),
    previousSnapshotId: text('previous_snapshot_id'),
    changeSummaryJson: jsonb('change_summary_json').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('snapshots_watch_id_idx').on(table.watchId),
    index('snapshots_created_at_idx').on(table.createdAt),
    uniqueIndex('snapshots_watch_content_idx').on(table.watchId, table.contentHash),
  ]
);

export const artifacts = pgTable(
  'artifacts',
  {
    id: text('id').primaryKey(),
    storageKey: text('storage_key').notNull().unique(),
    checksum: text('checksum').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    retentionUntil: timestamp('retention_until', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('artifacts_retention_idx').on(table.retentionUntil)]
);

export const notificationEndpoints = pgTable(
  'notification_endpoints',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(), // 'email' | 'telegram' | 'discord'
    encryptedConfig: text('encrypted_config').notNull(), // AES-256-GCM encrypted json
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('endpoints_user_id_idx').on(table.userId)]
);

export const alertEvents = pgTable(
  'alert_events',
  {
    id: text('id').primaryKey(),
    watchId: text('watch_id')
      .notNull()
      .references(() => watches.id, { onDelete: 'cascade' }),
    snapshotId: text('snapshot_id').references(() => watchSnapshots.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'CHANGE' | 'RECOVERY' | 'INCIDENT'
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('alert_events_watch_id_idx').on(table.watchId),
    uniqueIndex('alert_events_idempotency_idx').on(table.idempotencyKey),
  ]
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: text('id').primaryKey(),
    alertEventId: text('alert_event_id')
      .notNull()
      .references(() => alertEvents.id, { onDelete: 'cascade' }),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => notificationEndpoints.id, { onDelete: 'cascade' }),
    status: text('status').default('PENDING').notNull(), // 'PENDING' | 'SENT' | 'FAILED' | 'SUPPRESSED'
    attempts: integer('attempts').default(0).notNull(),
    providerMessageId: text('provider_message_id'),
    lastErrorCode: text('last_error_code'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('deliveries_alert_idx').on(table.alertEventId),
    uniqueIndex('deliveries_alert_endpoint_idx').on(table.alertEventId, table.endpointId),
  ]
);

export const dailyDigests = pgTable(
  'daily_digests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    digestDate: text('digest_date').notNull(), // YYYY-MM-DD
    status: text('status').default('PENDING').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('daily_digests_user_date_idx').on(table.userId, table.digestDate)]
);
