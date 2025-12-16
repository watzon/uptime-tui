import type {
	Event,
	HttpConfig,
	Metric,
	Target,
	TcpConfig,
} from '@uptime-tui/shared'
import { eq } from 'drizzle-orm'
import { events, db, metrics, targetCurrentStatus, targets } from '../db'
import { getMonitor } from '../monitors'
import { schedulerEvents } from './events'
import { StatusDetector } from './status-detector'

export class Scheduler {
	private intervals = new Map<string, NodeJS.Timeout>()
	private statusDetector = new StatusDetector()
	private running = false

	async start(): Promise<void> {
		if (this.running) return

		console.log('Starting scheduler...')
		this.running = true

		const allTargets = await db.query.targets.findMany({
			where: eq(targets.enabled, true),
		})

		const statuses = await db.query.targetCurrentStatus.findMany()
		const statusMap = new Map(statuses.map((s) => [s.targetId, s]))

		for (const target of allTargets) {
			const status = statusMap.get(target.id)
			this.statusDetector.initializeTarget(
				target.id,
				status?.currentStatus ?? 'unknown',
			)
			this.scheduleTarget(target as Target)
		}

		console.log(`Scheduler started with ${allTargets.length} targets`)
	}

	stop(): void {
		if (!this.running) return

		console.log('Stopping scheduler...')
		for (const [_id, interval] of this.intervals) {
			clearInterval(interval)
		}
		this.intervals.clear()
		this.statusDetector.clear()
		this.running = false
		console.log('Scheduler stopped')
	}

	scheduleTarget(target: Target): void {
		this.unscheduleTarget(target.id)

		if (!target.enabled) return

		this.statusDetector.initializeTarget(target.id)

		this.runCheck(target)

		const interval = setInterval(() => {
			this.runCheck(target)
		}, target.intervalMs)

		this.intervals.set(target.id, interval)
		console.log(
			`Scheduled target ${target.name} (${target.id}) every ${target.intervalMs}ms`,
		)
	}

	unscheduleTarget(targetId: string): void {
		const interval = this.intervals.get(targetId)
		if (interval) {
			clearInterval(interval)
			this.intervals.delete(targetId)
		}
		this.statusDetector.removeTarget(targetId)
	}

	private async runCheck(target: Target): Promise<void> {
		try {
			const monitor = getMonitor(target.type)
			const result = await monitor.execute(
				target.config as HttpConfig | TcpConfig,
				target.timeoutMs,
			)

			const metric: Metric = {
				time: new Date(),
				targetId: target.id,
				status: result.status,
				responseTimeMs: result.responseTimeMs,
				statusCode: result.statusCode ?? null,
				error: result.error ?? null,
			}

			await db.insert(metrics).values(metric)

			schedulerEvents.emit('metricRecorded', { target, metric })

			const { statusChanged, previousStatus, newStatus } =
				this.statusDetector.processResult(
					target.id,
					result,
					target.failureThreshold,
				)

			await db
				.insert(targetCurrentStatus)
				.values({
					targetId: target.id,
					currentStatus: newStatus,
					lastCheckedAt: new Date(),
					lastResponseTimeMs: result.responseTimeMs,
					consecutiveFailures:
						this.statusDetector.getState(target.id)?.consecutiveFailures ?? 0,
				})
				.onConflictDoUpdate({
					target: targetCurrentStatus.targetId,
					set: {
						currentStatus: newStatus,
						lastCheckedAt: new Date(),
						lastResponseTimeMs: result.responseTimeMs,
						consecutiveFailures:
							this.statusDetector.getState(target.id)?.consecutiveFailures ?? 0,
						updatedAt: new Date(),
					},
				})

			if (statusChanged) {
				schedulerEvents.emit('statusChange', {
					target,
					previousStatus,
					newStatus,
					metric,
				})

				const eventType =
					newStatus === 'up' ? 'up' : newStatus === 'down' ? 'down' : null
				if (eventType) {
					const event: Omit<Event, 'id'> = {
						targetId: target.id,
						type: eventType,
						message: `${target.name} is now ${newStatus.toUpperCase()}`,
						metadata: {
							previousStatus,
							responseTimeMs: result.responseTimeMs,
							statusCode: result.statusCode,
							error: result.error,
						},
						createdAt: new Date(),
					}

					const [insertedEvent] = await db
						.insert(events)
						.values(event)
						.returning()
					if (insertedEvent) {
						schedulerEvents.emit('eventCreated', insertedEvent as Event)
					}
				}
			}
		} catch (error) {
			console.error(`Error checking target ${target.name}:`, error)
		}
	}

	isRunning(): boolean {
		return this.running
	}

	getScheduledCount(): number {
		return this.intervals.size
	}
}

export const scheduler = new Scheduler()
export {
	schedulerEvents,
	type StatusChangeEvent,
	type MetricRecordedEvent,
} from './events'
export { StatusDetector } from './status-detector'
