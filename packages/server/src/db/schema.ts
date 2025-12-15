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

export const targetTypeEnum = pgEnum('target_type', ['http', 'tcp', 'icmp'])
export const targetStatusEnum = pgEnum('target_status', ['up', 'down', 'degraded', 'unknown'])
export const eventTypeEnum = pgEnum('event_type', ['up', 'down', 'created', 'updated', 'deleted'])

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
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('targets_owner_id_idx').on(table.ownerId), index('targets_enabled_idx').on(table.enabled)],
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
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('webhook_configs_owner_id_idx').on(table.ownerId)],
)

export const targetCurrentStatus = pgTable(
	'target_current_status',
	{
		targetId: uuid('target_id')
			.primaryKey()
			.references(() => targets.id, { onDelete: 'cascade' }),
		currentStatus: targetStatusEnum('current_status').notNull().default('unknown'),
		lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
		lastResponseTimeMs: integer('last_response_time_ms'),
		consecutiveFailures: integer('consecutive_failures').notNull().default(0),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
export type TargetStatusRow = typeof targetCurrentStatus.$inferSelect
export type NewTargetStatusRow = typeof targetCurrentStatus.$inferInsert
