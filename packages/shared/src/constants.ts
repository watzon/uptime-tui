export const DEFAULT_INTERVAL_MS = 60000
export const DEFAULT_TIMEOUT_MS = 5000
export const DEFAULT_FAILURE_THRESHOLD = 2

export const MIN_INTERVAL_MS = 5000
export const MAX_INTERVAL_MS = 3600000

export const MIN_TIMEOUT_MS = 1000
export const MAX_TIMEOUT_MS = 60000

export const STATUS_COLORS = {
	up: 'green',
	down: 'red',
	degraded: 'yellow',
	unknown: 'gray',
} as const

export const STATUS_ICONS = {
	up: '●',
	down: '○',
	degraded: '◐',
	unknown: '◌',
} as const

export const EVENT_TYPE_LABELS = {
	up: 'Went UP',
	down: 'Went DOWN',
	degraded: 'Degraded',
	timeout: 'Timed Out',
	error: 'Error',
	paused: 'Paused',
	resumed: 'Resumed',
	certificate_expiring: 'Cert Expiring',
	created: 'Created',
	updated: 'Updated',
	deleted: 'Deleted',
} as const
