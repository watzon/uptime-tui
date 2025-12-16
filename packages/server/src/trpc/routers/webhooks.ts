import {
	type EventType,
	type WebhookConfig,
	type WebhookDeliveryWithDetails,
	createWebhookInputSchema,
	updateWebhookInputSchema,
} from '@uptime-tui/shared'
import { and, desc, eq, lt } from 'drizzle-orm'
import { z } from 'zod'
import {
	events,
	db,
	targets,
	webhookConfigs,
	webhookDeliveries,
} from '../../db'
import { protectedProcedure, router } from '../trpc'

export const webhooksRouter = router({
	list: protectedProcedure.query(async (): Promise<WebhookConfig[]> => {
		const result = await db.select().from(webhookConfigs)
		return result.map((r) => ({
			...r,
			events: r.events as EventType[],
		}))
	}),

	get: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const [result] = await db
				.select()
				.from(webhookConfigs)
				.where(eq(webhookConfigs.id, input.id))
				.limit(1)

			if (!result) return null

			return {
				...result,
				events: result.events as EventType[],
			} as WebhookConfig
		}),

	create: protectedProcedure
		.input(createWebhookInputSchema)
		.mutation(async ({ input }) => {
			const [newWebhook] = await db
				.insert(webhookConfigs)
				.values({
					name: input.name,
					url: input.url,
					events: input.events,
					enabled: input.enabled,
				})
				.returning()

			return {
				...newWebhook,
				events: newWebhook!.events as EventType[],
			} as WebhookConfig
		}),

	update: protectedProcedure
		.input(updateWebhookInputSchema)
		.mutation(async ({ input }) => {
			const { id, ...updates } = input

			const [updated] = await db
				.update(webhookConfigs)
				.set({ ...updates, updatedAt: new Date() })
				.where(eq(webhookConfigs.id, id))
				.returning()

			return {
				...updated,
				events: updated!.events as EventType[],
			} as WebhookConfig
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			await db.delete(webhookConfigs).where(eq(webhookConfigs.id, input.id))
			return { success: true }
		}),

	deliveries: protectedProcedure
		.input(
			z.object({
				webhookId: z.string().uuid(),
				limit: z.number().min(1).max(100).optional().default(50),
				cursor: z.string().uuid().optional(),
			}),
		)
		.query(
			async ({
				input,
			}): Promise<{
				deliveries: WebhookDeliveryWithDetails[]
				nextCursor?: string
			}> => {
				const conditions = [eq(webhookDeliveries.webhookId, input.webhookId)]

				if (input.cursor) {
					conditions.push(lt(webhookDeliveries.id, input.cursor))
				}

				const rows = await db
					.select({
						delivery: webhookDeliveries,
						event: events,
						targetName: targets.name,
					})
					.from(webhookDeliveries)
					.innerJoin(events, eq(webhookDeliveries.eventId, events.id))
					.innerJoin(targets, eq(events.targetId, targets.id))
					.where(and(...conditions))
					.orderBy(desc(webhookDeliveries.createdAt))
					.limit(input.limit + 1)

				const hasMore = rows.length > input.limit
				const deliveries = rows.slice(0, input.limit).map((row) => ({
					...row.delivery,
					event: {
						...row.event,
						metadata: row.event.metadata as Record<string, unknown>,
					},
					targetName: row.targetName,
				}))

				return {
					deliveries,
					nextCursor: hasMore
						? deliveries[deliveries.length - 1]?.id
						: undefined,
				}
			},
		),

	recentDeliveries: protectedProcedure
		.input(
			z.object({
				webhookId: z.string().uuid(),
				limit: z.number().min(1).max(10).optional().default(5),
			}),
		)
		.query(async ({ input }) => {
			const rows = await db
				.select({
					status: webhookDeliveries.status,
				})
				.from(webhookDeliveries)
				.where(eq(webhookDeliveries.webhookId, input.webhookId))
				.orderBy(desc(webhookDeliveries.createdAt))
				.limit(input.limit)

			return rows.map((r) => r.status)
		}),

	test: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const [webhook] = await db
				.select()
				.from(webhookConfigs)
				.where(eq(webhookConfigs.id, input.id))
				.limit(1)

			if (!webhook) {
				throw new Error('Webhook not found')
			}

			const testPayload = {
				event: 'test',
				target: { id: 'test-id', name: 'Test Target', type: 'http' },
				timestamp: new Date().toISOString(),
				details: { message: 'Test webhook delivery' },
			}

			const startTime = Date.now()
			let responseTime: number | undefined
			let body: string | undefined
			let errorMsg: string | undefined

			try {
				const response = await fetch(webhook.url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(testPayload),
				})

				responseTime = Date.now() - startTime
				body = await response.text().catch(() => undefined)

				// Truncate body to 1KB
				if (body && body.length > 1024) {
					body = `${body.substring(0, 1024)}... (truncated)`
				}

				return {
					success: response.ok,
					statusCode: response.status,
					responseTime,
					body,
					error: undefined,
				}
			} catch (error) {
				responseTime = Date.now() - startTime
				errorMsg = error instanceof Error ? error.message : 'Unknown error'

				return {
					success: false,
					statusCode: undefined,
					responseTime,
					body: undefined,
					error: errorMsg,
				}
			}
		}),
})
