import type { Event } from '@uptime-tui/shared'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import {
	type MetricRecordedEvent,
	type StatusChangeEvent,
	schedulerEvents,
} from '../scheduler'
import { protectedProcedure, router } from './trpc'

export const subscriptionsRouter = router({
	onStatusChange: protectedProcedure
		.input(z.object({ targetId: z.string().uuid().optional() }).optional())
		.subscription(({ input }) => {
			console.log('Client subscribed to onStatusChange')
			return observable<StatusChangeEvent>((emit) => {
				const handler = (event: StatusChangeEvent) => {
					console.log(
						'Emitting status change to client:',
						event.target.name,
						event.newStatus,
					)
					if (!input?.targetId || event.target.id === input.targetId) {
						emit.next(event)
					}
				}

				schedulerEvents.on('statusChange', handler)

				return () => {
					console.log('Client unsubscribed from onStatusChange')
					schedulerEvents.off('statusChange', handler)
				}
			})
		}),

	onMetric: protectedProcedure
		.input(z.object({ targetId: z.string().uuid().optional() }).optional())
		.subscription(({ input }) => {
			console.log('Client subscribed to onMetric')
			return observable<MetricRecordedEvent>((emit) => {
				const handler = (event: MetricRecordedEvent) => {
					console.log(
						'Emitting metric to client:',
						event.target.name,
						event.metric.status,
					)
					if (!input?.targetId || event.target.id === input.targetId) {
						emit.next(event)
					}
				}

				schedulerEvents.on('metricRecorded', handler)

				return () => {
					console.log('Client unsubscribed from onMetric')
					schedulerEvents.off('metricRecorded', handler)
				}
			})
		}),

	onEvent: protectedProcedure
		.input(z.object({ targetId: z.string().uuid().optional() }).optional())
		.subscription(({ input }) => {
			console.log('Client subscribed to onEvent')
			return observable<Event>((emit) => {
				const handler = (event: Event) => {
					console.log('Emitting event to client:', event.type, event.message)
					if (!input?.targetId || event.targetId === input.targetId) {
						emit.next(event)
					}
				}

				schedulerEvents.on('eventCreated', handler)

				return () => {
					console.log('Client unsubscribed from onEvent')
					schedulerEvents.off('eventCreated', handler)
				}
			})
		}),
})
