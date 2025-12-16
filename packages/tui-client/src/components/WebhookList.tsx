import { Box, Text } from 'ink'
import { useAppStore } from '../stores/app'
import { WebhookRow } from './WebhookRow'

export function WebhookList() {
	const webhooks = useAppStore((state) => state.webhooks)
	const selectedWebhookId = useAppStore((state) => state.selectedWebhookId)

	if (webhooks.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text dimColor>No webhooks configured</Text>
				<Text dimColor>Press 'a' to add a webhook</Text>
			</Box>
		)
	}

	return (
		<Box flexDirection="column">
			{webhooks.map((webhook) => (
				<WebhookRow
					key={webhook.id}
					webhook={webhook}
					isSelected={webhook.id === selectedWebhookId}
				/>
			))}
		</Box>
	)
}
