import type { WebhookConfig } from '@uptime-tui/shared'
import { Box, Text } from 'ink'

interface WebhookRowProps {
	webhook: WebhookConfig
	isSelected: boolean
}

function truncateUrl(url: string, maxLength: number): string {
	if (url.length <= maxLength) return url
	try {
		const parsed = new URL(url)
		const domain = parsed.hostname
		const remaining = maxLength - domain.length - 3 // for "..."
		if (remaining <= 0) return `${domain.substring(0, maxLength - 3)}...`
		return `${domain}${parsed.pathname.substring(0, remaining)}...`
	} catch {
		return `${url.substring(0, maxLength - 3)}...`
	}
}

export function WebhookRow({ webhook, isSelected }: WebhookRowProps) {
	const enabledIndicator = webhook.enabled ? '\u25CF' : '\u25CB' // ● or ○
	const enabledColor = webhook.enabled ? 'green' : 'gray'
	const truncatedUrl = truncateUrl(webhook.url, 30)

	return (
		<Box>
			<Text inverse={isSelected}>
				<Text color={enabledColor}>{enabledIndicator}</Text>
				<Text> </Text>
				<Text bold={isSelected}>{webhook.name.padEnd(20)}</Text>
				<Text dimColor>{truncatedUrl.padEnd(32)}</Text>
			</Text>
		</Box>
	)
}
