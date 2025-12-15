import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'
import { TargetRow } from './TargetRow'
import { log } from '../lib/logger'

export function TargetList() {
	const targets = useAppStore((state) => state.targets)
	const selectedTargetId = useAppStore((state) => state.selectedTargetId)

	log('TargetList render, targets:', targets.length, 'first target status:', targets[0]?.currentStatus)

	if (targets.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text dimColor>No targets configured</Text>
				<Text dimColor>Press 'a' to add a target</Text>
			</Box>
		)
	}

	return (
		<Box flexDirection="column">
			{targets.map((target) => (
				<TargetRow key={target.id} target={target} isSelected={target.id === selectedTargetId} />
			))}
		</Box>
	)
}
