import type { Event, Metric, TargetWithStatus } from '@downtime/shared'
import { useEffect } from 'react'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { log } from '../lib/logger'

function parseTarget(raw: Record<string, unknown>): TargetWithStatus {
	return {
		...raw,
		createdAt: new Date(raw.createdAt as string),
		updatedAt: new Date(raw.updatedAt as string),
		lastCheckedAt: raw.lastCheckedAt ? new Date(raw.lastCheckedAt as string) : null,
	} as TargetWithStatus
}

function parseEvent(raw: Record<string, unknown>): Event {
	return {
		...raw,
		createdAt: new Date(raw.createdAt as string),
	} as Event
}

function parseMetric(raw: Record<string, unknown>): Metric {
	return {
		...raw,
		time: new Date(raw.time as string),
	} as Metric
}

export function useLoadData() {
	const { setTargets, setEvents, setConnectionStatus, setError } = useAppStore()

	useEffect(() => {
		async function load() {
			try {
				setConnectionStatus('connecting')

				const [targetsResult, eventsResult] = await Promise.all([
					trpc.targets.list.query(),
					trpc.events.list.query({ limit: 50 }),
				])

				setTargets(targetsResult.map((t) => parseTarget(t as unknown as Record<string, unknown>)))
				setEvents(eventsResult.items.map((e) => parseEvent(e as unknown as Record<string, unknown>)))
				setConnectionStatus('connected')
			} catch (error) {
				setConnectionStatus('error')
				setError(error instanceof Error ? error.message : 'Failed to connect to server')
			}
		}

		load()
	}, [setTargets, setEvents, setConnectionStatus, setError])
}

export function useLoadSummary(targetId: string | null) {
	const { setSelectedTargetSummary } = useAppStore()

	useEffect(() => {
		if (!targetId) {
			setSelectedTargetSummary(null)
			return
		}

		async function load() {
			try {
				const summary = await trpc.metrics.summary.query({
					targetId: targetId!,
					period: '24h',
				})
				setSelectedTargetSummary(summary)
			} catch (error) {
				log('Failed to load summary:', error)
			}
		}

		load()
	}, [targetId, setSelectedTargetSummary])
}

export function useLoadMetrics(targetId: string | null) {
	const { setSelectedTargetMetrics, setMetricsLoading } = useAppStore()

	useEffect(() => {
		if (!targetId) {
			setSelectedTargetMetrics([])
			return
		}

		// Set loading state (metrics will be set to loading: false when data arrives)
		setMetricsLoading(true)
		log('Loading metrics for target:', targetId)

		async function load() {
			try {
				const now = new Date()
				const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

				log('Fetching metrics from', oneHourAgo.toISOString(), 'to', now.toISOString())

				const metrics = await trpc.metrics.query.query({
					targetId: targetId!,
					startTime: oneHourAgo,
					endTime: now,
					aggregation: 'raw',
					limit: 100,
				})

				log('Received', metrics.length, 'metrics for target', targetId)

				// setSelectedTargetMetrics also sets metricsLoading to false
				setSelectedTargetMetrics(metrics.map((m) => parseMetric(m as unknown as Record<string, unknown>)))
			} catch (error) {
				log('Failed to load metrics:', error)
				setMetricsLoading(false)
			}
		}

		load()
	}, [targetId, setSelectedTargetMetrics, setMetricsLoading])
}
