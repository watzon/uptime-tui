import type { HttpConfig, MonitorResult } from '@downtime/shared'
import type { Monitor } from './types'

export class HttpMonitor implements Monitor<HttpConfig> {
	async execute(config: HttpConfig, timeoutMs: number): Promise<MonitorResult> {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

		const startTime = performance.now()

		try {
			const response = await fetch(config.url, {
				method: config.method ?? 'GET',
				headers: config.headers,
				signal: controller.signal,
				redirect: 'follow',
			})

			const responseTimeMs = Math.round(performance.now() - startTime)
			clearTimeout(timeoutId)

			const expectedStatus = config.expectedStatus ?? 200
			const statusOk = config.expectedStatus
				? response.status === config.expectedStatus
				: response.status >= 200 && response.status < 400

			if (statusOk) {
				return {
					status: 'up',
					responseTimeMs,
					statusCode: response.status,
				}
			}

			return {
				status: 'down',
				responseTimeMs,
				statusCode: response.status,
				error: `Expected status ${expectedStatus}, got ${response.status}`,
			}
		} catch (error) {
			clearTimeout(timeoutId)
			const responseTimeMs = Math.round(performance.now() - startTime)

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					return {
						status: 'down',
						responseTimeMs,
						error: `Request timed out after ${timeoutMs}ms`,
					}
				}

				return {
					status: 'down',
					responseTimeMs,
					error: error.message,
				}
			}

			return {
				status: 'down',
				responseTimeMs,
				error: 'Unknown error',
			}
		}
	}
}
