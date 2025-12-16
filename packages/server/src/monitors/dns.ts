import dns from 'node:dns'
import type { DnsConfig, MonitorResult } from '@uptime-tui/shared'
import type { Monitor } from './types'

type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS'

export class DnsMonitor implements Monitor<DnsConfig> {
	async execute(config: DnsConfig, timeoutMs: number): Promise<MonitorResult> {
		const startTime = performance.now()
		const recordType = config.recordType ?? 'A'

		const resolver = new dns.promises.Resolver({ timeout: timeoutMs })

		if (config.nameserver) {
			resolver.setServers([config.nameserver])
		}

		try {
			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error(`DNS lookup timed out after ${timeoutMs}ms`)),
					timeoutMs,
				)
			})

			// Resolve based on record type
			const resolvePromise = this.resolveRecord(
				resolver,
				config.host,
				recordType,
			)

			const records = await Promise.race([resolvePromise, timeoutPromise])
			const responseTimeMs = Math.round(performance.now() - startTime)

			// Validate expected value if provided
			if (config.expectedValue) {
				const found = this.containsExpectedValue(records, config.expectedValue)
				if (!found) {
					return {
						status: 'down',
						responseTimeMs,
						error: `Expected value "${config.expectedValue}" not found in DNS response`,
					}
				}
			}

			return {
				status: 'up',
				responseTimeMs,
			}
		} catch (error) {
			const responseTimeMs = Math.round(performance.now() - startTime)
			return {
				status: 'down',
				responseTimeMs,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	private async resolveRecord(
		resolver: dns.promises.Resolver,
		host: string,
		recordType: DnsRecordType,
	): Promise<unknown[]> {
		switch (recordType) {
			case 'A':
				return resolver.resolve4(host)
			case 'AAAA':
				return resolver.resolve6(host)
			case 'MX':
				return resolver.resolveMx(host)
			case 'TXT':
				return resolver.resolveTxt(host)
			case 'CNAME':
				return resolver.resolveCname(host)
			case 'NS':
				return resolver.resolveNs(host)
			default:
				throw new Error(`Unsupported record type: ${recordType}`)
		}
	}

	private containsExpectedValue(
		records: unknown[],
		expectedValue: string,
	): boolean {
		return records.some((record) => {
			if (typeof record === 'string') {
				return record.includes(expectedValue)
			}
			// MX records have { exchange, priority } shape
			if (typeof record === 'object' && record !== null) {
				const obj = record as Record<string, unknown>
				if ('exchange' in obj && typeof obj.exchange === 'string') {
					return obj.exchange.includes(expectedValue)
				}
				if ('address' in obj && typeof obj.address === 'string') {
					return obj.address.includes(expectedValue)
				}
			}
			// TXT records are arrays of strings
			if (Array.isArray(record)) {
				return record.some(
					(r) => typeof r === 'string' && r.includes(expectedValue),
				)
			}
			return String(record).includes(expectedValue)
		})
	}
}
