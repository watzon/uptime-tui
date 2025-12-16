import { Box, Text, useInput } from 'ink'
import { useEffect, useState } from 'react'
import { type Config, saveConfig } from '../lib/config'
import { useAppStore } from '../stores/app'
import { FormField } from './FormField'
import { Modal } from './Modal'

type FieldName = 'serverUrl' | 'wsUrl' | 'apiKey'

const FIELDS: FieldName[] = ['serverUrl', 'wsUrl', 'apiKey']

export function SettingsView() {
	const { setView, config } = useAppStore()

	const [serverUrl, setServerUrl] = useState(config?.serverUrl ?? '')
	const [wsUrl, setWsUrl] = useState(config?.wsUrl ?? '')
	const [apiKey, setApiKey] = useState(config?.apiKey ?? '')

	const [errors, setErrors] = useState<Record<string, string | null>>({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [saved, setSaved] = useState(false)
	const [focusedField, setFocusedField] = useState<FieldName>('serverUrl')

	const focusedIndex = FIELDS.indexOf(focusedField)

	// Auto-return to dashboard after showing success message
	useEffect(() => {
		if (saved) {
			const timer = setTimeout(() => {
				setView('dashboard')
			}, 2000)
			return () => clearTimeout(timer)
		}
	}, [saved, setView])

	const validate = (): boolean => {
		const newErrors: Record<string, string | null> = {}

		try {
			new URL(serverUrl)
		} catch {
			newErrors.serverUrl = 'Please enter a valid URL'
		}

		try {
			new URL(wsUrl)
		} catch {
			newErrors.wsUrl = 'Please enter a valid WebSocket URL'
		}

		if (!apiKey.trim()) {
			newErrors.apiKey = 'API key is required'
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = async () => {
		if (!validate()) return

		setIsSubmitting(true)
		try {
			const newConfig: Config = {
				serverUrl,
				wsUrl,
				apiKey: apiKey.trim(),
			}
			saveConfig(newConfig)
			setSaved(true)
			setIsSubmitting(false)
		} catch (err) {
			setErrors({
				submit:
					err instanceof Error ? err.message : 'Failed to save configuration',
			})
			setIsSubmitting(false)
		}
	}

	const handleFieldSubmit = () => {
		if (focusedIndex < FIELDS.length - 1) {
			setFocusedField(FIELDS[focusedIndex + 1]!)
		} else {
			handleSubmit()
		}
	}

	useInput((_input, key) => {
		if (saved) return

		if (key.escape) {
			setView('dashboard')
			return
		}

		if (key.upArrow || (key.tab && key.shift)) {
			const prevIndex = Math.max(0, focusedIndex - 1)
			setFocusedField(FIELDS[prevIndex]!)
		} else if (key.downArrow || key.tab) {
			const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
			setFocusedField(FIELDS[nextIndex]!)
		}
	})

	if (saved) {
		return (
			<Modal title="Settings" width={60}>
				<Box flexDirection="column" alignItems="center" paddingY={1}>
					<Text color="green">Settings saved.</Text>
					<Text dimColor>Restart to apply connection changes.</Text>
				</Box>
			</Modal>
		)
	}

	const footer = (
		<Text dimColor>
			Tab/Arrows: navigate | Enter:{' '}
			{focusedIndex === FIELDS.length - 1 ? 'save' : 'next'} | Esc: cancel
		</Text>
	)

	return (
		<Modal title="Settings" width={60} footer={footer}>
			{errors.submit && (
				<Box marginBottom={1}>
					<Text color="red">{errors.submit}</Text>
				</Box>
			)}

			<FormField
				label="Server URL"
				value={serverUrl}
				onChange={setServerUrl}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'serverUrl'}
				error={errors.serverUrl}
				placeholder="http://localhost:3000"
			/>

			<FormField
				label="WebSocket URL"
				value={wsUrl}
				onChange={setWsUrl}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'wsUrl'}
				error={errors.wsUrl}
				placeholder="ws://localhost:3001"
			/>

			<FormField
				label="API Key"
				value={apiKey}
				onChange={setApiKey}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'apiKey'}
				error={errors.apiKey}
				placeholder="your-api-key"
			/>

			{isSubmitting && (
				<Box marginTop={1}>
					<Text color="cyan">Saving configuration...</Text>
				</Box>
			)}
		</Modal>
	)
}
