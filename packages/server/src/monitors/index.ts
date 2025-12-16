import type { TargetType } from '@uptime-tui/shared'
import { DnsMonitor } from './dns'
import { DockerMonitor } from './docker'
import { HttpMonitor } from './http'
import { IcmpMonitor } from './icmp'
import { PostgresMonitor } from './postgres'
import { RedisMonitor } from './redis'
import { TcpMonitor } from './tcp'
import type { Monitor } from './types'

const httpMonitor = new HttpMonitor()
const tcpMonitor = new TcpMonitor()
const icmpMonitor = new IcmpMonitor()
const dnsMonitor = new DnsMonitor()
const dockerMonitor = new DockerMonitor()
const postgresMonitor = new PostgresMonitor()
const redisMonitor = new RedisMonitor()

export function getMonitor(type: TargetType): Monitor {
	switch (type) {
		case 'http':
			return httpMonitor as Monitor
		case 'tcp':
			return tcpMonitor as Monitor
		case 'icmp':
			return icmpMonitor as Monitor
		case 'dns':
			return dnsMonitor as Monitor
		case 'docker':
			return dockerMonitor as Monitor
		case 'postgres':
			return postgresMonitor as Monitor
		case 'redis':
			return redisMonitor as Monitor
		default:
			throw new Error(`Unknown monitor type: ${type}`)
	}
}

export { DnsMonitor } from './dns'
export { DockerMonitor } from './docker'
export { HttpMonitor } from './http'
export { IcmpMonitor } from './icmp'
export { PostgresMonitor } from './postgres'
export { RedisMonitor } from './redis'
export { TcpMonitor } from './tcp'
export type { Monitor } from './types'
