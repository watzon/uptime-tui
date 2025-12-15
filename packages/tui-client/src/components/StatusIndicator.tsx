import { Text } from 'ink'
import { STATUS_COLORS, STATUS_ICONS, type TargetStatus } from '@downtime/shared'

interface StatusIndicatorProps {
	status: TargetStatus
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
	const icon = STATUS_ICONS[status]
	const color = STATUS_COLORS[status]

	return <Text color={color}>{icon}</Text>
}
