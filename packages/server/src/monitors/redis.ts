import type { MonitorResult, RedisConfig } from '@uptime-tui/shared'
import { RedisClient } from 'bun'
import type { Monitor } from './types'

export class RedisMonitor implements Monitor<RedisConfig> {
	async execute(
		config: RedisConfig,
		timeoutMs: number,
	): Promise<MonitorResult> {
		const startTime = performance.now()
		const url = config.url ?? 'redis://localhost:6379'

		const client = new RedisClient(url)

		try {
			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)),
					timeoutMs,
				)
			})

			// Race between ping and timeout
			await Promise.race([client.ping(), timeoutPromise])

			const responseTimeMs = Math.round(performance.now() - startTime)
			return {
				status: 'up',
				responseTimeMs,
			}
		} catch (error) {
			const responseTimeMs = Math.round(performance.now() - startTime)
			return {
				status: 'down',
				responseTimeMs,
				error: error instanceof Error ? error.message : String(error),
			}
		} finally {
			client.close()
		}
	}
}
