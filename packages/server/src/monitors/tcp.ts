import { Socket } from 'net'
import type { MonitorResult, TcpConfig } from '@uptime-tui/shared'
import type { Monitor } from './types'

export class TcpMonitor implements Monitor<TcpConfig> {
	async execute(config: TcpConfig, timeoutMs: number): Promise<MonitorResult> {
		const startTime = performance.now()

		return new Promise((resolve) => {
			const socket = new Socket()

			const timeoutId = setTimeout(() => {
				socket.destroy()
				resolve({
					status: 'down',
					responseTimeMs: Math.round(performance.now() - startTime),
					error: `Connection timed out after ${timeoutMs}ms`,
				})
			}, timeoutMs)

			socket.connect(config.port, config.host, () => {
				clearTimeout(timeoutId)
				const responseTimeMs = Math.round(performance.now() - startTime)
				socket.destroy()
				resolve({
					status: 'up',
					responseTimeMs,
				})
			})

			socket.on('error', (error) => {
				clearTimeout(timeoutId)
				const responseTimeMs = Math.round(performance.now() - startTime)
				socket.destroy()
				resolve({
					status: 'down',
					responseTimeMs,
					error: error.message,
				})
			})
		})
	}
}
