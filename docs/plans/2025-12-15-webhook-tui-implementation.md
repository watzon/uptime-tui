# Webhook TUI Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add webhook management UI to the TUI client with delivery tracking, retry logic, and expanded event types.

**Architecture:** Extends existing webhook system with delivery tracking table, retry scheduler, and full TUI integration using the established Ink/React patterns. Tab navigation switches between Targets and Webhooks views.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Ink (React for terminal), Zustand

---

## Phase 1: Shared Package - Event Types

### Task 1.1: Update Event Type Schema

**Files:**
- Modify: `packages/shared/src/schemas.ts:5`
- Modify: `packages/shared/src/types.ts:3`

**Step 1: Update eventTypeSchema in schemas.ts**

Change line 5 from:
```typescript
export const eventTypeSchema = z.enum(['up', 'down', 'created', 'updated', 'deleted'])
```

To:
```typescript
export const eventTypeSchema = z.enum([
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
```

**Step 2: Update EventType in types.ts**

Change line 3 from:
```typescript
export type EventType = 'up' | 'down' | 'created' | 'updated' | 'deleted'
```

To:
```typescript
export type EventType =
	| 'up'
	| 'down'
	| 'degraded'
	| 'timeout'
	| 'error'
	| 'paused'
	| 'resumed'
	| 'certificate_expiring'
	| 'created'
	| 'updated'
	| 'deleted'
```

**Step 3: Verify types compile**

Run: `bun run --cwd packages/shared tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/types.ts
git commit -m "feat(shared): expand event types for webhooks"
```

---

## Phase 2: Server - Database Schema

### Task 2.1: Update Event Type Enum in Database

**Files:**
- Modify: `packages/server/src/db/schema.ts:15`

**Step 1: Update eventTypeEnum**

Change line 15 from:
```typescript
export const eventTypeEnum = pgEnum('event_type', ['up', 'down', 'created', 'updated', 'deleted'])
```

To:
```typescript
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
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/server tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/server/src/db/schema.ts
git commit -m "feat(server): expand event_type enum in database schema"
```

---

### Task 2.2: Add Webhook Deliveries Table

**Files:**
- Modify: `packages/server/src/db/schema.ts` (add after webhookConfigs table, around line 85)

**Step 1: Add deliveryStatusEnum and webhookDeliveries table**

Add after the `webhookConfigs` table definition (after line 85):

```typescript
export const deliveryStatusEnum = pgEnum('delivery_status', ['pending', 'success', 'failed'])

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
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('webhook_deliveries_webhook_id_idx').on(table.webhookId),
		index('webhook_deliveries_status_retry_idx').on(table.status, table.nextRetryAt),
	],
)
```

**Step 2: Add type exports**

Add after the existing type exports (around line 112):

```typescript
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect
export type NewWebhookDeliveryRow = typeof webhookDeliveries.$inferInsert
```

**Step 3: Verify types compile**

Run: `bun run --cwd packages/server tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/server/src/db/schema.ts
git commit -m "feat(server): add webhook_deliveries table for delivery tracking"
```

---

### Task 2.3: Add WebhookDelivery Type to Shared

**Files:**
- Modify: `packages/shared/src/types.ts` (add after WebhookConfig interface)

**Step 1: Add WebhookDelivery interface**

Add after the `WebhookConfig` interface (around line 101):

```typescript
export type DeliveryStatus = 'pending' | 'success' | 'failed'

export interface WebhookDelivery {
	id: string
	webhookId: string
	eventId: string
	status: DeliveryStatus
	attempts: number
	lastAttemptAt: Date | null
	nextRetryAt: Date | null
	responseCode: number | null
	responseBody: string | null
	responseTimeMs: number | null
	errorMessage: string | null
	createdAt: Date
}

export interface WebhookDeliveryWithDetails extends WebhookDelivery {
	event: Event
	targetName: string
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/shared tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add WebhookDelivery types"
```

---

### Task 2.4: Generate and Apply Migration

**Step 1: Generate migration**

Run: `bun run db:generate`
Expected: Migration file created in `packages/server/drizzle/`

**Step 2: Apply migration**

Run: `bun run db:migrate`
Expected: Migration applied successfully

**Step 3: Commit migration**

```bash
git add packages/server/drizzle/
git commit -m "chore(server): add migration for webhook_deliveries table"
```

---

## Phase 3: Server - Webhook Dispatcher with Delivery Tracking

### Task 3.1: Refactor Dispatcher to Track Deliveries

**Files:**
- Modify: `packages/server/src/webhooks/dispatcher.ts`

**Step 1: Replace entire dispatcher.ts content**

```typescript
import type { Event, EventType, Target } from '@downtime/shared'
import { and, eq, lt, lte } from 'drizzle-orm'
import { db, events, targets, webhookConfigs, webhookDeliveries } from '../db'
import { schedulerEvents } from '../scheduler'

interface WebhookPayload {
	event: EventType | 'test'
	target: {
		id: string
		name: string
		type: string
		url?: string
	}
	timestamp: string
	details: Record<string, unknown>
}

const MAX_ATTEMPTS = 4
const RETRY_DELAYS_MS = [0, 10_000, 30_000, 90_000] // immediate, 10s, 30s, 90s

function calculateNextRetryAt(attempts: number): Date | null {
	if (attempts >= MAX_ATTEMPTS) return null
	const delayMs = RETRY_DELAYS_MS[attempts] ?? 90_000
	return new Date(Date.now() + delayMs)
}

async function attemptDelivery(
	deliveryId: string,
	webhookUrl: string,
	payload: WebhookPayload,
): Promise<{ success: boolean; responseCode?: number; responseBody?: string; responseTimeMs?: number; error?: string }> {
	const startTime = Date.now()

	try {
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Downtime-Monitor/1.0',
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(10_000), // 10s timeout
		})

		const responseTimeMs = Date.now() - startTime
		const responseBody = await response.text().catch(() => '')

		return {
			success: response.ok,
			responseCode: response.status,
			responseBody: responseBody.slice(0, 1024), // Truncate to 1KB
			responseTimeMs,
			error: response.ok ? undefined : `HTTP ${response.status}`,
		}
	} catch (error) {
		return {
			success: false,
			responseTimeMs: Date.now() - startTime,
			error: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}

async function processDelivery(deliveryId: string): Promise<void> {
	// Get delivery with webhook info
	const [delivery] = await db
		.select({
			id: webhookDeliveries.id,
			webhookId: webhookDeliveries.webhookId,
			eventId: webhookDeliveries.eventId,
			attempts: webhookDeliveries.attempts,
			webhookUrl: webhookConfigs.url,
			webhookEnabled: webhookConfigs.enabled,
		})
		.from(webhookDeliveries)
		.innerJoin(webhookConfigs, eq(webhookDeliveries.webhookId, webhookConfigs.id))
		.where(eq(webhookDeliveries.id, deliveryId))
		.limit(1)

	if (!delivery || !delivery.webhookEnabled) return

	// Get event and target info for payload
	const [event] = await db
		.select()
		.from(events)
		.where(eq(events.id, delivery.eventId))
		.limit(1)

	if (!event) return

	const [target] = await db
		.select()
		.from(targets)
		.where(eq(targets.id, event.targetId))
		.limit(1)

	const config = target?.config as { url?: string; host?: string; port?: number } | undefined
	const targetUrl = config?.url ?? (config?.host ? `${config.host}:${config.port}` : undefined)

	const payload: WebhookPayload = {
		event: event.type as EventType,
		target: {
			id: event.targetId,
			name: target?.name ?? 'Unknown',
			type: target?.type ?? 'unknown',
			url: targetUrl,
		},
		timestamp: event.createdAt.toISOString(),
		details: event.metadata as Record<string, unknown>,
	}

	const result = await attemptDelivery(deliveryId, delivery.webhookUrl, payload)
	const newAttempts = delivery.attempts + 1

	if (result.success) {
		await db
			.update(webhookDeliveries)
			.set({
				status: 'success',
				attempts: newAttempts,
				lastAttemptAt: new Date(),
				nextRetryAt: null,
				responseCode: result.responseCode,
				responseBody: result.responseBody,
				responseTimeMs: result.responseTimeMs,
				errorMessage: null,
			})
			.where(eq(webhookDeliveries.id, deliveryId))
	} else {
		const nextRetryAt = calculateNextRetryAt(newAttempts)
		await db
			.update(webhookDeliveries)
			.set({
				status: nextRetryAt ? 'pending' : 'failed',
				attempts: newAttempts,
				lastAttemptAt: new Date(),
				nextRetryAt,
				responseCode: result.responseCode,
				responseBody: result.responseBody,
				responseTimeMs: result.responseTimeMs,
				errorMessage: result.error,
			})
			.where(eq(webhookDeliveries.id, deliveryId))
	}
}

async function handleEvent(event: Event): Promise<void> {
	// Get all enabled webhooks that listen to this event type
	const webhooks = await db
		.select()
		.from(webhookConfigs)
		.where(eq(webhookConfigs.enabled, true))

	const matchingWebhooks = webhooks.filter((w) => w.events.includes(event.type))

	if (matchingWebhooks.length === 0) return

	// Create delivery records and process immediately
	for (const webhook of matchingWebhooks) {
		const [delivery] = await db
			.insert(webhookDeliveries)
			.values({
				webhookId: webhook.id,
				eventId: event.id,
				status: 'pending',
				attempts: 0,
			})
			.returning()

		if (delivery) {
			// Process immediately (first attempt)
			processDelivery(delivery.id).catch((err) => {
				console.error(`Failed to process delivery ${delivery.id}:`, err)
			})
		}
	}
}

export async function processRetries(): Promise<void> {
	const now = new Date()

	const dueDeliveries = await db
		.select({ id: webhookDeliveries.id })
		.from(webhookDeliveries)
		.where(
			and(
				eq(webhookDeliveries.status, 'pending'),
				lte(webhookDeliveries.nextRetryAt, now),
				lt(webhookDeliveries.attempts, MAX_ATTEMPTS),
			),
		)
		.limit(100)

	for (const delivery of dueDeliveries) {
		processDelivery(delivery.id).catch((err) => {
			console.error(`Failed to process retry ${delivery.id}:`, err)
		})
	}
}

export async function cleanupOldDeliveries(): Promise<void> {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

	await db
		.delete(webhookDeliveries)
		.where(lt(webhookDeliveries.createdAt, sevenDaysAgo))
}

export function startWebhookDispatcher(): void {
	schedulerEvents.on('eventCreated', async (event) => {
		try {
			await handleEvent(event)
		} catch (error) {
			console.error('Error dispatching webhook:', error)
		}
	})

	// Run cleanup on startup
	cleanupOldDeliveries().catch((err) => {
		console.error('Failed to cleanup old deliveries:', err)
	})

	console.log('Webhook dispatcher started')
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/server tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/server/src/webhooks/dispatcher.ts
git commit -m "feat(server): add delivery tracking and retry logic to webhook dispatcher"
```

---

### Task 3.2: Add Retry Scheduler

**Files:**
- Create: `packages/server/src/webhooks/retry-scheduler.ts`

**Step 1: Create retry-scheduler.ts**

```typescript
import { processRetries, cleanupOldDeliveries } from './dispatcher'

let retryIntervalId: ReturnType<typeof setInterval> | null = null
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null

export function startRetryScheduler(): void {
	// Process retries every 5 seconds
	retryIntervalId = setInterval(() => {
		processRetries().catch((err) => {
			console.error('Retry scheduler error:', err)
		})
	}, 5_000)

	// Cleanup old deliveries every hour
	cleanupIntervalId = setInterval(() => {
		cleanupOldDeliveries().catch((err) => {
			console.error('Cleanup scheduler error:', err)
		})
	}, 60 * 60 * 1000)

	console.log('Webhook retry scheduler started')
}

export function stopRetryScheduler(): void {
	if (retryIntervalId) {
		clearInterval(retryIntervalId)
		retryIntervalId = null
	}
	if (cleanupIntervalId) {
		clearInterval(cleanupIntervalId)
		cleanupIntervalId = null
	}
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/server tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/server/src/webhooks/retry-scheduler.ts
git commit -m "feat(server): add webhook retry scheduler"
```

---

### Task 3.3: Export webhookDeliveries from db index

**Files:**
- Modify: `packages/server/src/db/index.ts`

**Step 1: Add webhookDeliveries export**

Find the existing exports from schema and add `webhookDeliveries`:

```typescript
export {
	// ... existing exports
	webhookDeliveries,
	deliveryStatusEnum,
} from './schema'
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/server tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/server/src/db/index.ts
git commit -m "feat(server): export webhookDeliveries from db"
```

---

### Task 3.4: Update Server Entry Point

**Files:**
- Modify: `packages/server/src/index.ts`

**Step 1: Import and start retry scheduler**

Add import at top:
```typescript
import { startRetryScheduler, stopRetryScheduler } from './webhooks/retry-scheduler'
```

**Step 2: Start retry scheduler in main()**

Add after `startWebhookDispatcher()`:
```typescript
startRetryScheduler()
```

**Step 3: Stop retry scheduler in shutdown handlers**

Add `stopRetryScheduler()` in both SIGTERM and SIGINT handlers, before `process.exit(0)`.

**Step 4: Verify types compile**

Run: `bun run --cwd packages/server tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): integrate retry scheduler into server lifecycle"
```

---

## Phase 4: Server - tRPC Routes for Deliveries

### Task 4.1: Add Deliveries Query to Webhooks Router

**Files:**
- Modify: `packages/server/src/trpc/routers/webhooks.ts`

**Step 1: Add imports**

Add to existing imports:
```typescript
import { desc } from 'drizzle-orm'
import { events, targets, webhookDeliveries } from '../../db'
import type { WebhookDeliveryWithDetails } from '@downtime/shared'
```

**Step 2: Add deliveries procedure**

Add after the `test` procedure:

```typescript
deliveries: protectedProcedure
	.input(
		z.object({
			webhookId: z.string().uuid(),
			limit: z.number().int().min(1).max(100).optional().default(20),
			cursor: z.string().uuid().optional(),
		}),
	)
	.query(async ({ input }): Promise<{ items: WebhookDeliveryWithDetails[]; nextCursor?: string }> => {
		const query = db
			.select({
				delivery: webhookDeliveries,
				event: events,
				targetName: targets.name,
			})
			.from(webhookDeliveries)
			.innerJoin(events, eq(webhookDeliveries.eventId, events.id))
			.leftJoin(targets, eq(events.targetId, targets.id))
			.where(eq(webhookDeliveries.webhookId, input.webhookId))
			.orderBy(desc(webhookDeliveries.createdAt))
			.limit(input.limit + 1)

		const results = await query

		const hasMore = results.length > input.limit
		const items = hasMore ? results.slice(0, -1) : results

		return {
			items: items.map((r) => ({
				...r.delivery,
				event: {
					...r.event,
					metadata: r.event.metadata as Record<string, unknown>,
				},
				targetName: r.targetName ?? 'Unknown',
			})),
			nextCursor: hasMore ? items[items.length - 1]?.delivery.id : undefined,
		}
	}),
```

**Step 3: Update test procedure to return more details**

Replace the `test` procedure with:

```typescript
test: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
	const [webhook] = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, input.id)).limit(1)

	if (!webhook) {
		throw new Error('Webhook not found')
	}

	const testPayload = {
		event: 'test',
		target: { id: 'test-id', name: 'Test Target', type: 'http', url: 'https://example.com' },
		timestamp: new Date().toISOString(),
		details: { message: 'This is a test webhook' },
	}

	const startTime = Date.now()

	try {
		const response = await fetch(webhook.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Downtime-Monitor/1.0',
			},
			body: JSON.stringify(testPayload),
			signal: AbortSignal.timeout(10_000),
		})

		const responseTimeMs = Date.now() - startTime
		const responseBody = await response.text().catch(() => '')

		return {
			success: response.ok,
			statusCode: response.status,
			statusText: response.statusText,
			responseTimeMs,
			responseBody: responseBody.slice(0, 1024),
			error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
		}
	} catch (error) {
		return {
			success: false,
			statusCode: undefined,
			statusText: undefined,
			responseTimeMs: Date.now() - startTime,
			responseBody: undefined,
			error: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}),
```

**Step 4: Verify types compile**

Run: `bun run --cwd packages/server tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add packages/server/src/trpc/routers/webhooks.ts
git commit -m "feat(server): add deliveries query and improve test endpoint"
```

---

## Phase 5: TUI Client - Store Updates

### Task 5.1: Add Webhook State to Store

**Files:**
- Modify: `packages/tui-client/src/stores/app.ts`

**Step 1: Add webhook imports**

Add to imports:
```typescript
import type { Event, Metric, TargetWithStatus, UptimeSummary, WebhookConfig, WebhookDeliveryWithDetails } from '@downtime/shared'
```

**Step 2: Update types**

Change the `View` type to:
```typescript
type View = 'dashboard' | 'add-target' | 'edit-target' | 'help' | 'add-webhook' | 'edit-webhook' | 'webhook-detail' | 'test-webhook'
type Tab = 'targets' | 'webhooks'
```

**Step 3: Add webhook state to AppState interface**

Add after existing state properties:
```typescript
// Tab navigation
activeTab: Tab

// Webhook state
webhooks: WebhookConfig[]
selectedWebhookId: string | null
selectedWebhookDeliveries: WebhookDeliveryWithDetails[]
webhookDeliveriesLoading: boolean
```

**Step 4: Add webhook actions to AppState interface**

Add after existing actions:
```typescript
setActiveTab: (tab: Tab) => void
setWebhooks: (webhooks: WebhookConfig[]) => void
updateWebhook: (webhook: WebhookConfig) => void
removeWebhook: (id: string) => void
setSelectedWebhookId: (id: string | null) => void
setSelectedWebhookDeliveries: (deliveries: WebhookDeliveryWithDetails[]) => void
setWebhookDeliveriesLoading: (loading: boolean) => void
selectNextWebhook: () => void
selectPrevWebhook: () => void
```

**Step 5: Add initial state values**

Add to the initial state in `create<AppState>`:
```typescript
activeTab: 'targets',
webhooks: [],
selectedWebhookId: null,
selectedWebhookDeliveries: [],
webhookDeliveriesLoading: false,
```

**Step 6: Add action implementations**

Add implementations:
```typescript
setActiveTab: (tab) => set({ activeTab: tab }),

setWebhooks: (webhooks) => {
	const state = get()
	set({ webhooks })
	if (!state.selectedWebhookId && webhooks.length > 0) {
		set({ selectedWebhookId: webhooks[0]?.id ?? null })
	}
},

updateWebhook: (webhook) =>
	set((state) => ({
		webhooks: state.webhooks.map((w) => (w.id === webhook.id ? webhook : w)),
	})),

removeWebhook: (id) =>
	set((state) => {
		const newWebhooks = state.webhooks.filter((w) => w.id !== id)
		const newSelectedId = state.selectedWebhookId === id ? (newWebhooks[0]?.id ?? null) : state.selectedWebhookId
		return { webhooks: newWebhooks, selectedWebhookId: newSelectedId }
	}),

setSelectedWebhookId: (id) => set({ selectedWebhookId: id, selectedWebhookDeliveries: [], webhookDeliveriesLoading: true }),

setSelectedWebhookDeliveries: (deliveries) => set({ selectedWebhookDeliveries: deliveries, webhookDeliveriesLoading: false }),

setWebhookDeliveriesLoading: (loading) => set({ webhookDeliveriesLoading: loading }),

selectNextWebhook: () => {
	const state = get()
	const currentIndex = state.webhooks.findIndex((w) => w.id === state.selectedWebhookId)
	const nextIndex = (currentIndex + 1) % state.webhooks.length
	const nextWebhook = state.webhooks[nextIndex]
	if (nextWebhook) {
		set({ selectedWebhookId: nextWebhook.id, selectedWebhookDeliveries: [], webhookDeliveriesLoading: true })
	}
},

selectPrevWebhook: () => {
	const state = get()
	const currentIndex = state.webhooks.findIndex((w) => w.id === state.selectedWebhookId)
	const prevIndex = currentIndex <= 0 ? state.webhooks.length - 1 : currentIndex - 1
	const prevWebhook = state.webhooks[prevIndex]
	if (prevWebhook) {
		set({ selectedWebhookId: prevWebhook.id, selectedWebhookDeliveries: [], webhookDeliveriesLoading: true })
	}
},
```

**Step 7: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add packages/tui-client/src/stores/app.ts
git commit -m "feat(tui): add webhook state to store"
```

---

## Phase 6: TUI Client - Data Loading

### Task 6.1: Add Webhook Data Loading

**Files:**
- Modify: `packages/tui-client/src/hooks/useData.ts`

**Step 1: Add webhook parser**

Add after `parseMetric` function:
```typescript
function parseWebhook(raw: Record<string, unknown>): WebhookConfig {
	return {
		...raw,
		createdAt: new Date(raw.createdAt as string),
		updatedAt: new Date(raw.updatedAt as string),
	} as WebhookConfig
}

function parseDelivery(raw: Record<string, unknown>): WebhookDeliveryWithDetails {
	const delivery = raw as Record<string, unknown>
	const event = delivery.event as Record<string, unknown>
	return {
		...delivery,
		createdAt: new Date(delivery.createdAt as string),
		lastAttemptAt: delivery.lastAttemptAt ? new Date(delivery.lastAttemptAt as string) : null,
		nextRetryAt: delivery.nextRetryAt ? new Date(delivery.nextRetryAt as string) : null,
		event: {
			...event,
			createdAt: new Date(event.createdAt as string),
		},
	} as WebhookDeliveryWithDetails
}
```

**Step 2: Update imports**

Add to imports:
```typescript
import type { Event, Metric, TargetWithStatus, WebhookConfig, WebhookDeliveryWithDetails } from '@downtime/shared'
```

**Step 3: Load webhooks in useLoadData**

Update the `useLoadData` function to also load webhooks:

```typescript
export function useLoadData() {
	const { setTargets, setEvents, setWebhooks, setConnectionStatus, setError } = useAppStore()

	useEffect(() => {
		async function load() {
			try {
				setConnectionStatus('connecting')

				const [targetsResult, eventsResult, webhooksResult] = await Promise.all([
					trpc.targets.list.query(),
					trpc.events.list.query({ limit: 50 }),
					trpc.webhooks.list.query(),
				])

				setTargets(targetsResult.map((t) => parseTarget(t as unknown as Record<string, unknown>)))
				setEvents(eventsResult.items.map((e) => parseEvent(e as unknown as Record<string, unknown>)))
				setWebhooks(webhooksResult.map((w) => parseWebhook(w as unknown as Record<string, unknown>)))
				setConnectionStatus('connected')
			} catch (error) {
				setConnectionStatus('error')
				setError(error instanceof Error ? error.message : 'Failed to connect to server')
			}
		}

		load()
	}, [setTargets, setEvents, setWebhooks, setConnectionStatus, setError])
}
```

**Step 4: Add useLoadDeliveries hook**

Add new export:
```typescript
export function useLoadDeliveries(webhookId: string | null) {
	const { setSelectedWebhookDeliveries, setWebhookDeliveriesLoading } = useAppStore()

	useEffect(() => {
		if (!webhookId) {
			setSelectedWebhookDeliveries([])
			return
		}

		setWebhookDeliveriesLoading(true)

		async function load() {
			try {
				const result = await trpc.webhooks.deliveries.query({
					webhookId: webhookId!,
					limit: 50,
				})

				setSelectedWebhookDeliveries(
					result.items.map((d) => parseDelivery(d as unknown as Record<string, unknown>)),
				)
			} catch (error) {
				log('Failed to load deliveries:', error)
				setWebhookDeliveriesLoading(false)
			}
		}

		load()
	}, [webhookId, setSelectedWebhookDeliveries, setWebhookDeliveriesLoading])
}
```

**Step 5: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add packages/tui-client/src/hooks/useData.ts
git commit -m "feat(tui): add webhook and delivery data loading"
```

---

## Phase 7: TUI Client - Tab Navigation

### Task 7.1: Create TabBar Component

**Files:**
- Create: `packages/tui-client/src/components/TabBar.tsx`

**Step 1: Create TabBar.tsx**

```typescript
import { Box, Text, useInput } from 'ink'
import { useAppStore } from '../stores/app'

const TABS = [
	{ key: 'targets', label: 'Targets', shortcut: '1' },
	{ key: 'webhooks', label: 'Webhooks', shortcut: '2' },
] as const

export function TabBar() {
	const { activeTab, setActiveTab, view } = useAppStore()

	useInput(
		(input, key) => {
			if (view !== 'dashboard') return

			if (input === '1') {
				setActiveTab('targets')
			} else if (input === '2') {
				setActiveTab('webhooks')
			} else if (key.tab && !key.shift) {
				const currentIndex = TABS.findIndex((t) => t.key === activeTab)
				const nextIndex = (currentIndex + 1) % TABS.length
				setActiveTab(TABS[nextIndex]!.key)
			} else if (key.tab && key.shift) {
				const currentIndex = TABS.findIndex((t) => t.key === activeTab)
				const prevIndex = currentIndex <= 0 ? TABS.length - 1 : currentIndex - 1
				setActiveTab(TABS[prevIndex]!.key)
			}
		},
		{ isActive: view === 'dashboard' },
	)

	return (
		<Box paddingX={1} gap={2}>
			{TABS.map((tab) => (
				<Box key={tab.key}>
					<Text
						bold={activeTab === tab.key}
						color={activeTab === tab.key ? 'cyan' : 'gray'}
						inverse={activeTab === tab.key}
					>
						{' '}
						{tab.label} ({tab.shortcut}){' '}
					</Text>
				</Box>
			))}
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/TabBar.tsx
git commit -m "feat(tui): add TabBar component for navigation"
```

---

### Task 7.2: Update Header to Include TabBar

**Files:**
- Modify: `packages/tui-client/src/components/Header.tsx`

**Step 1: Update Header.tsx**

```typescript
import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'
import { TabBar } from './TabBar'

export function Header() {
	const { connectionStatus, targets } = useAppStore()

	const statusColor =
		connectionStatus === 'connected' ? 'green' : connectionStatus === 'error' ? 'red' : 'yellow'

	const upCount = targets.filter((t) => t.currentStatus === 'up').length
	const downCount = targets.filter((t) => t.currentStatus === 'down').length

	return (
		<Box flexDirection="column">
			<Box borderStyle="single" paddingX={1} justifyContent="space-between">
				<Text bold>Downtime Monitor</Text>
				<Box>
					<Text color="green">{upCount} up</Text>
					<Text> | </Text>
					<Text color="red">{downCount} down</Text>
					<Text> | </Text>
					<Text color={statusColor}>{connectionStatus}</Text>
				</Box>
			</Box>
			<TabBar />
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/Header.tsx
git commit -m "feat(tui): integrate TabBar into Header"
```

---

## Phase 8: TUI Client - Webhook List

### Task 8.1: Create WebhookRow Component

**Files:**
- Create: `packages/tui-client/src/components/WebhookRow.tsx`

**Step 1: Create WebhookRow.tsx**

```typescript
import { Box, Text } from 'ink'
import type { WebhookConfig } from '@downtime/shared'

interface WebhookRowProps {
	webhook: WebhookConfig
	isSelected: boolean
}

export function WebhookRow({ webhook, isSelected }: WebhookRowProps) {
	// Truncate URL for display
	const displayUrl = webhook.url.length > 35 ? `${webhook.url.slice(0, 32)}...` : webhook.url

	return (
		<Box paddingX={1}>
			<Text color={isSelected ? 'cyan' : undefined} bold={isSelected} inverse={isSelected}>
				{webhook.enabled ? '●' : '○'} {webhook.name.padEnd(20).slice(0, 20)} {displayUrl}
			</Text>
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/WebhookRow.tsx
git commit -m "feat(tui): add WebhookRow component"
```

---

### Task 8.2: Create WebhookList Component

**Files:**
- Create: `packages/tui-client/src/components/WebhookList.tsx`

**Step 1: Create WebhookList.tsx**

```typescript
import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'
import { WebhookRow } from './WebhookRow'

export function WebhookList() {
	const webhooks = useAppStore((state) => state.webhooks)
	const selectedWebhookId = useAppStore((state) => state.selectedWebhookId)

	if (webhooks.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text dimColor>No webhooks configured</Text>
				<Text dimColor>Press 'a' to add a webhook</Text>
			</Box>
		)
	}

	return (
		<Box flexDirection="column">
			{webhooks.map((webhook) => (
				<WebhookRow key={webhook.id} webhook={webhook} isSelected={webhook.id === selectedWebhookId} />
			))}
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/WebhookList.tsx
git commit -m "feat(tui): add WebhookList component"
```

---

### Task 8.3: Create WebhookDetailPanel Component

**Files:**
- Create: `packages/tui-client/src/components/WebhookDetailPanel.tsx`

**Step 1: Create WebhookDetailPanel.tsx**

```typescript
import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'
import { useLoadDeliveries } from '../hooks/useData'

function formatRelativeTime(date: Date): string {
	const now = Date.now()
	const diff = now - date.getTime()
	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(diff / 3600000)
	const days = Math.floor(diff / 86400000)

	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes}m ago`
	if (hours < 24) return `${hours}h ago`
	return `${days}d ago`
}

export function WebhookDetailPanel() {
	const webhooks = useAppStore((state) => state.webhooks)
	const selectedWebhookId = useAppStore((state) => state.selectedWebhookId)
	const deliveries = useAppStore((state) => state.selectedWebhookDeliveries)
	const loading = useAppStore((state) => state.webhookDeliveriesLoading)

	useLoadDeliveries(selectedWebhookId)

	const webhook = webhooks.find((w) => w.id === selectedWebhookId)

	if (!webhook) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text dimColor>Select a webhook to view details</Text>
			</Box>
		)
	}

	const recentDeliveries = deliveries.slice(0, 5)
	const successCount = recentDeliveries.filter((d) => d.status === 'success').length

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold>{webhook.enabled ? '●' : '○'} {webhook.name}</Text>
			</Box>

			<Box marginBottom={1} flexDirection="column">
				<Box>
					<Text dimColor>URL: </Text>
					<Text>{webhook.url}</Text>
				</Box>
				<Box>
					<Text dimColor>Events: </Text>
					<Text>{webhook.events.join(', ')}</Text>
				</Box>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>Recent: </Text>
				{loading ? (
					<Text dimColor>Loading...</Text>
				) : recentDeliveries.length === 0 ? (
					<Text dimColor>No deliveries yet</Text>
				) : (
					<Text>
						{recentDeliveries.map((d) => (
							<Text key={d.id} color={d.status === 'success' ? 'green' : d.status === 'failed' ? 'red' : 'yellow'}>
								{d.status === 'success' ? '✓' : d.status === 'failed' ? '✗' : '◌'}
							</Text>
						))}
						<Text dimColor> ({successCount}/{recentDeliveries.length} successful)</Text>
					</Text>
				)}
			</Box>

			{deliveries.length > 0 && (
				<Box>
					<Text dimColor>Last delivery: </Text>
					<Text>{formatRelativeTime(deliveries[0]!.createdAt)}</Text>
					<Text dimColor> ({deliveries[0]!.status})</Text>
				</Box>
			)}
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/WebhookDetailPanel.tsx
git commit -m "feat(tui): add WebhookDetailPanel component"
```

---

## Phase 9: TUI Client - Layout Integration

### Task 9.1: Update Layout for Tab Switching

**Files:**
- Modify: `packages/tui-client/src/components/Layout.tsx`

**Step 1: Update Layout.tsx**

```typescript
import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { Header } from './Header'
import { Footer } from './Footer'
import { TargetList } from './TargetList'
import { DetailPanel } from './DetailPanel'
import { EventLog } from './EventLog'
import { WebhookList } from './WebhookList'
import { WebhookDetailPanel } from './WebhookDetailPanel'

export function Layout() {
	const { view, activeTab } = useAppStore()
	const { width, height } = useTerminalSize()

	if (view !== 'dashboard') {
		return null
	}

	const isTargetsTab = activeTab === 'targets'

	return (
		<Box flexDirection="column" height={height}>
			<Header />

			<Box flexGrow={1} flexDirection="row">
				<Box width="40%" borderStyle="single" flexDirection="column">
					<Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
						<Text bold>{isTargetsTab ? 'Targets' : 'Webhooks'}</Text>
					</Box>
					<Box flexGrow={1} overflow="hidden">
						{isTargetsTab ? <TargetList /> : <WebhookList />}
					</Box>
				</Box>

				<Box width="60%" flexDirection="column">
					<Box flexGrow={1} borderStyle="single">
						<Box flexDirection="column" width="100%">
							<Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
								<Text bold>Details</Text>
							</Box>
							{isTargetsTab ? <DetailPanel /> : <WebhookDetailPanel />}
						</Box>
					</Box>

					<Box height={8} borderStyle="single">
						<Box flexDirection="column" width="100%">
							<Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
								<Text bold>Events</Text>
							</Box>
							<EventLog />
						</Box>
					</Box>
				</Box>
			</Box>

			<Footer />
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/Layout.tsx
git commit -m "feat(tui): update Layout to support tab switching"
```

---

### Task 9.2: Update Keyboard Hook for Webhooks

**Files:**
- Modify: `packages/tui-client/src/hooks/useKeyboard.ts`

**Step 1: Update useKeyboard.ts**

```typescript
import { useInput } from 'ink'
import { useAppStore } from '../stores/app'
import { trpc } from '../lib/trpc'

export function useKeyboard() {
	const {
		view,
		setView,
		activeTab,
		selectNextTarget,
		selectPrevTarget,
		selectedTargetId,
		removeTarget,
		setTargets,
		selectNextWebhook,
		selectPrevWebhook,
		selectedWebhookId,
		removeWebhook,
		setWebhooks,
	} = useAppStore()

	useInput(async (input, key) => {
		if (view !== 'dashboard') return

		// Navigation - works for both tabs
		if (key.downArrow || input === 'j') {
			if (activeTab === 'targets') {
				selectNextTarget()
			} else {
				selectNextWebhook()
			}
		} else if (key.upArrow || input === 'k') {
			if (activeTab === 'targets') {
				selectPrevTarget()
			} else {
				selectPrevWebhook()
			}
		}

		// Actions based on active tab
		if (activeTab === 'targets') {
			if (input === 'a') {
				setView('add-target')
			} else if (input === 'e' && selectedTargetId) {
				setView('edit-target')
			} else if (input === 'd' && selectedTargetId) {
				try {
					await trpc.targets.delete.mutate({ id: selectedTargetId })
					removeTarget(selectedTargetId)
				} catch (err) {
					console.error('Failed to delete target:', err)
				}
			} else if (input === 'r') {
				try {
					const targets = await trpc.targets.list.query()
					setTargets(
						targets.map((t) => ({
							...t,
							createdAt: new Date(t.createdAt as unknown as string),
							updatedAt: new Date(t.updatedAt as unknown as string),
							lastCheckedAt: t.lastCheckedAt ? new Date(t.lastCheckedAt as unknown as string) : null,
						})),
					)
				} catch (err) {
					console.error('Failed to refresh targets:', err)
				}
			}
		} else {
			// Webhooks tab
			if (input === 'a') {
				setView('add-webhook')
			} else if (input === 'e' && selectedWebhookId) {
				setView('edit-webhook')
			} else if (input === 'd' && selectedWebhookId) {
				try {
					await trpc.webhooks.delete.mutate({ id: selectedWebhookId })
					removeWebhook(selectedWebhookId)
				} catch (err) {
					console.error('Failed to delete webhook:', err)
				}
			} else if (input === 't' && selectedWebhookId) {
				setView('test-webhook')
			} else if (input === 'r') {
				try {
					const webhooks = await trpc.webhooks.list.query()
					setWebhooks(
						webhooks.map((w) => ({
							...w,
							createdAt: new Date(w.createdAt as unknown as string),
							updatedAt: new Date(w.updatedAt as unknown as string),
						})),
					)
				} catch (err) {
					console.error('Failed to refresh webhooks:', err)
				}
			} else if (key.return && selectedWebhookId) {
				setView('webhook-detail')
			}
		}

		// Global shortcuts
		if (input === '?') {
			setView('help')
		} else if (input === 'q') {
			process.exit(0)
		}
	})
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/hooks/useKeyboard.ts
git commit -m "feat(tui): update keyboard handler for webhook navigation"
```

---

## Phase 10: TUI Client - Webhook Forms

### Task 10.1: Create CheckboxField Component

**Files:**
- Create: `packages/tui-client/src/components/CheckboxField.tsx`

**Step 1: Create CheckboxField.tsx**

```typescript
import { Box, Text, useInput } from 'ink'

interface CheckboxOption {
	value: string
	label: string
}

interface CheckboxFieldProps {
	label: string
	options: CheckboxOption[]
	selected: string[]
	onChange: (selected: string[]) => void
	isFocused: boolean
	focusedIndex: number
	onFocusedIndexChange: (index: number) => void
	onSubmit?: () => void
}

export function CheckboxField({
	label,
	options,
	selected,
	onChange,
	isFocused,
	focusedIndex,
	onFocusedIndexChange,
	onSubmit,
}: CheckboxFieldProps) {
	useInput(
		(input, key) => {
			if (!isFocused) return

			if (key.leftArrow || input === 'h') {
				const newIndex = focusedIndex > 0 ? focusedIndex - 1 : options.length - 1
				onFocusedIndexChange(newIndex)
			} else if (key.rightArrow || input === 'l') {
				const newIndex = focusedIndex < options.length - 1 ? focusedIndex + 1 : 0
				onFocusedIndexChange(newIndex)
			} else if (input === ' ') {
				const option = options[focusedIndex]
				if (option) {
					const isSelected = selected.includes(option.value)
					if (isSelected) {
						onChange(selected.filter((v) => v !== option.value))
					} else {
						onChange([...selected, option.value])
					}
				}
			} else if (key.return) {
				onSubmit?.()
			}
		},
		{ isActive: isFocused },
	)

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Text color={isFocused ? 'cyan' : undefined} bold={isFocused}>
				{isFocused ? '> ' : '  '}
				{label}:
			</Text>
			<Box marginLeft={4} flexWrap="wrap">
				{options.map((option, index) => {
					const isChecked = selected.includes(option.value)
					const isHighlighted = isFocused && index === focusedIndex

					return (
						<Box key={option.value} marginRight={2}>
							<Text
								color={isHighlighted ? 'cyan' : undefined}
								bold={isHighlighted}
								inverse={isHighlighted}
							>
								[{isChecked ? '✓' : ' '}] {option.label}
							</Text>
						</Box>
					)
				})}
			</Box>
			{isFocused && (
				<Box marginLeft={4}>
					<Text dimColor>Use left/right to navigate, space to toggle</Text>
				</Box>
			)}
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/CheckboxField.tsx
git commit -m "feat(tui): add CheckboxField component for multi-select"
```

---

### Task 10.2: Create AddWebhookForm Component

**Files:**
- Create: `packages/tui-client/src/components/AddWebhookForm.tsx`

**Step 1: Create AddWebhookForm.tsx**

```typescript
import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { EventType } from '@downtime/shared'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'
import { FormField } from './FormField'
import { CheckboxField } from './CheckboxField'

const EVENT_OPTIONS = [
	{ value: 'up', label: 'Up' },
	{ value: 'down', label: 'Down' },
	{ value: 'degraded', label: 'Degraded' },
	{ value: 'timeout', label: 'Timeout' },
	{ value: 'error', label: 'Error' },
	{ value: 'paused', label: 'Paused' },
	{ value: 'resumed', label: 'Resumed' },
	{ value: 'certificate_expiring', label: 'Cert Expiring' },
	{ value: 'created', label: 'Created' },
	{ value: 'updated', label: 'Updated' },
	{ value: 'deleted', label: 'Deleted' },
]

type FieldName = 'name' | 'url' | 'events' | 'enabled'

const FIELDS: FieldName[] = ['name', 'url', 'events', 'enabled']

export function AddWebhookForm() {
	const { setView, setWebhooks, webhooks } = useAppStore()

	const [name, setName] = useState('')
	const [url, setUrl] = useState('')
	const [events, setEvents] = useState<string[]>(['up', 'down'])
	const [enabled, setEnabled] = useState(true)

	const [errors, setErrors] = useState<Record<string, string | null>>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const [focusedField, setFocusedField] = useState<FieldName>('name')
	const [eventsFocusIndex, setEventsFocusIndex] = useState(0)

	const focusedIndex = FIELDS.indexOf(focusedField)

	const validate = (): boolean => {
		const newErrors: Record<string, string | null> = {}

		if (name.trim().length === 0) {
			newErrors.name = 'Name is required'
		} else if (name.length > 100) {
			newErrors.name = 'Name must be 100 characters or less'
		}

		try {
			new URL(url)
		} catch {
			newErrors.url = 'Please enter a valid URL'
		}

		if (events.length === 0) {
			newErrors.events = 'At least one event must be selected'
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = async () => {
		if (!validate()) return

		setIsSubmitting(true)
		try {
			const newWebhook = await trpc.webhooks.create.mutate({
				name: name.trim(),
				url: url.trim(),
				events: events as EventType[],
				enabled,
			})

			setWebhooks([
				...webhooks,
				{
					...newWebhook,
					createdAt: new Date(newWebhook.createdAt as unknown as string),
					updatedAt: new Date(newWebhook.updatedAt as unknown as string),
				},
			])
			setView('dashboard')
		} catch (err) {
			setErrors({ submit: err instanceof Error ? err.message : 'Failed to create webhook' })
			setIsSubmitting(false)
		}
	}

	const handleFieldSubmit = () => {
		if (focusedIndex < FIELDS.length - 1) {
			setFocusedField(FIELDS[focusedIndex + 1]!)
		} else {
			handleSubmit()
		}
	}

	useInput((input, key) => {
		if (key.escape) {
			setView('dashboard')
			return
		}

		// Handle events field navigation separately
		if (focusedField === 'events') {
			if (key.upArrow || (key.tab && key.shift)) {
				const prevIndex = Math.max(0, focusedIndex - 1)
				setFocusedField(FIELDS[prevIndex]!)
			} else if (key.downArrow || key.tab) {
				const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
				setFocusedField(FIELDS[nextIndex]!)
			}
			return
		}

		// Handle enabled field
		if (focusedField === 'enabled') {
			if (input === ' ' || key.leftArrow || key.rightArrow) {
				setEnabled(!enabled)
			} else if (key.upArrow || (key.tab && key.shift)) {
				const prevIndex = Math.max(0, focusedIndex - 1)
				setFocusedField(FIELDS[prevIndex]!)
			} else if (key.return) {
				handleSubmit()
			}
			return
		}

		// Standard field navigation
		if (key.upArrow || (key.tab && key.shift)) {
			const prevIndex = Math.max(0, focusedIndex - 1)
			setFocusedField(FIELDS[prevIndex]!)
		} else if (key.downArrow || key.tab) {
			const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
			setFocusedField(FIELDS[nextIndex]!)
		}
	})

	const footer = (
		<Text dimColor>
			Tab/Arrows: navigate | Space: toggle | Enter: {focusedIndex === FIELDS.length - 1 ? 'submit' : 'next'} | Esc: cancel
		</Text>
	)

	return (
		<Modal title="Add New Webhook" width={70} footer={footer}>
			{errors.submit && (
				<Box marginBottom={1}>
					<Text color="red">{errors.submit}</Text>
				</Box>
			)}

			<FormField
				label="Name"
				value={name}
				onChange={setName}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'name'}
				error={errors.name}
				placeholder="Discord Alerts"
			/>

			<FormField
				label="URL"
				value={url}
				onChange={setUrl}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'url'}
				error={errors.url}
				placeholder="https://discord.com/api/webhooks/..."
			/>

			<CheckboxField
				label="Events"
				options={EVENT_OPTIONS}
				selected={events}
				onChange={setEvents}
				isFocused={focusedField === 'events'}
				focusedIndex={eventsFocusIndex}
				onFocusedIndexChange={setEventsFocusIndex}
				onSubmit={handleFieldSubmit}
			/>
			{errors.events && (
				<Box marginLeft={4} marginBottom={1}>
					<Text color="red">{errors.events}</Text>
				</Box>
			)}

			<Box marginBottom={1}>
				<Text color={focusedField === 'enabled' ? 'cyan' : undefined} bold={focusedField === 'enabled'}>
					{focusedField === 'enabled' ? '> ' : '  '}
					Enabled:{' '}
				</Text>
				<Text>
					({enabled ? '●' : ' '}) Yes {'  '}
					({!enabled ? '●' : ' '}) No
				</Text>
			</Box>

			{isSubmitting && (
				<Box marginTop={1}>
					<Text color="cyan">Creating webhook...</Text>
				</Box>
			)}
		</Modal>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/AddWebhookForm.tsx
git commit -m "feat(tui): add AddWebhookForm component"
```

---

### Task 10.3: Create EditWebhookForm Component

**Files:**
- Create: `packages/tui-client/src/components/EditWebhookForm.tsx`

**Step 1: Create EditWebhookForm.tsx**

```typescript
import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { EventType } from '@downtime/shared'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'
import { FormField } from './FormField'
import { CheckboxField } from './CheckboxField'

const EVENT_OPTIONS = [
	{ value: 'up', label: 'Up' },
	{ value: 'down', label: 'Down' },
	{ value: 'degraded', label: 'Degraded' },
	{ value: 'timeout', label: 'Timeout' },
	{ value: 'error', label: 'Error' },
	{ value: 'paused', label: 'Paused' },
	{ value: 'resumed', label: 'Resumed' },
	{ value: 'certificate_expiring', label: 'Cert Expiring' },
	{ value: 'created', label: 'Created' },
	{ value: 'updated', label: 'Updated' },
	{ value: 'deleted', label: 'Deleted' },
]

type FieldName = 'name' | 'url' | 'events' | 'enabled'

const FIELDS: FieldName[] = ['name', 'url', 'events', 'enabled']

export function EditWebhookForm() {
	const { setView, updateWebhook, webhooks, selectedWebhookId } = useAppStore()

	const webhook = webhooks.find((w) => w.id === selectedWebhookId)

	const [name, setName] = useState(webhook?.name ?? '')
	const [url, setUrl] = useState(webhook?.url ?? '')
	const [events, setEvents] = useState<string[]>(webhook?.events ?? ['up', 'down'])
	const [enabled, setEnabled] = useState(webhook?.enabled ?? true)

	const [errors, setErrors] = useState<Record<string, string | null>>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const [focusedField, setFocusedField] = useState<FieldName>('name')
	const [eventsFocusIndex, setEventsFocusIndex] = useState(0)

	const focusedIndex = FIELDS.indexOf(focusedField)

	if (!webhook) {
		return (
			<Modal title="Edit Webhook" width={70}>
				<Text color="red">Webhook not found</Text>
			</Modal>
		)
	}

	const validate = (): boolean => {
		const newErrors: Record<string, string | null> = {}

		if (name.trim().length === 0) {
			newErrors.name = 'Name is required'
		} else if (name.length > 100) {
			newErrors.name = 'Name must be 100 characters or less'
		}

		try {
			new URL(url)
		} catch {
			newErrors.url = 'Please enter a valid URL'
		}

		if (events.length === 0) {
			newErrors.events = 'At least one event must be selected'
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = async () => {
		if (!validate()) return

		setIsSubmitting(true)
		try {
			const updatedWebhook = await trpc.webhooks.update.mutate({
				id: webhook.id,
				name: name.trim(),
				url: url.trim(),
				events: events as EventType[],
				enabled,
			})

			updateWebhook({
				...updatedWebhook,
				createdAt: new Date(updatedWebhook.createdAt as unknown as string),
				updatedAt: new Date(updatedWebhook.updatedAt as unknown as string),
			})
			setView('dashboard')
		} catch (err) {
			setErrors({ submit: err instanceof Error ? err.message : 'Failed to update webhook' })
			setIsSubmitting(false)
		}
	}

	const handleFieldSubmit = () => {
		if (focusedIndex < FIELDS.length - 1) {
			setFocusedField(FIELDS[focusedIndex + 1]!)
		} else {
			handleSubmit()
		}
	}

	useInput((input, key) => {
		if (key.escape) {
			setView('dashboard')
			return
		}

		if (focusedField === 'events') {
			if (key.upArrow || (key.tab && key.shift)) {
				const prevIndex = Math.max(0, focusedIndex - 1)
				setFocusedField(FIELDS[prevIndex]!)
			} else if (key.downArrow || key.tab) {
				const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
				setFocusedField(FIELDS[nextIndex]!)
			}
			return
		}

		if (focusedField === 'enabled') {
			if (input === ' ' || key.leftArrow || key.rightArrow) {
				setEnabled(!enabled)
			} else if (key.upArrow || (key.tab && key.shift)) {
				const prevIndex = Math.max(0, focusedIndex - 1)
				setFocusedField(FIELDS[prevIndex]!)
			} else if (key.return) {
				handleSubmit()
			}
			return
		}

		if (key.upArrow || (key.tab && key.shift)) {
			const prevIndex = Math.max(0, focusedIndex - 1)
			setFocusedField(FIELDS[prevIndex]!)
		} else if (key.downArrow || key.tab) {
			const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
			setFocusedField(FIELDS[nextIndex]!)
		}
	})

	const footer = (
		<Text dimColor>
			Tab/Arrows: navigate | Space: toggle | Enter: {focusedIndex === FIELDS.length - 1 ? 'save' : 'next'} | Esc: cancel
		</Text>
	)

	return (
		<Modal title={`Edit Webhook: ${webhook.name}`} width={70} footer={footer}>
			{errors.submit && (
				<Box marginBottom={1}>
					<Text color="red">{errors.submit}</Text>
				</Box>
			)}

			<FormField
				label="Name"
				value={name}
				onChange={setName}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'name'}
				error={errors.name}
				placeholder="Discord Alerts"
			/>

			<FormField
				label="URL"
				value={url}
				onChange={setUrl}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'url'}
				error={errors.url}
				placeholder="https://discord.com/api/webhooks/..."
			/>

			<CheckboxField
				label="Events"
				options={EVENT_OPTIONS}
				selected={events}
				onChange={setEvents}
				isFocused={focusedField === 'events'}
				focusedIndex={eventsFocusIndex}
				onFocusedIndexChange={setEventsFocusIndex}
				onSubmit={handleFieldSubmit}
			/>
			{errors.events && (
				<Box marginLeft={4} marginBottom={1}>
					<Text color="red">{errors.events}</Text>
				</Box>
			)}

			<Box marginBottom={1}>
				<Text color={focusedField === 'enabled' ? 'cyan' : undefined} bold={focusedField === 'enabled'}>
					{focusedField === 'enabled' ? '> ' : '  '}
					Enabled:{' '}
				</Text>
				<Text>
					({enabled ? '●' : ' '}) Yes {'  '}
					({!enabled ? '●' : ' '}) No
				</Text>
			</Box>

			{isSubmitting && (
				<Box marginTop={1}>
					<Text color="cyan">Updating webhook...</Text>
				</Box>
			)}
		</Modal>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/EditWebhookForm.tsx
git commit -m "feat(tui): add EditWebhookForm component"
```

---

### Task 10.4: Create TestWebhookModal Component

**Files:**
- Create: `packages/tui-client/src/components/TestWebhookModal.tsx`

**Step 1: Create TestWebhookModal.tsx**

```typescript
import { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'

interface TestResult {
	success: boolean
	statusCode?: number
	statusText?: string
	responseTimeMs?: number
	responseBody?: string
	error?: string
}

export function TestWebhookModal() {
	const { setView, webhooks, selectedWebhookId } = useAppStore()

	const webhook = webhooks.find((w) => w.id === selectedWebhookId)

	const [testing, setTesting] = useState(true)
	const [result, setResult] = useState<TestResult | null>(null)

	useEffect(() => {
		if (!webhook) return

		async function runTest() {
			try {
				const testResult = await trpc.webhooks.test.mutate({ id: webhook!.id })
				setResult(testResult)
			} catch (err) {
				setResult({
					success: false,
					error: err instanceof Error ? err.message : 'Test failed',
				})
			} finally {
				setTesting(false)
			}
		}

		runTest()
	}, [webhook])

	useInput((input, key) => {
		if (key.escape || key.return) {
			setView('dashboard')
		}
	})

	if (!webhook) {
		return (
			<Modal title="Test Webhook" width={60}>
				<Text color="red">Webhook not found</Text>
			</Modal>
		)
	}

	const footer = <Text dimColor>Press Enter or Esc to close</Text>

	return (
		<Modal title={`Test Webhook: ${webhook.name}`} width={60} footer={footer}>
			{testing ? (
				<Box flexDirection="column">
					<Text color="cyan">◐ Sending test webhook...</Text>
				</Box>
			) : result ? (
				<Box flexDirection="column">
					<Box marginBottom={1}>
						{result.success ? (
							<Text color="green" bold>✓ Success</Text>
						) : (
							<Text color="red" bold>✗ Failed</Text>
						)}
					</Box>

					{result.statusCode && (
						<Box>
							<Text dimColor>Status: </Text>
							<Text>{result.statusCode} {result.statusText}</Text>
						</Box>
					)}

					{result.responseTimeMs !== undefined && (
						<Box>
							<Text dimColor>Response time: </Text>
							<Text>{result.responseTimeMs}ms</Text>
						</Box>
					)}

					{result.error && (
						<Box>
							<Text dimColor>Error: </Text>
							<Text color="red">{result.error}</Text>
						</Box>
					)}

					{result.responseBody && (
						<Box flexDirection="column" marginTop={1}>
							<Text dimColor>Response body:</Text>
							<Box borderStyle="single" paddingX={1} marginTop={1}>
								<Text>{result.responseBody.slice(0, 200)}{result.responseBody.length > 200 ? '...' : ''}</Text>
							</Box>
						</Box>
					)}
				</Box>
			) : (
				<Text color="red">Something went wrong</Text>
			)}
		</Modal>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/TestWebhookModal.tsx
git commit -m "feat(tui): add TestWebhookModal component"
```

---

### Task 10.5: Create WebhookDetailView Component

**Files:**
- Create: `packages/tui-client/src/components/WebhookDetailView.tsx`

**Step 1: Create WebhookDetailView.tsx**

```typescript
import { Box, Text, useInput } from 'ink'
import { useAppStore } from '../stores/app'
import { useLoadDeliveries } from '../hooks/useData'
import { useTerminalSize } from '../hooks/useTerminalSize'

function formatRelativeTime(date: Date): string {
	const now = Date.now()
	const diff = now - date.getTime()
	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(diff / 3600000)
	const days = Math.floor(diff / 86400000)

	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes}m ago`
	if (hours < 24) return `${hours}h ago`
	return `${days}d ago`
}

export function WebhookDetailView() {
	const { setView, webhooks, selectedWebhookId, selectedWebhookDeliveries, webhookDeliveriesLoading } = useAppStore()
	const { height } = useTerminalSize()

	useLoadDeliveries(selectedWebhookId)

	const webhook = webhooks.find((w) => w.id === selectedWebhookId)

	useInput((input, key) => {
		if (key.escape || key.backspace) {
			setView('dashboard')
		} else if (input === 'e') {
			setView('edit-webhook')
		} else if (input === 't') {
			setView('test-webhook')
		}
	})

	if (!webhook) {
		return (
			<Box flexDirection="column" height={height} padding={1}>
				<Text color="red">Webhook not found</Text>
			</Box>
		)
	}

	const maxDeliveries = Math.max(5, height - 18) // Reserve space for header/footer

	return (
		<Box flexDirection="column" height={height}>
			<Box borderStyle="double" borderColor="cyan" flexDirection="column">
				<Box paddingX={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="cyan">
					<Text bold color="cyan">Webhook: {webhook.name}</Text>
				</Box>

				<Box flexDirection="column" padding={1}>
					<Box>
						<Text dimColor>URL: </Text>
						<Text>{webhook.url}</Text>
					</Box>
					<Box>
						<Text dimColor>Status: </Text>
						<Text color={webhook.enabled ? 'green' : 'yellow'}>{webhook.enabled ? '● Enabled' : '○ Disabled'}</Text>
					</Box>
					<Box>
						<Text dimColor>Events: </Text>
						<Text>{webhook.events.map((e) => `[${e}]`).join(' ')}</Text>
					</Box>
					<Box>
						<Text dimColor>Created: </Text>
						<Text>{webhook.createdAt.toLocaleDateString()}</Text>
					</Box>
				</Box>
			</Box>

			<Box borderStyle="single" flexDirection="column" flexGrow={1}>
				<Box paddingX={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false}>
					<Text bold>Recent Deliveries</Text>
				</Box>

				<Box flexDirection="column" padding={1} flexGrow={1}>
					{webhookDeliveriesLoading ? (
						<Text dimColor>Loading deliveries...</Text>
					) : selectedWebhookDeliveries.length === 0 ? (
						<Text dimColor>No deliveries yet</Text>
					) : (
						selectedWebhookDeliveries.slice(0, maxDeliveries).map((delivery) => (
							<Box key={delivery.id} flexDirection="column">
								<Box>
									<Text color={delivery.status === 'success' ? 'green' : delivery.status === 'failed' ? 'red' : 'yellow'}>
										{delivery.status === 'success' ? '✓' : delivery.status === 'failed' ? '✗' : '◌'}
									</Text>
									<Text> {formatRelativeTime(delivery.createdAt).padEnd(12)}</Text>
									<Text color="cyan">{delivery.event.type.padEnd(10)}</Text>
									<Text>{delivery.targetName.padEnd(20).slice(0, 20)}</Text>
									<Text dimColor>{delivery.responseCode ?? '--'}</Text>
									<Text dimColor>  {delivery.responseTimeMs ? `${delivery.responseTimeMs}ms` : ''}</Text>
								</Box>
								{delivery.status === 'failed' && delivery.errorMessage && (
									<Box marginLeft={2}>
										<Text dimColor>└─ </Text>
										<Text color="red">{delivery.errorMessage}</Text>
										{delivery.attempts > 1 && <Text dimColor> (after {delivery.attempts} attempts)</Text>}
									</Box>
								)}
							</Box>
						))
					)}

					{selectedWebhookDeliveries.length > maxDeliveries && (
						<Box marginTop={1}>
							<Text dimColor>Showing {maxDeliveries} of {selectedWebhookDeliveries.length} deliveries</Text>
						</Box>
					)}
				</Box>
			</Box>

			<Box borderStyle="single" paddingX={1}>
				<Text dimColor>(e)dit  (t)est  (backspace) back</Text>
			</Box>
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/WebhookDetailView.tsx
git commit -m "feat(tui): add WebhookDetailView component"
```

---

## Phase 11: TUI Client - App Integration

### Task 11.1: Update App Component

**Files:**
- Modify: `packages/tui-client/src/App.tsx`

**Step 1: Update App.tsx**

```typescript
import { useLoadData } from './hooks/useData'
import { useSubscriptions } from './hooks/useSubscriptions'
import { useKeyboard } from './hooks/useKeyboard'
import { Layout } from './components/Layout'
import { AddTargetForm } from './components/AddTargetForm'
import { EditTargetForm } from './components/EditTargetForm'
import { AddWebhookForm } from './components/AddWebhookForm'
import { EditWebhookForm } from './components/EditWebhookForm'
import { WebhookDetailView } from './components/WebhookDetailView'
import { TestWebhookModal } from './components/TestWebhookModal'
import { HelpModal } from './components/HelpModal'
import { useAppStore } from './stores/app'

export function App() {
	const { view } = useAppStore()

	useLoadData()
	useSubscriptions()
	useKeyboard()

	if (view === 'add-target') {
		return <AddTargetForm />
	}

	if (view === 'edit-target') {
		return <EditTargetForm />
	}

	if (view === 'add-webhook') {
		return <AddWebhookForm />
	}

	if (view === 'edit-webhook') {
		return <EditWebhookForm />
	}

	if (view === 'webhook-detail') {
		return <WebhookDetailView />
	}

	if (view === 'test-webhook') {
		return <TestWebhookModal />
	}

	if (view === 'help') {
		return <HelpModal />
	}

	return <Layout />
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/App.tsx
git commit -m "feat(tui): integrate webhook views into App"
```

---

### Task 11.2: Update Footer with Webhook Hints

**Files:**
- Modify: `packages/tui-client/src/components/Footer.tsx`

**Step 1: Update Footer.tsx**

```typescript
import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'

export function Footer() {
	const { activeTab } = useAppStore()

	const targetHints = '(a)dd  (e)dit  (d)elete  (r)efresh  (?) help  (q)uit'
	const webhookHints = '(a)dd  (e)dit  (d)elete  (t)est  (enter) details  (r)efresh  (?) help  (q)uit'

	return (
		<Box borderStyle="single" paddingX={1}>
			<Text dimColor>{activeTab === 'targets' ? targetHints : webhookHints}</Text>
		</Box>
	)
}
```

**Step 2: Verify types compile**

Run: `bun run --cwd packages/tui-client tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/tui-client/src/components/Footer.tsx
git commit -m "feat(tui): update Footer with webhook-specific hints"
```

---

## Phase 12: Final Verification

### Task 12.1: Full Type Check

**Step 1: Run typecheck across all packages**

Run: `bun run typecheck`
Expected: No errors

**Step 2: Fix any type errors that appear**

If errors exist, address them based on the error messages.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from webhook integration"
```

---

### Task 12.2: Test the Implementation

**Step 1: Start the database**

Run: `docker compose up -d`

**Step 2: Apply migrations**

Run: `bun run db:migrate`

**Step 3: Start the dev server**

Run: `bun run dev`

**Step 4: Manual testing checklist**

- [ ] Tab navigation between Targets and Webhooks works (Tab, 1, 2 keys)
- [ ] Webhook list displays correctly
- [ ] Add webhook form works (press 'a' on webhooks tab)
- [ ] Edit webhook form works (press 'e' with webhook selected)
- [ ] Delete webhook works (press 'd' with webhook selected)
- [ ] Test webhook works (press 't' with webhook selected)
- [ ] Webhook detail view shows deliveries (press Enter)
- [ ] Delivery history shows status, retries work

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete webhook TUI integration"
```

---

## Summary

This plan adds:

1. **Expanded Event Types**: 6 new event types (degraded, timeout, error, paused, resumed, certificate_expiring)
2. **Delivery Tracking**: New `webhook_deliveries` table with status, attempts, response info
3. **Retry System**: Exponential backoff (10s, 30s, 90s) with max 4 attempts
4. **TUI Components**:
   - TabBar for switching between Targets and Webhooks
   - WebhookList and WebhookRow for list view
   - WebhookDetailPanel for inline details
   - WebhookDetailView for full delivery history
   - AddWebhookForm and EditWebhookForm modals
   - TestWebhookModal for testing webhooks
   - CheckboxField for event selection

Total: ~25 files modified/created, broken into 23 bite-sized tasks.
