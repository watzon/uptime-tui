import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

export const targetTypeEnum = pgEnum('target_type', [
	'http',
	'tcp',
	'icmp',
	'dns',
	'docker',
	'postgres',
	'redis',
])
export const targetStatusEnum = pgEnum('target_status', [
	'up',
	'down',
	'degraded',
	'unknown',
])
export const eventTypeEnum = pgEnum('event_type', [
	'up',
	'down',
	'degraded',
	'timeout',
	'error',
	'paused',
	'resumed',
	'certificate_expiring',
	'created',
	'updated',
	'deleted',
])

export const targets = pgTable(
	'targets',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ownerId: uuid('owner_id'),
		name: text('name').notNull(),
		type: targetTypeEnum('type').notNull(),
		config: jsonb('config').notNull(),
		intervalMs: integer('interval_ms').notNull().default(60000),
		timeoutMs: integer('timeout_ms').notNull().default(5000),
		enabled: boolean('enabled').notNull().default(true),
		failureThreshold: integer('failure_threshold').notNull().default(2),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index('targets_owner_id_idx').on(table.ownerId),
		index('targets_enabled_idx').on(table.enabled),
	],
)

export const metrics = pgTable(
	'metrics',
	{
		time: timestamp('time', { withTimezone: true }).notNull().defaultNow(),
		targetId: uuid('target_id')
			.notNull()
			.references(() => targets.id, { onDelete: 'cascade' }),
		status: targetStatusEnum('status').notNull(),
		responseTimeMs: integer('response_time_ms'),
		statusCode: integer('status_code'),
		error: text('error'),
	},
	(table) => [
		index('metrics_target_id_time_idx').on(table.targetId, table.time),
		index('metrics_time_idx').on(table.time),
	],
)

export const events = pgTable(
	'events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		targetId: uuid('target_id')
			.notNull()
			.references(() => targets.id, { onDelete: 'cascade' }),
		type: eventTypeEnum('type').notNull(),
		message: text('message').notNull(),
		metadata: jsonb('metadata').notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index('events_target_id_idx').on(table.targetId),
		index('events_created_at_idx').on(table.createdAt),
		index('events_type_idx').on(table.type),
	],
)

export const webhookConfigs = pgTable(
	'webhook_configs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ownerId: uuid('owner_id'),
		name: text('name').notNull(),
		url: text('url').notNull(),
		events: text('events').array().notNull(),
		enabled: boolean('enabled').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index('webhook_configs_owner_id_idx').on(table.ownerId)],
)

export const deliveryStatusEnum = pgEnum('delivery_status', [
	'pending',
	'success',
	'failed',
])

export const webhookDeliveries = pgTable(
	'webhook_deliveries',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		webhookId: uuid('webhook_id')
			.notNull()
			.references(() => webhookConfigs.id, { onDelete: 'cascade' }),
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		status: deliveryStatusEnum('status').notNull().default('pending'),
		attempts: integer('attempts').notNull().default(0),
		lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
		nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
		responseCode: integer('response_code'),
		responseBody: text('response_body'),
		responseTimeMs: integer('response_time_ms'),
		errorMessage: text('error_message'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index('webhook_deliveries_webhook_id_idx').on(table.webhookId),
		index('webhook_deliveries_status_retry_idx').on(
			table.status,
			table.nextRetryAt,
		),
	],
)

export const targetCurrentStatus = pgTable(
	'target_current_status',
	{
		targetId: uuid('target_id')
			.primaryKey()
			.references(() => targets.id, { onDelete: 'cascade' }),
		currentStatus: targetStatusEnum('current_status')
			.notNull()
			.default('unknown'),
		lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
		lastResponseTimeMs: integer('last_response_time_ms'),
		consecutiveFailures: integer('consecutive_failures').notNull().default(0),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index('target_current_status_idx').on(table.currentStatus)],
)

export type TargetRow = typeof targets.$inferSelect
export type NewTargetRow = typeof targets.$inferInsert
export type MetricRow = typeof metrics.$inferSelect
export type NewMetricRow = typeof metrics.$inferInsert
export type EventRow = typeof events.$inferSelect
export type NewEventRow = typeof events.$inferInsert
export type WebhookConfigRow = typeof webhookConfigs.$inferSelect
export type NewWebhookConfigRow = typeof webhookConfigs.$inferInsert
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect
export type NewWebhookDeliveryRow = typeof webhookDeliveries.$inferInsert
export type TargetStatusRow = typeof targetCurrentStatus.$inferSelect
export type NewTargetStatusRow = typeof targetCurrentStatus.$inferInsert
