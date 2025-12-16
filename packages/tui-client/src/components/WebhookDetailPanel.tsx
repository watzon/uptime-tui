import { Box, Text } from 'ink'
import { useRecentDeliveries } from '../hooks/useWebhooks'
import { useAppStore } from '../stores/app'

function formatRelativeTime(date: Date): string {
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMins / 60)
	const diffDays = Math.floor(diffHours / 24)

	if (diffMins < 1) return 'just now'
	if (diffMins < 60) return `${diffMins} min ago`
	if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
	return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

function DeliveryStatusIndicator({ statuses }: { statuses: string[] }) {
	if (statuses.length === 0) {
		return <Text dimColor>No deliveries yet</Text>
	}

	return (
		<Box>
			{statuses.map((status, i) => (
				<Text
					key={i}
					color={
						status === 'success'
							? 'green'
							: status === 'failed'
								? 'red'
								: 'yellow'
					}
				>
					{status === 'success'
						? '\u2713'
						: status === 'failed'
							? '\u2717'
							: '\u25CC'}
				</Text>
			))}
			<Text dimColor> (last {statuses.length} deliveries)</Text>
		</Box>
	)
}

export function WebhookDetailPanel() {
	const webhooks = useAppStore((state) => state.webhooks)
	const selectedWebhookId = useAppStore((state) => state.selectedWebhookId)
	const recentStatuses = useRecentDeliveries(selectedWebhookId)

	const webhook = webhooks.find((w) => w.id === selectedWebhookId)

	if (!webhook) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text dimColor>Select a webhook to view details</Text>
			</Box>
		)
	}

	const statusText = webhook.enabled ? 'Enabled' : 'Disabled'
	const statusColor = webhook.enabled ? 'green' : 'gray'

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text color={statusColor}>{webhook.enabled ? '\u25CF' : '\u25CB'}</Text>
				<Text bold> {webhook.name}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>URL: </Text>
				<Text>{webhook.url}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>Status: </Text>
				<Text color={statusColor}>{statusText}</Text>
			</Box>

			<Box marginBottom={1} flexWrap="wrap">
				<Text dimColor>Events: </Text>
				{webhook.events.map((event, i) => (
					<Text key={event}>
						<Text color="cyan">[{event}]</Text>
						{i < webhook.events.length - 1 && <Text> </Text>}
					</Text>
				))}
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>Created: </Text>
				<Text>{formatRelativeTime(webhook.createdAt)}</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold>Recent Deliveries:</Text>
				<DeliveryStatusIndicator statuses={recentStatuses} />
			</Box>
		</Box>
	)
}
