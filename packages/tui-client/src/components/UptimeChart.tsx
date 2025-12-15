import { Box, Text } from 'ink'
import type { Metric, TargetStatus } from '@downtime/shared'

interface UptimeChartProps {
	metrics: Metric[]
	width?: number
	height?: number
	loading?: boolean
}

function getStatusColor(status: TargetStatus): string {
	switch (status) {
		case 'up':
			return 'green'
		case 'down':
			return 'red'
		case 'degraded':
			return 'yellow'
		default:
			return 'gray'
	}
}

function getStatusChar(status: TargetStatus): string {
	switch (status) {
		case 'up':
			return '█'
		case 'down':
			return '█'
		case 'degraded':
			return '▄'
		default:
			return '░'
	}
}

function getResponseTimeColor(ms: number): string {
	if (ms >= 500) return 'red'
	if (ms >= 200) return 'yellow'
	return 'green'
}

export function UptimeChart({ metrics, width = 40, height = 6, loading = false }: UptimeChartProps) {
	if (loading) {
		return (
			<Box flexDirection="column">
				<Text color="cyan">Loading metrics...</Text>
			</Box>
		)
	}

	if (metrics.length === 0) {
		return (
			<Box flexDirection="column">
				<Text dimColor>No metrics data available</Text>
			</Box>
		)
	}

	// Take the most recent metrics up to width
	const recentMetrics = metrics.slice(-width)

	// Calculate response time range
	const responseTimes = recentMetrics
		.map((m) => m.responseTimeMs)
		.filter((rt): rt is number => rt !== null)

	const minTime = Math.min(...responseTimes, 0)
	const maxTime = Math.max(...responseTimes, 1)
	const range = maxTime - minTime || 1

	// Build status timeline
	const statusLine = recentMetrics.map((m, i) => (
		<Text key={i} color={getStatusColor(m.status)}>
			{getStatusChar(m.status)}
		</Text>
	))

	// Build multi-row response time chart
	// Each metric gets a normalized height (0 to height)
	const normalizedHeights = recentMetrics.map((m) => {
		if (m.responseTimeMs === null) return 0
		return Math.ceil(((m.responseTimeMs - minTime) / range) * height)
	})

	// Build rows from top to bottom
	const chartRows: JSX.Element[] = []
	for (let row = height; row >= 1; row--) {
		const rowChars = recentMetrics.map((m, i) => {
			const barHeight = normalizedHeights[i] ?? 0
			if (barHeight >= row) {
				// This cell should be filled
				const color = m.responseTimeMs !== null ? getResponseTimeColor(m.responseTimeMs) : 'gray'
				// Use half block for the top of the bar if it's the exact height
				const char = barHeight === row && row < height ? '▄' : '█'
				return (
					<Text key={i} color={color}>
						{char}
					</Text>
				)
			} else {
				// Empty cell
				return (
					<Text key={i} dimColor>
						{' '}
					</Text>
				)
			}
		})

		chartRows.push(
			<Box key={row}>
				{rowChars}
			</Box>
		)
	}

	// Calculate stats
	const avgTime = responseTimes.length > 0
		? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
		: null

	const upCount = recentMetrics.filter((m) => m.status === 'up').length
	const uptimePercent = ((upCount / recentMetrics.length) * 100).toFixed(1)

	// Time range label
	const firstTime = recentMetrics[0]?.time
	const lastTime = recentMetrics[recentMetrics.length - 1]?.time
	const timeLabel = firstTime && lastTime
		? `${formatTimeAgo(new Date(firstTime))} → now`
		: ''

	return (
		<Box flexDirection="column">
			<Box marginBottom={0}>
				<Text bold>Status </Text>
				<Text dimColor>({uptimePercent}% up)</Text>
			</Box>
			<Box>{statusLine}</Box>

			<Box marginTop={1} marginBottom={0}>
				<Text bold>Response Time </Text>
				<Text dimColor>
					({minTime}ms - {maxTime}ms{avgTime !== null ? `, avg ${avgTime}ms` : ''})
				</Text>
			</Box>
			<Box flexDirection="column">
				{chartRows}
			</Box>

			<Box marginTop={1}>
				<Text dimColor>{timeLabel} • {recentMetrics.length} checks</Text>
			</Box>
		</Box>
	)
}

function formatTimeAgo(date: Date): string {
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMins / 60)

	if (diffMins < 1) return 'just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	return `${Math.floor(diffHours / 24)}d ago`
}
