import { EVENT_TYPE_LABELS } from '@uptime-tui/shared'
import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'

export function EventLog() {
	const { events, targets } = useAppStore()

	if (events.length === 0) {
		return (
			<Box padding={1}>
				<Text dimColor>No recent events</Text>
			</Box>
		)
	}

	return (
		<Box flexDirection="column">
			{events.slice(0, 5).map((event) => {
				const target = targets.find((t) => t.id === event.targetId)
				const targetName = target?.name ?? 'Unknown'
				const timestamp = new Date(event.createdAt).toLocaleTimeString()
				const label = EVENT_TYPE_LABELS[event.type]
				const color =
					event.type === 'up'
						? 'green'
						: event.type === 'down'
							? 'red'
							: 'yellow'

				return (
					<Box key={event.id}>
						<Text dimColor>{timestamp} </Text>
						<Text>{targetName} </Text>
						<Text color={color}>{label}</Text>
					</Box>
				)
			})}
		</Box>
	)
}
