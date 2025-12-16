import type { DockerConfig, MonitorResult } from '@uptime-tui/shared'
import Docker from 'dockerode'
import type { Monitor } from './types'

export class DockerMonitor implements Monitor<DockerConfig> {
	async execute(
		config: DockerConfig,
		timeoutMs: number,
	): Promise<MonitorResult> {
		const startTime = performance.now()
		const socketPath = config.socketPath ?? '/var/run/docker.sock'

		const docker = new Docker({ socketPath })

		try {
			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() =>
						reject(new Error(`Docker inspect timed out after ${timeoutMs}ms`)),
					timeoutMs,
				)
			})

			// Get container by ID or name
			const containerId = config.containerId ?? config.containerName
			if (!containerId) {
				return {
					status: 'down',
					responseTimeMs: Math.round(performance.now() - startTime),
					error: 'Either containerId or containerName is required',
				}
			}

			const container = docker.getContainer(containerId)

			// Race between inspect and timeout
			const info = await Promise.race([container.inspect(), timeoutPromise])
			const responseTimeMs = Math.round(performance.now() - startTime)

			const isRunning = info.State.Running

			// Check health status if container has health check configured
			const healthStatus = info.State.Health?.Status
			const isHealthy = healthStatus === undefined || healthStatus === 'healthy'

			if (!isRunning) {
				return {
					status: 'down',
					responseTimeMs,
					error: `Container is not running (state: ${info.State.Status})`,
				}
			}

			if (!isHealthy) {
				return {
					status: 'down',
					responseTimeMs,
					error: `Container is unhealthy (health: ${healthStatus})`,
				}
			}

			return {
				status: 'up',
				responseTimeMs,
			}
		} catch (error) {
			const responseTimeMs = Math.round(performance.now() - startTime)
			const errorMessage =
				error instanceof Error ? error.message : String(error)

			// Provide more helpful error messages for common issues
			if (errorMessage.includes('ENOENT') || errorMessage.includes('EACCES')) {
				return {
					status: 'down',
					responseTimeMs,
					error: `Cannot connect to Docker socket at ${socketPath}. Check permissions or socket path.`,
				}
			}

			if (
				errorMessage.includes('404') ||
				errorMessage.includes('no such container')
			) {
				return {
					status: 'down',
					responseTimeMs,
					error: `Container not found: ${config.containerId ?? config.containerName}`,
				}
			}

			return {
				status: 'down',
				responseTimeMs,
				error: errorMessage,
			}
		}
	}
}
