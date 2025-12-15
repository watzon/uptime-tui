import { eventsListInputSchema, type Event } from '@downtime/shared'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { db, events } from '../../db'
import { protectedProcedure, router } from '../trpc'

export const eventsRouter = router({
	list: protectedProcedure.input(eventsListInputSchema).query(async ({ input }) => {
		const { targetId, types, limit, cursor } = input

		const conditions = []

		if (targetId) {
			conditions.push(eq(events.targetId, targetId))
		}

		if (types && types.length > 0) {
			conditions.push(inArray(events.type, types))
		}

		if (cursor) {
			conditions.push(lt(events.createdAt, new Date(cursor)))
		}

		const result = await db
			.select()
			.from(events)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(events.createdAt))
			.limit(limit + 1)

		const hasMore = result.length > limit
		const items = hasMore ? result.slice(0, -1) : result

		return {
			items: items as Event[],
			nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() : null,
		}
	}),
})
