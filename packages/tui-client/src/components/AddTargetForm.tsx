import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'
import { FormField } from './FormField'

type FieldName = 'name' | 'url' | 'interval'
const FIELDS: FieldName[] = ['name', 'url', 'interval']

export function AddTargetForm() {
	const { setView, setTargets, targets } = useAppStore()
	const [focusedField, setFocusedField] = useState<FieldName>('name')
	const [name, setName] = useState('')
	const [url, setUrl] = useState('')
	const [interval, setInterval] = useState('60')
	const [errors, setErrors] = useState<Record<string, string | null>>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const focusedIndex = FIELDS.indexOf(focusedField)

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
			const newTarget = await trpc.targets.create.mutate({
				name: name.trim(),
				type: 'http',
				config: { url },
				intervalMs: parseInt(interval, 10) * 1000,
			})

			setTargets([
				...targets,
				{
					...newTarget,
					createdAt: new Date(newTarget.createdAt as unknown as string),
					updatedAt: new Date(newTarget.updatedAt as unknown as string),
					currentStatus: 'unknown',
					lastCheckedAt: null,
					lastResponseTimeMs: null,
				},
			])
			setView('dashboard')
		} catch (err) {
			setErrors({ submit: err instanceof Error ? err.message : 'Failed to create target' })
			setIsSubmitting(false)
		}
	}

	const handleFieldSubmit = () => {
		if (focusedIndex < FIELDS.length - 1) {
			// Move to next field
			setFocusedField(FIELDS[focusedIndex + 1]!)
		} else {
			// Last field, submit form
			handleSubmit()
		}
	}

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

	const footer = (
		<Text dimColor>
			Tab/Arrows: navigate | Enter: {focusedIndex === FIELDS.length - 1 ? 'submit' : 'next'} | Esc: cancel
		</Text>
	)

	return (
		<Modal title="Add New Target" width={60} footer={footer}>
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
				placeholder="My Website"
			/>

			<FormField
				label="URL"
				value={url}
				onChange={setUrl}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'url'}
				error={errors.url}
				placeholder="https://example.com"
			/>

			<FormField
				label="Interval (seconds)"
				value={interval}
				onChange={setInterval}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'interval'}
				error={errors.interval}
				placeholder="60"
			/>

			{isSubmitting && (
				<Box marginTop={1}>
					<Text color="cyan">Creating target...</Text>
				</Box>
			)}
		</Modal>
	)
}
