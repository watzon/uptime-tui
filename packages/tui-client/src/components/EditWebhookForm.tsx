import type { EventType } from '@uptime-tui/shared'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { CheckboxField, toggleCheckbox } from './CheckboxField'
import { FormField } from './FormField'
import { Modal } from './Modal'

const EVENT_OPTIONS = [
	{ value: 'up', label: 'up' },
	{ value: 'down', label: 'down' },
	{ value: 'degraded', label: 'degraded' },
	{ value: 'timeout', label: 'timeout' },
	{ value: 'error', label: 'error' },
	{ value: 'paused', label: 'paused' },
	{ value: 'resumed', label: 'resumed' },
	{ value: 'certificate_expiring', label: 'cert_exp' },
	{ value: 'created', label: 'created' },
	{ value: 'updated', label: 'updated' },
	{ value: 'deleted', label: 'deleted' },
]

type FieldName = 'name' | 'url' | 'events' | 'enabled'
const FIELDS: FieldName[] = ['name', 'url', 'events', 'enabled']

export function EditWebhookForm() {
	const { setView, webhooks, selectedWebhookId, updateWebhook } = useAppStore()

	const webhook = webhooks.find((w) => w.id === selectedWebhookId)

	const [name, setName] = useState(webhook?.name ?? '')
	const [url, setUrl] = useState(webhook?.url ?? '')
	const [events, setEvents] = useState<string[]>(
		webhook?.events ?? ['up', 'down', 'error'],
	)
	const [enabled, setEnabled] = useState(webhook?.enabled ?? true)

	const [errors, setErrors] = useState<Record<string, string | null>>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const [focusedField, setFocusedField] = useState<FieldName>('name')
	const [checkboxFocusIndex, setCheckboxFocusIndex] = useState(0)
	const focusedIndex = FIELDS.indexOf(focusedField)

	if (!webhook) {
		return (
			<Modal title="Edit Webhook" width={60}>
				<Text color="red">Webhook not found</Text>
			</Modal>
		)
	}

	const validate = (): boolean => {
		const newErrors: Record<string, string | null> = {}

		if (name.trim().length === 0) {
			newErrors.name = 'Name is required'
		} else if (name.length > 100) {
			newErrors.name = 'Name must be 100 characters or less'
		}

		try {
			new URL(url)
		} catch {
			newErrors.url = 'Please enter a valid URL'
		}

		if (events.length === 0) {
			newErrors.events = 'Select at least one event'
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = async () => {
		if (!validate()) return

		setIsSubmitting(true)
		try {
			const updatedWebhook = await trpc.webhooks.update.mutate({
				id: webhook.id,
				name: name.trim(),
				url: url.trim(),
				events: events as EventType[],
				enabled,
			})

			updateWebhook({
				...updatedWebhook,
				createdAt: new Date(updatedWebhook.createdAt as unknown as string),
				updatedAt: new Date(updatedWebhook.updatedAt as unknown as string),
			})
			setView('dashboard')
		} catch (err) {
			setErrors({
				submit: err instanceof Error ? err.message : 'Failed to update webhook',
			})
			setIsSubmitting(false)
		}
	}

	const handleFieldSubmit = () => {
		if (focusedField === 'enabled') {
			handleSubmit()
		} else {
			const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
			setFocusedField(FIELDS[nextIndex]!)
		}
	}

	useInput((input, key) => {
		if (key.escape) {
			setView('dashboard')
			return
		}

		// Handle checkbox field navigation
		if (focusedField === 'events') {
			if (key.leftArrow) {
				setCheckboxFocusIndex(Math.max(0, checkboxFocusIndex - 1))
				return
			}
			if (key.rightArrow) {
				setCheckboxFocusIndex(
					Math.min(EVENT_OPTIONS.length - 1, checkboxFocusIndex + 1),
				)
				return
			}
			if (input === ' ') {
				setEvents(toggleCheckbox(EVENT_OPTIONS, events, checkboxFocusIndex))
				return
			}
		}

		// Handle enabled field toggle
		if (focusedField === 'enabled') {
			if (input === ' ' || key.leftArrow || key.rightArrow) {
				setEnabled(!enabled)
				return
			}
		}

		// Navigation between fields
		if (key.upArrow || (key.tab && key.shift)) {
			const prevIndex = Math.max(0, focusedIndex - 1)
			setFocusedField(FIELDS[prevIndex]!)
		} else if (key.downArrow || key.tab) {
			const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
			setFocusedField(FIELDS[nextIndex]!)
		}
	})

	const footer = (
		<Text dimColor>
			Tab/Arrows: navigate | Space: toggle | Enter:{' '}
			{focusedField === 'enabled' ? 'save' : 'next'} | Esc: cancel
		</Text>
	)

	return (
		<Modal title={`Edit Webhook: ${webhook.name}`} width={70} footer={footer}>
			{errors.submit && (
				<Box marginBottom={1}>
					<Text color="red">{errors.submit}</Text>
				</Box>
			)}

			<FormField
				label="Name"
				value={name}
				onChange={setName}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'name'}
				error={errors.name}
				placeholder="Discord Alerts"
			/>

			<FormField
				label="URL"
				value={url}
				onChange={setUrl}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'url'}
				error={errors.url}
				placeholder="https://discord.com/api/webhooks/..."
			/>

			<CheckboxField
				label="Events"
				options={EVENT_OPTIONS}
				selected={events}
				onChange={setEvents}
				isFocused={focusedField === 'events'}
				focusedIndex={checkboxFocusIndex}
				error={errors.events}
			/>

			<Box marginBottom={1}>
				<Text
					color={focusedField === 'enabled' ? 'cyan' : undefined}
					bold={focusedField === 'enabled'}
				>
					{focusedField === 'enabled' ? '> ' : '  '}
					Enabled:{' '}
				</Text>
				<Text color={enabled ? 'green' : 'gray'}>
					({enabled ? '\u25CF' : '\u25CB'}) {enabled ? 'Yes' : 'No'}
				</Text>
			</Box>

			{isSubmitting && (
				<Box marginTop={1}>
					<Text color="cyan">Updating webhook...</Text>
				</Box>
			)}
		</Modal>
	)
}
