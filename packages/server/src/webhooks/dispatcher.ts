import type { Event, EventType, Target } from '@downtime/shared'
import { eq, inArray } from 'drizzle-orm'
import { db, webhookConfigs } from '../db'
import { schedulerEvents } from '../scheduler'

interface WebhookPayload {
	event: EventType
	target: {
		id: string
		name: string
		type: string
		url?: string
	}
	timestamp: string
	details: Record<string, unknown>
}

async function dispatchWebhook(url: string, payload: WebhookPayload): Promise<void> {
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Downtime-Monitor/1.0',
			},
			body: JSON.stringify(payload),
		})

		if (!response.ok) {
			console.error(`Webhook to ${url} failed with status ${response.status}`)
		}
	} catch (error) {
		console.error(`Webhook to ${url} failed:`, error)
	}
}

async function handleEvent(event: Event, target: Target | null): Promise<void> {
	const webhooks = await db
		.select()
		.from(webhookConfigs)
		.where(eq(webhookConfigs.enabled, true))

	const matchingWebhooks = webhooks.filter((w) => w.events.includes(event.type))

	if (matchingWebhooks.length === 0) return

	const config = target?.config as { url?: string; host?: string; port?: number } | undefined
	const url = config?.url ?? (config?.host ? `${config.host}:${config.port}` : undefined)

	const payload: WebhookPayload = {
		event: event.type,
		target: {
			id: event.targetId,
			name: target?.name ?? 'Unknown',
			type: target?.type ?? 'unknown',
			url,
		},
		timestamp: event.createdAt.toISOString(),
		details: event.metadata,
	}

	await Promise.all(matchingWebhooks.map((w) => dispatchWebhook(w.url, payload)))
}

export function startWebhookDispatcher(): void {
	schedulerEvents.on('eventCreated', async (event) => {
		try {
			const target = await db.query.targets.findFirst({
				where: (targets, { eq }) => eq(targets.id, event.targetId),
			})

			await handleEvent(event, target as Target | null)
		} catch (error) {
			console.error('Error dispatching webhook:', error)
		}
	})

	console.log('Webhook dispatcher started')
}
