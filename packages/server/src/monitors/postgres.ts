import type { MonitorResult, PostgresConfig } from '@uptime-tui/shared'
import postgres from 'postgres'
import type { Monitor } from './types'

export class PostgresMonitor implements Monitor<PostgresConfig> {
	async execute(
		config: PostgresConfig,
		timeoutMs: number,
	): Promise<MonitorResult> {
		const startTime = performance.now()
		const query = config.query ?? 'SELECT 1'

		const sql = postgres(config.connectionString, {
			connect_timeout: Math.ceil(timeoutMs / 1000),
			idle_timeout: 1,
			max: 1,
		})

		try {
			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error(`Query timed out after ${timeoutMs}ms`)),
					timeoutMs,
				)
			})

			// Race between query and timeout
			await Promise.race([sql.unsafe(query), timeoutPromise])

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
			await sql.end()
		}
	}
}
