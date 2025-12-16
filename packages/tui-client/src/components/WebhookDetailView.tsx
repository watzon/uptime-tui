import type { WebhookDeliveryWithDetails } from '@uptime-tui/shared'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { useTerminalSize } from '../hooks/useTerminalSize'
import { useWebhookDeliveries } from '../hooks/useWebhooks'
import { useAppStore } from '../stores/app'

function formatRelativeTime(date: Date): string {
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMins / 60)
	const diffDays = Math.floor(diffHours / 24)

	if (diffMins < 1) return 'just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	return `${diffDays}d ago`
}

function DeliveryRow({
	delivery,
	isSelected,
}: { delivery: WebhookDeliveryWithDetails; isSelected: boolean }) {
	const statusIcon =
		delivery.status === 'success'
			? '\u2713'
			: delivery.status === 'failed'
				? '\u2717'
				: '\u25CC'
	const statusColor =
		delivery.status === 'success'
			? 'green'
			: delivery.status === 'failed'
				? 'red'
				: 'yellow'

	return (
		<Box flexDirection="column">
			<Box>
				<Text inverse={isSelected}>
					<Text color={statusColor}>{statusIcon}</Text>
					<Text> </Text>
					<Text>{formatRelativeTime(delivery.createdAt).padEnd(10)}</Text>
					<Text color="cyan">{delivery.event.type.padEnd(12)}</Text>
					<Text>{delivery.targetName.padEnd(20)}</Text>
					<Text dimColor>{delivery.responseCode ?? '--'}</Text>
					<Text dimColor> </Text>
					<Text dimColor>
						{delivery.responseTimeMs ? `${delivery.responseTimeMs}ms` : '--'}
					</Text>
				</Text>
			</Box>
			{isSelected && delivery.status === 'failed' && delivery.errorMessage && (
				<Box paddingLeft={3}>
					<Text dimColor>
						Retried {delivery.attempts}x, error: {delivery.errorMessage}
					</Text>
				</Box>
			)}
		</Box>
	)
}

export function WebhookDetailView() {
	const { setView, webhooks, selectedWebhookId } = useAppStore()
	const webhook = webhooks.find((w) => w.id === selectedWebhookId)
	const { deliveries, loading, hasMore, loadMore } =
		useWebhookDeliveries(selectedWebhookId)
	const { height } = useTerminalSize()

	const [selectedIndex, setSelectedIndex] = useState(0)

	useInput((input, key) => {
		if (key.escape || key.backspace) {
			setView('dashboard')
			return
		}

		if (key.downArrow || input === 'j') {
			if (selectedIndex < deliveries.length - 1) {
				setSelectedIndex(selectedIndex + 1)
				// Load more when approaching end
				if (selectedIndex >= deliveries.length - 5 && hasMore) {
					loadMore()
				}
			}
		} else if (key.upArrow || input === 'k') {
			setSelectedIndex(Math.max(0, selectedIndex - 1))
		} else if (input === 'e') {
			setView('edit-webhook')
		} else if (input === 't') {
			setView('test-webhook')
		}
	})

	if (!webhook) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">Webhook not found</Text>
			</Box>
		)
	}

	const statusText = webhook.enabled ? 'Enabled' : 'Disabled'
	const statusColor = webhook.enabled ? 'green' : 'gray'

	// Calculate how many deliveries we can show
	const headerHeight = 10 // Approximate header section height
	const footerHeight = 2
	const availableHeight = height - headerHeight - footerHeight
	const visibleDeliveries = Math.max(5, availableHeight)

	// Calculate scroll window
	const startIndex = Math.max(
		0,
		Math.min(
			selectedIndex - Math.floor(visibleDeliveries / 2),
			deliveries.length - visibleDeliveries,
		),
	)
	const endIndex = Math.min(startIndex + visibleDeliveries, deliveries.length)
	const visibleItems = deliveries.slice(startIndex, endIndex)

	return (
		<Box flexDirection="column" height={height} padding={1}>
			<Box borderStyle="single" paddingX={1} marginBottom={1}>
				<Text bold>Webhook: {webhook.name}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>URL: </Text>
				<Text>{webhook.url}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>Status: </Text>
				<Text color={statusColor}>
					{webhook.enabled ? '\u25CF' : '\u25CB'} {statusText}
				</Text>
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

			<Box borderStyle="single" paddingX={1} marginTop={1} marginBottom={0}>
				<Text bold>Recent Deliveries</Text>
			</Box>

			<Box flexDirection="column" flexGrow={1} overflow="hidden">
				{loading && deliveries.length === 0 ? (
					<Text dimColor>Loading deliveries...</Text>
				) : deliveries.length === 0 ? (
					<Text dimColor>No deliveries yet</Text>
				) : (
					<>
						{visibleItems.map((delivery, idx) => (
							<DeliveryRow
								key={delivery.id}
								delivery={delivery}
								isSelected={startIndex + idx === selectedIndex}
							/>
						))}
						{loading && <Text dimColor>Loading more...</Text>}
						<Box marginTop={1}>
							<Text dimColor>
								Showing {startIndex + 1}-{endIndex} of {deliveries.length}
								{hasMore ? '+' : ''} deliveries
							</Text>
						</Box>
					</>
				)}
			</Box>

			<Box borderStyle="single" paddingX={1} marginTop={1}>
				<Text dimColor>
					(e)dit (t)est (Backspace) back ({'\u2191\u2193'}) scroll deliveries
				</Text>
			</Box>
		</Box>
	)
}
