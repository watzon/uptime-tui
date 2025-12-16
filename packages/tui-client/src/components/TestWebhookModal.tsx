import { Box, Text, useInput } from 'ink'
import { useEffect, useState } from 'react'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'

interface TestResult {
	success: boolean
	statusCode?: number
	responseTime?: number
	body?: string
	error?: string
}

export function TestWebhookModal() {
	const { setView, webhooks, selectedWebhookId } = useAppStore()
	const webhook = webhooks.find((w) => w.id === selectedWebhookId)

	const [testing, setTesting] = useState(true)
	const [result, setResult] = useState<TestResult | null>(null)

	useEffect(() => {
		if (!webhook) return

		async function runTest() {
			try {
				const response = await trpc.webhooks.test.mutate({ id: webhook!.id })
				setResult(response)
			} catch (err) {
				setResult({
					success: false,
					error: err instanceof Error ? err.message : 'Test failed',
				})
			} finally {
				setTesting(false)
			}
		}

		runTest()
	}, [webhook])

	useInput((input, key) => {
		if (key.escape || key.return) {
			setView('dashboard')
		}
	})

	if (!webhook) {
		return (
			<Modal title="Test Webhook" width={60}>
				<Text color="red">Webhook not found</Text>
			</Modal>
		)
	}

	const footer = <Text dimColor>Enter/Esc: close</Text>

	return (
		<Modal title="Test Webhook" width={65} footer={footer}>
			<Box marginBottom={1}>
				<Text dimColor>Sending test to: </Text>
				<Text bold>{webhook.name}</Text>
			</Box>

			{testing ? (
				<Box>
					<Text color="cyan">Testing...</Text>
				</Box>
			) : result ? (
				<Box flexDirection="column">
					<Box marginBottom={1}>
						{result.success ? (
							<Text color="green">{'\u2713'} Success</Text>
						) : (
							<Text color="red">{'\u2717'} Failed</Text>
						)}
					</Box>

					{result.statusCode !== undefined && (
						<Box marginBottom={1}>
							<Text dimColor>Status: </Text>
							<Text
								color={
									result.statusCode >= 200 && result.statusCode < 300
										? 'green'
										: 'red'
								}
							>
								{result.statusCode}
							</Text>
						</Box>
					)}

					{result.responseTime !== undefined && (
						<Box marginBottom={1}>
							<Text dimColor>Response time: </Text>
							<Text>{result.responseTime}ms</Text>
						</Box>
					)}

					{result.body && (
						<Box flexDirection="column" marginBottom={1}>
							<Text dimColor>Response body:</Text>
							<Box paddingLeft={2}>
								<Text>
									{result.body.length > 200
										? `${result.body.substring(0, 200)}...`
										: result.body}
								</Text>
							</Box>
						</Box>
					)}

					{result.error && (
						<Box marginBottom={1}>
							<Text dimColor>Error: </Text>
							<Text color="red">{result.error}</Text>
						</Box>
					)}
				</Box>
			) : null}
		</Modal>
	)
}
