import { EventEmitter } from 'node:events'
import type { Event, Metric, Target, TargetStatus } from '@uptime-tui/shared'

export interface StatusChangeEvent {
	target: Target
	previousStatus: TargetStatus
	newStatus: TargetStatus
	metric: Metric
}

export interface MetricRecordedEvent {
	target: Target
	metric: Metric
}

export interface SchedulerEvents {
	statusChange: [StatusChangeEvent]
	metricRecorded: [MetricRecordedEvent]
	eventCreated: [Event]
}

class TypedEventEmitter extends EventEmitter {
	override emit<K extends keyof SchedulerEvents>(
		event: K,
		...args: SchedulerEvents[K]
	): boolean {
		return super.emit(event, ...args)
	}

	override on<K extends keyof SchedulerEvents>(
		event: K,
		listener: (...args: SchedulerEvents[K]) => void,
	): this {
		return super.on(event, listener)
	}

	override off<K extends keyof SchedulerEvents>(
		event: K,
		listener: (...args: SchedulerEvents[K]) => void,
	): this {
		return super.off(event, listener)
	}
}

export const schedulerEvents = new TypedEventEmitter()
