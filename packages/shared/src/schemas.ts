import { z } from 'zod'

export const targetTypeSchema = z.enum(['http', 'tcp', 'icmp', 'dns', 'docker', 'postgres', 'redis'])
export const targetStatusSchema = z.enum(['up', 'down', 'degraded', 'unknown'])
export const eventTypeSchema = z.enum([
	'up',
	'down',
	'degraded',
	'timeout',
	'error',
	'paused',
	'resumed',
	'certificate_expiring',
	'created',
	'updated',
	'deleted',
])

export const httpConfigSchema = z.object({
	url: z.string().url(),
	method: z.enum(['GET', 'HEAD', 'POST']).optional().default('GET'),
	headers: z.record(z.string()).optional(),
	expectedStatus: z.number().int().min(100).max(599).optional(),
})

export const tcpConfigSchema = z.object({
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535),
})

export const icmpConfigSchema = z.object({
	host: z.string().min(1),
	packetCount: z.number().int().min(1).max(10).optional().default(1),
})

export const dnsConfigSchema = z.object({
	host: z.string().min(1),
	recordType: z.enum(['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS']).optional().default('A'),
	nameserver: z.string().optional(),
	expectedValue: z.string().optional(),
})

export const dockerConfigBaseSchema = z.object({
	containerId: z.string().optional(),
	containerName: z.string().optional(),
	socketPath: z.string().optional().default('/var/run/docker.sock'),
})

export const dockerConfigSchema = dockerConfigBaseSchema.refine(
	(data) => data.containerId || data.containerName,
	{ message: 'Either containerId or containerName is required' }
)

export const postgresConfigSchema = z.object({
	connectionString: z.string().min(1),
	query: z.string().optional().default('SELECT 1'),
})

export const redisConfigSchema = z.object({
	url: z.string().optional().default('redis://localhost:6379'),
})

export const targetConfigSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('http'), ...httpConfigSchema.shape }),
	z.object({ type: z.literal('tcp'), ...tcpConfigSchema.shape }),
	z.object({ type: z.literal('icmp'), ...icmpConfigSchema.shape }),
	z.object({ type: z.literal('dns'), ...dnsConfigSchema.shape }),
	z.object({ type: z.literal('docker'), ...dockerConfigBaseSchema.shape }),
	z.object({ type: z.literal('postgres'), ...postgresConfigSchema.shape }),
	z.object({ type: z.literal('redis'), ...redisConfigSchema.shape }),
])

// Helper to get the correct config schema for a target type
const configSchemaMap = {
	http: httpConfigSchema,
	tcp: tcpConfigSchema,
	icmp: icmpConfigSchema,
	dns: dnsConfigSchema,
	docker: dockerConfigBaseSchema,
	postgres: postgresConfigSchema,
	redis: redisConfigSchema,
} as const

export const createTargetInputSchema = z
	.object({
		name: z.string().min(1).max(100),
		type: targetTypeSchema,
		config: z.record(z.unknown()), // Accept any object initially
		intervalMs: z.number().int().min(5000).max(3600000).optional().default(60000),
		timeoutMs: z.number().int().min(1000).max(60000).optional().default(5000),
		enabled: z.boolean().optional().default(true),
		failureThreshold: z.number().int().min(1).max(10).optional().default(2),
	})
	.superRefine((data, ctx) => {
		const schema = configSchemaMap[data.type]
		const result = schema.safeParse(data.config)
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({
					...issue,
					path: ['config', ...issue.path],
				})
			}
		}
	})
	.transform((data) => {
		// Re-parse config with the correct schema to apply defaults
		const schema = configSchemaMap[data.type]
		return {
			...data,
			config: schema.parse(data.config),
		}
	})

// For updates, we accept any config object - server validates against target's type
export const updateTargetInputSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	config: z.record(z.unknown()).optional(),
	intervalMs: z.number().int().min(5000).max(3600000).optional(),
	timeoutMs: z.number().int().min(1000).max(60000).optional(),
	enabled: z.boolean().optional(),
	failureThreshold: z.number().int().min(1).max(10).optional(),
})

export const metricsQueryInputSchema = z.object({
	targetId: z.string().uuid(),
	startTime: z.date(),
	endTime: z.date(),
	aggregation: z.enum(['raw', '1m', '5m', '1h', '1d']).optional().default('raw'),
	limit: z.number().int().min(1).max(10000).optional().default(1000),
})

export const uptimeSummaryInputSchema = z.object({
	targetId: z.string().uuid(),
	period: z.enum(['1h', '24h', '7d', '30d']),
})

export const eventsListInputSchema = z.object({
	targetId: z.string().uuid().optional(),
	types: z.array(eventTypeSchema).optional(),
	limit: z.number().int().min(1).max(100).optional().default(50),
	cursor: z.string().optional(),
})

export const createWebhookInputSchema = z.object({
	name: z.string().min(1).max(100),
	url: z.string().url(),
	events: z.array(eventTypeSchema).min(1),
	enabled: z.boolean().optional().default(true),
})

export const updateWebhookInputSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	url: z.string().url().optional(),
	events: z.array(eventTypeSchema).min(1).optional(),
	enabled: z.boolean().optional(),
})

export type CreateTargetInput = z.infer<typeof createTargetInputSchema>
export type UpdateTargetInput = z.infer<typeof updateTargetInputSchema>
export type MetricsQueryInput = z.infer<typeof metricsQueryInputSchema>
export type UptimeSummaryInput = z.infer<typeof uptimeSummaryInputSchema>
export type EventsListInput = z.infer<typeof eventsListInputSchema>
export type CreateWebhookInput = z.infer<typeof createWebhookInputSchema>
export type UpdateWebhookInput = z.infer<typeof updateWebhookInputSchema>
