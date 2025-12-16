import { Box, Text } from 'ink'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { useAppStore } from '../stores/app'
import { DetailPanel } from './DetailPanel'
import { EventLog } from './EventLog'
import { Footer } from './Footer'
import { Header } from './Header'
import { TargetList } from './TargetList'
import { WebhookDetailPanel } from './WebhookDetailPanel'
import { WebhookList } from './WebhookList'

export function Layout() {
	const { view, activeTab } = useAppStore()
	const { height } = useTerminalSize()

	if (view !== 'dashboard') {
		return null
	}

	const isTargetsTab = activeTab === 'targets'
	const listTitle = isTargetsTab ? 'Targets' : 'Webhooks'
	const detailTitle = isTargetsTab ? 'Details' : 'Webhook Details'

	return (
		<Box flexDirection="column" height={height}>
			<Header />

			<Box flexGrow={1} flexDirection="row">
				<Box width="40%" borderStyle="single" flexDirection="column">
					<Box
						paddingX={1}
						borderStyle="single"
						borderBottom
						borderLeft={false}
						borderRight={false}
						borderTop={false}
					>
						<Text bold>{listTitle}</Text>
					</Box>
					<Box flexGrow={1} overflow="hidden">
						{isTargetsTab ? <TargetList /> : <WebhookList />}
					</Box>
				</Box>

				<Box width="60%" flexDirection="column">
					<Box flexGrow={1} borderStyle="single">
						<Box flexDirection="column" width="100%">
							<Box
								paddingX={1}
								borderStyle="single"
								borderBottom
								borderLeft={false}
								borderRight={false}
								borderTop={false}
							>
								<Text bold>{detailTitle}</Text>
							</Box>
							{isTargetsTab ? <DetailPanel /> : <WebhookDetailPanel />}
						</Box>
					</Box>

					{isTargetsTab && (
						<Box height={8} borderStyle="single">
							<Box flexDirection="column" width="100%">
								<Box
									paddingX={1}
									borderStyle="single"
									borderBottom
									borderLeft={false}
									borderRight={false}
									borderTop={false}
								>
									<Text bold>Events</Text>
								</Box>
								<EventLog />
							</Box>
						</Box>
					)}
				</Box>
			</Box>

			<Footer />
		</Box>
	)
}
