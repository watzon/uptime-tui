export type TargetType = 'http' | 'tcp' | 'icmp'
export type TargetStatus = 'up' | 'down' | 'degraded' | 'unknown'
export type EventType = 'up' | 'down' | 'created' | 'updated' | 'deleted'

export interface HttpConfig {
	url: string
	method?: 'GET' | 'HEAD' | 'POST'
	headers?: Record<string, string>
	expectedStatus?: number
}

export interface TcpConfig {
	host: string
	port: number
}

export interface IcmpConfig {
	host: string
}

export type TargetConfig = HttpConfig | TcpConfig | IcmpConfig

export interface Target {
	id: string
	ownerId: string | null
	name: string
	type: TargetType
	config: TargetConfig
	intervalMs: number
	timeoutMs: number
	enabled: boolean
	failureThreshold: number
	createdAt: Date
	updatedAt: Date
}

export interface TargetWithStatus extends Target {
	currentStatus: TargetStatus
	lastCheckedAt: Date | null
	lastResponseTimeMs: number | null
}

export interface Metric {
	time: Date
	targetId: string
	status: TargetStatus
	responseTimeMs: number | null
	statusCode: number | null
	error: string | null
}

export interface Event {
	id: string
	targetId: string
	type: EventType
	message: string
	metadata: Record<string, unknown>
	createdAt: Date
}

export interface WebhookConfig {
	id: string
	ownerId: string | null
	name: string
	url: string
	events: EventType[]
	enabled: boolean
	createdAt: Date
	updatedAt: Date
}

export interface UptimeSummary {
	targetId: string
	period: '1h' | '24h' | '7d' | '30d'
	uptimePercent: number
	avgResponseTimeMs: number | null
	totalChecks: number
	successfulChecks: number
	failedChecks: number
}

export interface MonitorResult {
	status: TargetStatus
	responseTimeMs: number | null
	statusCode?: number
	error?: string
}
