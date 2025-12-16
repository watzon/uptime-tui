import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'

type Tab = 'targets' | 'webhooks'

interface TabItemProps {
	label: string
	tabKey: Tab
	hotkey: string
	isActive: boolean
}

function TabItem({ label, hotkey, isActive }: TabItemProps) {
	return (
		<Box marginRight={2}>
			<Text
				backgroundColor={isActive ? 'blue' : undefined}
				color={isActive ? 'white' : 'gray'}
				bold={isActive}
			>
				{' '}
				[{hotkey}] {label}{' '}
			</Text>
		</Box>
	)
}

export function TabBar() {
	const { activeTab } = useAppStore()

	return (
		<Box paddingX={1} paddingY={0}>
			<TabItem
				label="Targets"
				tabKey="targets"
				hotkey="1"
				isActive={activeTab === 'targets'}
			/>
			<TabItem
				label="Webhooks"
				tabKey="webhooks"
				hotkey="2"
				isActive={activeTab === 'webhooks'}
			/>
		</Box>
	)
}
