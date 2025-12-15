import { Box, Text } from 'ink'
import type { TargetWithStatus } from '@downtime/shared'
import { StatusIndicator } from './StatusIndicator'
import { log } from '../lib/logger'

interface TargetRowProps {
	target: TargetWithStatus
	isSelected: boolean
}

export function TargetRow({ target, isSelected }: TargetRowProps) {
	const responseTime = target.lastResponseTimeMs !== null ? `${target.lastResponseTimeMs}ms` : '---'

	log('TargetRow render:', target.name, 'responseTime:', responseTime, 'status:', target.currentStatus)

	return (
		<Box>
			<Text inverse={isSelected}>
				<StatusIndicator status={target.currentStatus} />
				<Text> </Text>
				<Text bold={isSelected}>{target.name.padEnd(24)}</Text>
				<Text dimColor>{responseTime.padStart(8)}</Text>
			</Text>
		</Box>
	)
}
