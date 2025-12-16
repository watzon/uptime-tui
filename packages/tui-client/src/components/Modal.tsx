import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { useTerminalSize } from '../hooks/useTerminalSize'

interface ModalProps {
	title: string
	children: ReactNode
	width?: number
	footer?: ReactNode
}

export function Modal({ title, children, width = 50, footer }: ModalProps) {
	const { width: terminalWidth, height: terminalHeight } = useTerminalSize()

	// Calculate centering
	const horizontalPadding = Math.max(0, Math.floor((terminalWidth - width) / 2))

	return (
		<Box flexDirection="column" height={terminalHeight} width={terminalWidth}>
			{/* Top spacer to vertically center */}
			<Box flexGrow={1} />

			{/* Modal container */}
			<Box paddingLeft={horizontalPadding}>
				<Box
					flexDirection="column"
					width={width}
					borderStyle="double"
					borderColor="cyan"
				>
					{/* Header */}
					<Box
						paddingX={1}
						borderStyle="single"
						borderTop={false}
						borderLeft={false}
						borderRight={false}
						borderColor="cyan"
					>
						<Text bold color="cyan">
							{title}
						</Text>
					</Box>

					{/* Content */}
					<Box flexDirection="column" padding={1}>
						{children}
					</Box>

					{/* Footer */}
					{footer && (
						<Box
							paddingX={1}
							borderStyle="single"
							borderBottom={false}
							borderLeft={false}
							borderRight={false}
							borderColor="gray"
						>
							{footer}
						</Box>
					)}
				</Box>
			</Box>

			{/* Bottom spacer to vertically center */}
			<Box flexGrow={1} />
		</Box>
	)
}
