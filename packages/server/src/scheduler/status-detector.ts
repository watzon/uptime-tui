import type { MonitorResult, TargetStatus } from '@uptime-tui/shared'

interface TargetState {
	currentStatus: TargetStatus
	consecutiveFailures: number
	lastCheckedAt: Date | null
	lastResponseTimeMs: number | null
}

export class StatusDetector {
	private states = new Map<string, TargetState>()

	initializeTarget(
		targetId: string,
		initialStatus: TargetStatus = 'unknown',
	): void {
		if (!this.states.has(targetId)) {
			this.states.set(targetId, {
				currentStatus: initialStatus,
				consecutiveFailures: 0,
				lastCheckedAt: null,
				lastResponseTimeMs: null,
			})
		}
	}

	processResult(
		targetId: string,
		result: MonitorResult,
		failureThreshold: number,
	): {
		statusChanged: boolean
		previousStatus: TargetStatus
		newStatus: TargetStatus
	} {
		let state = this.states.get(targetId)

		if (!state) {
			state = {
				currentStatus: 'unknown',
				consecutiveFailures: 0,
				lastCheckedAt: null,
				lastResponseTimeMs: null,
			}
			this.states.set(targetId, state)
		}

		const previousStatus = state.currentStatus
		let newStatus: TargetStatus = previousStatus

		state.lastCheckedAt = new Date()
		state.lastResponseTimeMs = result.responseTimeMs

		if (result.status === 'up') {
			state.consecutiveFailures = 0
			newStatus = 'up'
		} else if (result.status === 'down') {
			state.consecutiveFailures++
			if (state.consecutiveFailures >= failureThreshold) {
				newStatus = 'down'
			} else if (previousStatus === 'up') {
				newStatus = 'degraded'
			}
		} else if (result.status === 'degraded') {
			newStatus = 'degraded'
		}

		state.currentStatus = newStatus
		const statusChanged = previousStatus !== newStatus

		return { statusChanged, previousStatus, newStatus }
	}

	getState(targetId: string): TargetState | undefined {
		return this.states.get(targetId)
	}

	removeTarget(targetId: string): void {
		this.states.delete(targetId)
	}

	clear(): void {
		this.states.clear()
	}
}
