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
