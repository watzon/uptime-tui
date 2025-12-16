import { Box, Text, useInput } from 'ink'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'

interface KeyBinding {
	key: string
	description: string
}

const KEYBINDINGS: KeyBinding[] = [
	{ key: 'j / ↓', description: 'Select next target' },
	{ key: 'k / ↑', description: 'Select previous target' },
	{ key: 'a', description: 'Add new target' },
	{ key: 'e', description: 'Edit selected target' },
	{ key: 'd', description: 'Delete selected target' },
	{ key: 'r', description: 'Refresh targets list' },
	{ key: ',', description: 'Open settings' },
	{ key: '?', description: 'Show this help' },
	{ key: 'q', description: 'Quit' },
]

const FORM_KEYBINDINGS: KeyBinding[] = [
	{ key: 'Tab / ↓', description: 'Next field' },
	{ key: 'Shift+Tab / ↑', description: 'Previous field' },
	{ key: 'Enter', description: 'Next field / Submit' },
	{ key: 'Esc', description: 'Cancel' },
]

export function HelpModal() {
	const { setView } = useAppStore()

	useInput((input, key) => {
		if (key.escape || input === '?' || input === 'q') {
			setView('dashboard')
		}
	})

	const footer = <Text dimColor>Press Esc or ? to close</Text>

	return (
		<Modal title="Keyboard Shortcuts" width={50} footer={footer}>
			<Box flexDirection="column">
				<Text bold color="cyan">
					Dashboard
				</Text>
				<Box flexDirection="column" marginBottom={1}>
					{KEYBINDINGS.map((kb) => (
						<Box key={kb.key}>
							<Text color="yellow">{kb.key.padEnd(14)}</Text>
							<Text>{kb.description}</Text>
						</Box>
					))}
				</Box>

				<Text bold color="cyan">
					Forms
				</Text>
				<Box flexDirection="column">
					{FORM_KEYBINDINGS.map((kb) => (
						<Box key={kb.key}>
							<Text color="yellow">{kb.key.padEnd(14)}</Text>
							<Text>{kb.description}</Text>
						</Box>
					))}
				</Box>
			</Box>
		</Modal>
	)
}
