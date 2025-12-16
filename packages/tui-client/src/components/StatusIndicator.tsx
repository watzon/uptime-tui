import {
	STATUS_COLORS,
	STATUS_ICONS,
	type TargetStatus,
} from '@uptime-tui/shared'
import { Text } from 'ink'

interface StatusIndicatorProps {
	status: TargetStatus
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
	const icon = STATUS_ICONS[status]
	const color = STATUS_COLORS[status]

	return <Text color={color}>{icon}</Text>
}
