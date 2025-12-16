import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'

export function Footer() {
	const { activeTab } = useAppStore()

	const targetHints =
		'j/k: navigate | a: add | e: edit | d: delete | r: refresh | ?: help | q: quit'
	const webhookHints =
		'j/k: navigate | a: add | e: edit | d: delete | t: test | Enter: details | r: refresh | q: quit'
	const tabHints = '1/2/Tab: switch tabs'

	const hints = activeTab === 'targets' ? targetHints : webhookHints

	return (
		<Box borderStyle="single" paddingX={1} justifyContent="space-between">
			<Text dimColor>{hints}</Text>
			<Text dimColor>{tabHints}</Text>
		</Box>
	)
}
