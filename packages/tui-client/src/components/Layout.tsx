import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { Header } from './Header'
import { Footer } from './Footer'
import { TargetList } from './TargetList'
import { DetailPanel } from './DetailPanel'
import { EventLog } from './EventLog'

export function Layout() {
	const { view } = useAppStore()
	const { width, height } = useTerminalSize()

	if (view !== 'dashboard') {
		return null
	}

	return (
		<Box flexDirection="column" height={height}>
			<Header />

			<Box flexGrow={1} flexDirection="row">
				<Box width="40%" borderStyle="single" flexDirection="column">
					<Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
						<Text bold>Targets</Text>
					</Box>
					<Box flexGrow={1} overflow="hidden">
						<TargetList />
					</Box>
				</Box>

				<Box width="60%" flexDirection="column">
					<Box flexGrow={1} borderStyle="single">
						<Box flexDirection="column" width="100%">
							<Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
								<Text bold>Details</Text>
							</Box>
							<DetailPanel />
						</Box>
					</Box>

					<Box height={8} borderStyle="single">
						<Box flexDirection="column" width="100%">
							<Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
								<Text bold>Events</Text>
							</Box>
							<EventLog />
						</Box>
					</Box>
				</Box>
			</Box>

			<Footer />
		</Box>
	)
}
