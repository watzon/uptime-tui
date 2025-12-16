import type { IcmpConfig, MonitorResult } from '@uptime-tui/shared'
import ping from 'ping'
import type { Monitor } from './types'

export class IcmpMonitor implements Monitor<IcmpConfig> {
	async execute(config: IcmpConfig, timeoutMs: number): Promise<MonitorResult> {
		const startTime = performance.now()
		const packetCount = config.packetCount ?? 1

		try {
			const result = await ping.promise.probe(config.host, {
				timeout: Math.ceil(timeoutMs / 1000),
				min_reply: packetCount,
			})

			const responseTimeMs =
				typeof result.time === 'string'
					? Math.round(performance.now() - startTime)
					: Math.round(Number(result.time))

			if (result.alive) {
				return {
					status: 'up',
					responseTimeMs,
				}
			}

			return {
				status: 'down',
				responseTimeMs,
				error: 'Host unreachable',
			}
		} catch (error) {
			const responseTimeMs = Math.round(performance.now() - startTime)
			return {
				status: 'down',
				responseTimeMs,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}
}
