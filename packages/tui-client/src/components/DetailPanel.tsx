import { Box, Text } from 'ink'
import type { HttpConfig, TcpConfig } from '@downtime/shared'
import { useAppStore } from '../stores/app'
import { useLoadSummary, useLoadMetrics } from '../hooks/useData'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { StatusIndicator } from './StatusIndicator'
import { UptimeChart } from './UptimeChart'

export function DetailPanel() {
	const targets = useAppStore((state) => state.targets)
	const selectedTargetId = useAppStore((state) => state.selectedTargetId)
	const selectedTargetSummary = useAppStore((state) => state.selectedTargetSummary)
	const selectedTargetMetrics = useAppStore((state) => state.selectedTargetMetrics)
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

	const config = target.config as HttpConfig | TcpConfig
	const url = 'url' in config ? config.url : `${config.host}:${config.port}`

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<StatusIndicator status={target.currentStatus} />
				<Text bold> {target.name}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>URL: </Text>
				<Text>{url}</Text>
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

			{selectedTargetMetrics.length > 0 && (
				<Box marginTop={1} flexDirection="column">
					<UptimeChart metrics={selectedTargetMetrics} width={chartWidth} />
				</Box>
			)}

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
