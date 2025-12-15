import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'

export function Header() {
	const { connectionStatus, targets } = useAppStore()

	const statusColor =
		connectionStatus === 'connected' ? 'green' : connectionStatus === 'error' ? 'red' : 'yellow'

	const upCount = targets.filter((t) => t.currentStatus === 'up').length
	const downCount = targets.filter((t) => t.currentStatus === 'down').length

	return (
		<Box borderStyle="single" paddingX={1} justifyContent="space-between">
			<Text bold>Downtime Monitor</Text>
			<Box>
				<Text color="green">{upCount} up</Text>
				<Text> | </Text>
				<Text color="red">{downCount} down</Text>
				<Text> | </Text>
				<Text color={statusColor}>{connectionStatus}</Text>
			</Box>
		</Box>
	)
}
