import {
	createWebhookInputSchema,
	updateWebhookInputSchema,
	type EventType,
	type WebhookConfig,
} from '@downtime/shared'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, webhookConfigs } from '../../db'
import { protectedProcedure, router } from '../trpc'

export const webhooksRouter = router({
	list: protectedProcedure.query(async (): Promise<WebhookConfig[]> => {
		const result = await db.select().from(webhookConfigs)
		return result.map((r) => ({
			...r,
			events: r.events as EventType[],
		}))
	}),

	get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
		const [result] = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, input.id)).limit(1)

		if (!result) return null

		return {
			...result,
			events: result.events as EventType[],
		} as WebhookConfig
	}),

	create: protectedProcedure.input(createWebhookInputSchema).mutation(async ({ input }) => {
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

	update: protectedProcedure.input(updateWebhookInputSchema).mutation(async ({ input }) => {
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

	delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
		await db.delete(webhookConfigs).where(eq(webhookConfigs.id, input.id))
		return { success: true }
	}),

	test: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
		const [webhook] = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, input.id)).limit(1)

		if (!webhook) {
			throw new Error('Webhook not found')
		}

		const testPayload = {
			event: 'test',
			target: { id: 'test-id', name: 'Test Target', url: 'https://example.com' },
			timestamp: new Date().toISOString(),
			details: { message: 'This is a test webhook' },
		}

		const response = await fetch(webhook.url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(testPayload),
		})

		return {
			success: response.ok,
			statusCode: response.status,
			statusText: response.statusText,
		}
	}),
})
