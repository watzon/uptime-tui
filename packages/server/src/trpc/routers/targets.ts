import {
	type Target,
	type TargetWithStatus,
	createTargetInputSchema,
	updateTargetInputSchema,
} from '@uptime-tui/shared'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, targetCurrentStatus, targets } from '../../db'
import { scheduler } from '../../scheduler'
import { protectedProcedure, router } from '../trpc'

export const targetsRouter = router({
	list: protectedProcedure.query(async (): Promise<TargetWithStatus[]> => {
		const result = await db
			.select()
			.from(targets)
			.leftJoin(
				targetCurrentStatus,
				eq(targets.id, targetCurrentStatus.targetId),
			)

		return result.map(({ targets: t, target_current_status: s }) => ({
			...t,
			config: t.config as Target['config'],
			currentStatus: s?.currentStatus ?? 'unknown',
			lastCheckedAt: s?.lastCheckedAt ?? null,
			lastResponseTimeMs: s?.lastResponseTimeMs ?? null,
		}))
	}),

	get: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const result = await db
				.select()
				.from(targets)
				.leftJoin(
					targetCurrentStatus,
					eq(targets.id, targetCurrentStatus.targetId),
				)
				.where(eq(targets.id, input.id))
				.limit(1)

			const row = result[0]
			if (!row) return null

			return {
				...row.targets,
				config: row.targets.config as Target['config'],
				currentStatus: row.target_current_status?.currentStatus ?? 'unknown',
				lastCheckedAt: row.target_current_status?.lastCheckedAt ?? null,
				lastResponseTimeMs:
					row.target_current_status?.lastResponseTimeMs ?? null,
			} as TargetWithStatus
		}),

	create: protectedProcedure
		.input(createTargetInputSchema)
		.mutation(async ({ input }) => {
			const [newTarget] = await db
				.insert(targets)
				.values({
					name: input.name,
					type: input.type,
					config: input.config,
					intervalMs: input.intervalMs,
					timeoutMs: input.timeoutMs,
					enabled: input.enabled,
					failureThreshold: input.failureThreshold,
				})
				.returning()

			if (newTarget && newTarget.enabled) {
				scheduler.scheduleTarget(newTarget as Target)
			}

			return newTarget as Target
		}),

	update: protectedProcedure
		.input(updateTargetInputSchema)
		.mutation(async ({ input }) => {
			const { id, ...updates } = input

			const [updated] = await db
				.update(targets)
				.set({ ...updates, updatedAt: new Date() })
				.where(eq(targets.id, id))
				.returning()

			if (updated) {
				if (updated.enabled) {
					scheduler.scheduleTarget(updated as Target)
				} else {
					scheduler.unscheduleTarget(id)
				}
			}

			return updated as Target
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			scheduler.unscheduleTarget(input.id)
			await db.delete(targets).where(eq(targets.id, input.id))
			return { success: true }
		}),

	test: protectedProcedure
		.input(
			z.object({
				type: z.enum(['http', 'tcp', 'icmp']),
				config: z.any(),
				timeoutMs: z.number().optional().default(5000),
			}),
		)
		.mutation(async ({ input }) => {
			const { getMonitor } = await import('../../monitors')
			const monitor = getMonitor(input.type)
			return monitor.execute(input.config, input.timeoutMs)
		}),
})
