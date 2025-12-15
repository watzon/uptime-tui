import { Box, Text } from 'ink'
import type {
	HttpConfig,
	TcpConfig,
	IcmpConfig,
	DnsConfig,
	DockerConfig,
	PostgresConfig,
	RedisConfig,
	TargetType,
} from '@downtime/shared'
import { useAppStore } from '../stores/app'
import { useLoadSummary, useLoadMetrics } from '../hooks/useData'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { StatusIndicator } from './StatusIndicator'
import { UptimeChart } from './UptimeChart'

function getTargetDescription(type: TargetType, config: unknown): { label: string; value: string } {
	switch (type) {
		case 'http': {
			const c = config as HttpConfig
			return { label: 'URL', value: c.url }
		}
		case 'tcp': {
			const c = config as TcpConfig
			return { label: 'Host', value: `${c.host}:${c.port}` }
		}
		case 'icmp': {
			const c = config as IcmpConfig
			return { label: 'Host', value: c.host }
		}
		case 'dns': {
			const c = config as DnsConfig
			return { label: 'Domain', value: `${c.host} (${c.recordType ?? 'A'})` }
		}
		case 'docker': {
			const c = config as DockerConfig
			return { label: 'Container', value: c.containerName ?? c.containerId ?? 'unknown' }
		}
		case 'postgres': {
			const c = config as PostgresConfig
			// Parse connection string to show host without password
			// postgres://user:pass@host:port/database
			const connStr = c.connectionString ?? ''
			const match = connStr.match(/@([^:/]+)(?::(\d+))?(?:\/([^?]+))?/)
			if (match) {
				const host = match[1]
				const port = match[2] ?? '5432'
				const db = match[3] ?? ''
				return { label: 'Database', value: `${host}:${port}${db ? `/${db}` : ''}` }
			}
			return { label: 'Database', value: connStr ? '(configured)' : '(not configured)' }
		}
		case 'redis': {
			const c = config as RedisConfig
			// Parse URL to show host without password
			// redis://user:pass@host:port
			const redisUrl = c.url ?? 'redis://localhost:6379'
			const match = redisUrl.match(/:\/\/(?:[^@]+@)?([^:/]+)(?::(\d+))?/)
			if (match) {
				const host = match[1]
				const port = match[2] ?? '6379'
				return { label: 'Redis', value: `${host}:${port}` }
			}
			return { label: 'Redis', value: 'localhost:6379' }
		}
		default:
			return { label: 'Target', value: 'unknown' }
	}
}

export function DetailPanel() {
	const targets = useAppStore((state) => state.targets)
	const selectedTargetId = useAppStore((state) => state.selectedTargetId)
	const selectedTargetSummary = useAppStore((state) => state.selectedTargetSummary)
	const selectedTargetMetrics = useAppStore((state) => state.selectedTargetMetrics)
	const metricsLoading = useAppStore((state) => state.metricsLoading)
	const { width: terminalWidth } = useTerminalSize()

	useLoadSummary(selectedTargetId)
	useLoadMetrics(selectedTargetId)

	// Detail panel is 60% of terminal width, minus borders/padding
	const chartWidth = Math.max(20, Math.floor(terminalWidth * 0.6) - 6)

	const target = targets.find((t) => t.id === selectedTargetId)

	if (!target) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text dimColor>Select a target to view details</Text>
			</Box>
		)
	}

	const { label, value } = getTargetDescription(target.type, target.config)

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<StatusIndicator status={target.currentStatus} />
				<Text bold> {target.name}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>{label}: </Text>
				<Text>{value}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>Type: </Text>
				<Text>{target.type.toUpperCase()}</Text>
				<Text dimColor>  Interval: </Text>
				<Text>{target.intervalMs / 1000}s</Text>
				{target.lastResponseTimeMs !== null && (
					<>
						<Text dimColor>  Last: </Text>
						<Text>{target.lastResponseTimeMs}ms</Text>
					</>
				)}
			</Box>

			<Box marginTop={1} flexDirection="column">
				<UptimeChart metrics={selectedTargetMetrics} width={chartWidth} loading={metricsLoading} />
			</Box>

			{selectedTargetSummary && (
				<Box marginTop={1} flexDirection="column">
					<Text bold>24h Summary: </Text>
					<Text>
						<Text color="green">{selectedTargetSummary.uptimePercent.toFixed(1)}%</Text>
						<Text dimColor> uptime • </Text>
						{selectedTargetSummary.avgResponseTimeMs !== null
							? <Text>{selectedTargetSummary.avgResponseTimeMs}ms avg</Text>
							: <Text dimColor>N/A</Text>}
						<Text dimColor> • </Text>
						<Text>{selectedTargetSummary.successfulChecks}/{selectedTargetSummary.totalChecks} checks</Text>
					</Text>
				</Box>
			)}
		</Box>
	)
}
