import { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { HttpConfig } from '@downtime/shared'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'
import { FormField } from './FormField'

type FieldName = 'name' | 'url' | 'interval'
const FIELDS: FieldName[] = ['name', 'url', 'interval']

export function EditTargetForm() {
	const { setView, targets, selectedTargetId, updateTarget } = useAppStore()
	const selectedTarget = targets.find((t) => t.id === selectedTargetId)

	const [focusedField, setFocusedField] = useState<FieldName>('name')
	const [name, setName] = useState('')
	const [url, setUrl] = useState('')
	const [interval, setInterval] = useState('60')
	const [errors, setErrors] = useState<Record<string, string | null>>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const focusedIndex = FIELDS.indexOf(focusedField)

	useEffect(() => {
		if (selectedTarget) {
			setName(selectedTarget.name)
			const config = selectedTarget.config as HttpConfig
			setUrl(config.url || '')
			setInterval(String(Math.round(selectedTarget.intervalMs / 1000)))
		}
	}, [selectedTarget])

	useInput((input, key) => {
		if (key.escape) {
			setView('dashboard')
			return
		}

		if (key.upArrow || (input === 'k' && key.shift)) {
			const prevIndex = Math.max(0, focusedIndex - 1)
			setFocusedField(FIELDS[prevIndex]!)
		} else if (key.downArrow || (input === 'j' && key.shift)) {
			const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
			setFocusedField(FIELDS[nextIndex]!)
		} else if (key.tab) {
			if (key.shift) {
				const prevIndex = Math.max(0, focusedIndex - 1)
				setFocusedField(FIELDS[prevIndex]!)
			} else {
				const nextIndex = Math.min(FIELDS.length - 1, focusedIndex + 1)
				setFocusedField(FIELDS[nextIndex]!)
			}
		}
	})

	if (!selectedTarget) {
		return (
			<Modal title="Edit Target" width={60}>
				<Text color="red">No target selected</Text>
				<Text dimColor>Press ESC to go back</Text>
			</Modal>
		)
	}

	const validate = (): boolean => {
		const newErrors: Record<string, string | null> = {}

		if (name.trim().length === 0) {
			newErrors.name = 'Name is required'
		}

		try {
			new URL(url)
		} catch {
			newErrors.url = 'Please enter a valid URL'
		}

		const intervalNum = parseInt(interval, 10)
		if (isNaN(intervalNum) || intervalNum < 5 || intervalNum > 3600) {
			newErrors.interval = 'Must be between 5 and 3600 seconds'
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = async () => {
		if (!validate()) return

		setIsSubmitting(true)
		try {
			const updatedTarget = await trpc.targets.update.mutate({
				id: selectedTarget.id,
				name: name.trim(),
				config: { url },
				intervalMs: parseInt(interval, 10) * 1000,
			})

			updateTarget({
				...selectedTarget,
				...updatedTarget,
				createdAt: new Date(updatedTarget.createdAt as unknown as string),
				updatedAt: new Date(updatedTarget.updatedAt as unknown as string),
			})
			setView('dashboard')
		} catch (err) {
			setErrors({ submit: err instanceof Error ? err.message : 'Failed to update target' })
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

	const footer = (
		<Text dimColor>
			Tab/Arrows: navigate | Enter: {focusedIndex === FIELDS.length - 1 ? 'save' : 'next'} | Esc: cancel
		</Text>
	)

	return (
		<Modal title="Edit Target" width={60} footer={footer}>
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
			/>

			<FormField
				label="URL"
				value={url}
				onChange={setUrl}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'url'}
				error={errors.url}
			/>

			<FormField
				label="Interval (seconds)"
				value={interval}
				onChange={setInterval}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'interval'}
				error={errors.interval}
			/>

			{isSubmitting && (
				<Box marginTop={1}>
					<Text color="cyan">Saving changes...</Text>
				</Box>
			)}
		</Modal>
	)
}
