import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TargetType } from '@downtime/shared'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'
import { Modal } from './Modal'
import { FormField } from './FormField'
import { SelectField } from './SelectField'

const TARGET_TYPE_OPTIONS = [
	{ value: 'http', label: 'HTTP' },
	{ value: 'tcp', label: 'TCP' },
	{ value: 'icmp', label: 'ICMP/Ping' },
	{ value: 'dns', label: 'DNS' },
	{ value: 'docker', label: 'Docker' },
	{ value: 'postgres', label: 'PostgreSQL' },
	{ value: 'redis', label: 'Redis' },
]

const DNS_RECORD_TYPES = [
	{ value: 'A', label: 'A' },
	{ value: 'AAAA', label: 'AAAA' },
	{ value: 'MX', label: 'MX' },
	{ value: 'TXT', label: 'TXT' },
	{ value: 'CNAME', label: 'CNAME' },
	{ value: 'NS', label: 'NS' },
]

type FieldName =
	| 'name'
	| 'type'
	| 'interval'
	// HTTP
	| 'url'
	// TCP
	| 'host'
	| 'port'
	// ICMP
	| 'icmpHost'
	// DNS
	| 'dnsHost'
	| 'recordType'
	| 'nameserver'
	| 'expectedValue'
	// Docker
	| 'containerName'
	| 'socketPath'
	// PostgreSQL
	| 'connectionString'
	| 'query'
	// Redis
	| 'redisUrl'

function getFieldsForType(type: TargetType): FieldName[] {
	const commonStart: FieldName[] = ['name', 'type']
	const commonEnd: FieldName[] = ['interval']

	switch (type) {
		case 'http':
			return [...commonStart, 'url', ...commonEnd]
		case 'tcp':
			return [...commonStart, 'host', 'port', ...commonEnd]
		case 'icmp':
			return [...commonStart, 'icmpHost', ...commonEnd]
		case 'dns':
			return [...commonStart, 'dnsHost', 'recordType', 'nameserver', 'expectedValue', ...commonEnd]
		case 'docker':
			return [...commonStart, 'containerName', 'socketPath', ...commonEnd]
		case 'postgres':
			return [...commonStart, 'connectionString', 'query', ...commonEnd]
		case 'redis':
			return [...commonStart, 'redisUrl', ...commonEnd]
		default:
			return [...commonStart, ...commonEnd]
	}
}

export function AddTargetForm() {
	const { setView, setTargets, targets } = useAppStore()

	// Common fields
	const [name, setName] = useState('')
	const [type, setType] = useState<TargetType>('http')
	const [interval, setInterval] = useState('60')

	// HTTP fields
	const [url, setUrl] = useState('')

	// TCP fields
	const [host, setHost] = useState('')
	const [port, setPort] = useState('')

	// ICMP fields
	const [icmpHost, setIcmpHost] = useState('')

	// DNS fields
	const [dnsHost, setDnsHost] = useState('')
	const [recordType, setRecordType] = useState('A')
	const [nameserver, setNameserver] = useState('')
	const [expectedValue, setExpectedValue] = useState('')

	// Docker fields
	const [containerName, setContainerName] = useState('')
	const [socketPath, setSocketPath] = useState('/var/run/docker.sock')

	// PostgreSQL fields
	const [connectionString, setConnectionString] = useState('')
	const [query, setQuery] = useState('SELECT 1')

	// Redis fields
	const [redisUrl, setRedisUrl] = useState('redis://localhost:6379')

	const [errors, setErrors] = useState<Record<string, string | null>>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const fields = getFieldsForType(type)
	const [focusedField, setFocusedField] = useState<FieldName>('name')
	const focusedIndex = fields.indexOf(focusedField)

	// Reset focus when type changes if current field doesn't exist
	const handleTypeChange = (newType: string) => {
		setType(newType as TargetType)
		const newFields = getFieldsForType(newType as TargetType)
		if (!newFields.includes(focusedField)) {
			setFocusedField('type')
		}
	}

	const validate = (): boolean => {
		const newErrors: Record<string, string | null> = {}

		if (name.trim().length === 0) {
			newErrors.name = 'Name is required'
		}

		const intervalNum = parseInt(interval, 10)
		if (isNaN(intervalNum) || intervalNum < 5 || intervalNum > 3600) {
			newErrors.interval = 'Must be between 5 and 3600 seconds'
		}

		// Type-specific validation
		switch (type) {
			case 'http':
				try {
					new URL(url)
				} catch {
					newErrors.url = 'Please enter a valid URL'
				}
				break
			case 'tcp':
				if (!host.trim()) newErrors.host = 'Host is required'
				const portNum = parseInt(port, 10)
				if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
					newErrors.port = 'Port must be between 1 and 65535'
				}
				break
			case 'icmp':
				if (!icmpHost.trim()) newErrors.icmpHost = 'Host is required'
				break
			case 'dns':
				if (!dnsHost.trim()) newErrors.dnsHost = 'Host is required'
				break
			case 'docker':
				if (!containerName.trim()) newErrors.containerName = 'Container name is required'
				break
			case 'postgres':
				if (!connectionString.trim()) newErrors.connectionString = 'Connection string is required'
				break
			case 'redis':
				// Redis URL has a default, so it's optional
				break
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const buildConfig = () => {
		switch (type) {
			case 'http':
				return { url }
			case 'tcp':
				return { host, port: parseInt(port, 10) }
			case 'icmp':
				return { host: icmpHost }
			case 'dns':
				return {
					host: dnsHost,
					recordType: recordType as 'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS',
					...(nameserver && { nameserver }),
					...(expectedValue && { expectedValue }),
				}
			case 'docker':
				return {
					containerName,
					socketPath,
				}
			case 'postgres':
				return {
					connectionString,
					query,
				}
			case 'redis':
				return {
					url: redisUrl,
				}
			default:
				return {}
		}
	}

	const handleSubmit = async () => {
		if (!validate()) return

		setIsSubmitting(true)
		try {
			const newTarget = await trpc.targets.create.mutate({
				name: name.trim(),
				type,
				config: buildConfig(),
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
		if (focusedIndex < fields.length - 1) {
			setFocusedField(fields[focusedIndex + 1]!)
		} else {
			handleSubmit()
		}
	}

	useInput((input, key) => {
		if (key.escape) {
			setView('dashboard')
			return
		}

		// Don't handle navigation for select fields (they use left/right)
		if (focusedField === 'type' || focusedField === 'recordType') {
			if (key.upArrow || key.downArrow || key.tab) {
				if (key.upArrow || (key.tab && key.shift)) {
					const prevIndex = Math.max(0, focusedIndex - 1)
					setFocusedField(fields[prevIndex]!)
				} else if (key.downArrow || key.tab) {
					const nextIndex = Math.min(fields.length - 1, focusedIndex + 1)
					setFocusedField(fields[nextIndex]!)
				}
			}
			return
		}

		if (key.upArrow || (input === 'k' && key.shift)) {
			const prevIndex = Math.max(0, focusedIndex - 1)
			setFocusedField(fields[prevIndex]!)
		} else if (key.downArrow || (input === 'j' && key.shift)) {
			const nextIndex = Math.min(fields.length - 1, focusedIndex + 1)
			setFocusedField(fields[nextIndex]!)
		} else if (key.tab) {
			if (key.shift) {
				const prevIndex = Math.max(0, focusedIndex - 1)
				setFocusedField(fields[prevIndex]!)
			} else {
				const nextIndex = Math.min(fields.length - 1, focusedIndex + 1)
				setFocusedField(fields[nextIndex]!)
			}
		}
	})

	const footer = (
		<Text dimColor>
			Tab/Arrows: navigate | Enter: {focusedIndex === fields.length - 1 ? 'submit' : 'next'} | Esc: cancel
		</Text>
	)

	const renderTypeSpecificFields = () => {
		switch (type) {
			case 'http':
				return (
					<FormField
						label="URL"
						value={url}
						onChange={setUrl}
						onSubmit={handleFieldSubmit}
						isFocused={focusedField === 'url'}
						error={errors.url}
						placeholder="https://example.com"
					/>
				)
			case 'tcp':
				return (
					<>
						<FormField
							label="Host"
							value={host}
							onChange={setHost}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'host'}
							error={errors.host}
							placeholder="example.com"
						/>
						<FormField
							label="Port"
							value={port}
							onChange={setPort}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'port'}
							error={errors.port}
							placeholder="443"
						/>
					</>
				)
			case 'icmp':
				return (
					<FormField
						label="Host"
						value={icmpHost}
						onChange={setIcmpHost}
						onSubmit={handleFieldSubmit}
						isFocused={focusedField === 'icmpHost'}
						error={errors.icmpHost}
						placeholder="example.com or 192.168.1.1"
					/>
				)
			case 'dns':
				return (
					<>
						<FormField
							label="Domain"
							value={dnsHost}
							onChange={setDnsHost}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'dnsHost'}
							error={errors.dnsHost}
							placeholder="example.com"
						/>
						<SelectField
							label="Record Type"
							value={recordType}
							options={DNS_RECORD_TYPES}
							onChange={setRecordType}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'recordType'}
						/>
						<FormField
							label="Nameserver (optional)"
							value={nameserver}
							onChange={setNameserver}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'nameserver'}
							error={errors.nameserver}
							placeholder="8.8.8.8"
						/>
						<FormField
							label="Expected Value (optional)"
							value={expectedValue}
							onChange={setExpectedValue}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'expectedValue'}
							error={errors.expectedValue}
							placeholder="93.184.216.34"
						/>
					</>
				)
			case 'docker':
				return (
					<>
						<FormField
							label="Container Name/ID"
							value={containerName}
							onChange={setContainerName}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'containerName'}
							error={errors.containerName}
							placeholder="my-container"
						/>
						<FormField
							label="Socket Path"
							value={socketPath}
							onChange={setSocketPath}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'socketPath'}
							error={errors.socketPath}
							placeholder="/var/run/docker.sock"
						/>
					</>
				)
			case 'postgres':
				return (
					<>
						<FormField
							label="Connection String"
							value={connectionString}
							onChange={setConnectionString}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'connectionString'}
							error={errors.connectionString}
							placeholder="postgres://user:pass@localhost:5432/db"
						/>
						<FormField
							label="Query"
							value={query}
							onChange={setQuery}
							onSubmit={handleFieldSubmit}
							isFocused={focusedField === 'query'}
							error={errors.query}
							placeholder="SELECT 1"
						/>
					</>
				)
			case 'redis':
				return (
					<FormField
						label="Redis URL"
						value={redisUrl}
						onChange={setRedisUrl}
						onSubmit={handleFieldSubmit}
						isFocused={focusedField === 'redisUrl'}
						error={errors.redisUrl}
						placeholder="redis://localhost:6379"
					/>
				)
			default:
				return null
		}
	}

	return (
		<Modal title="Add New Target" width={65} footer={footer}>
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
				placeholder="My Service"
			/>

			<SelectField
				label="Type"
				value={type}
				options={TARGET_TYPE_OPTIONS}
				onChange={handleTypeChange}
				onSubmit={handleFieldSubmit}
				isFocused={focusedField === 'type'}
			/>

			{renderTypeSpecificFields()}

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
