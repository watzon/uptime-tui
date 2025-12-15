import type { Event, TargetStatus } from '@downtime/shared'
import { useEffect } from 'react'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { log } from '../lib/logger'

export function useSubscriptions() {
	useEffect(() => {
		log('Setting up subscriptions...')

		const statusSub = trpc.subscriptions.onStatusChange.subscribe(undefined, {
			onData: (data) => {
				log('Received status change:', data.target.name, data.newStatus)
				const { targets, updateTarget } = useAppStore.getState()
				const existingTarget = targets.find((t) => t.id === data.target.id)
				if (existingTarget) {
					updateTarget({
						...existingTarget,
						currentStatus: data.newStatus as TargetStatus,
						lastCheckedAt: new Date(data.metric.time as unknown as string),
						lastResponseTimeMs: data.metric.responseTimeMs,
					})
				}
			},
			onError: (error: unknown) => {
				log('Status subscription error:', error)
			},
		})

		const eventSub = trpc.subscriptions.onEvent.subscribe(undefined, {
			onData: (rawEvent) => {
				log('Received event:', rawEvent.type, rawEvent.message)
				const { addEvent } = useAppStore.getState()
				const event: Event = {
					...rawEvent,
					createdAt: new Date(rawEvent.createdAt as unknown as string),
				}
				addEvent(event)
			},
			onError: (error: unknown) => {
				log('Event subscription error:', error)
			},
		})

		const metricSub = trpc.subscriptions.onMetric.subscribe(undefined, {
			onData: async (data) => {
				log('Received metric:', data.target.name, data.metric.status, data.metric.responseTimeMs + 'ms')
				const { targets, updateTarget, selectedTargetId, setSelectedTargetSummary, addMetric } = useAppStore.getState()
				const existingTarget = targets.find((t) => t.id === data.target.id)
				if (existingTarget) {
					updateTarget({
						...existingTarget,
						lastCheckedAt: new Date(data.metric.time as unknown as string),
						lastResponseTimeMs: data.metric.responseTimeMs,
						currentStatus: data.metric.status as TargetStatus,
					})
				}

				// Add metric to chart data if it's for the selected target
				if (selectedTargetId === data.target.id) {
					addMetric({
						...data.metric,
						time: new Date(data.metric.time as unknown as string),
					})

					// Also refresh summary
					try {
						const summary = await trpc.metrics.summary.query({
							targetId: data.target.id,
							period: '24h',
						})
						setSelectedTargetSummary(summary)
					} catch (err) {
						log('Failed to refresh summary:', err)
					}
				}
			},
			onError: (error: unknown) => {
				log('Metric subscription error:', error)
			},
		})

		return () => {
			log('Cleaning up subscriptions...')
			statusSub.unsubscribe()
			eventSub.unsubscribe()
			metricSub.unsubscribe()
		}
	}, [])
}
