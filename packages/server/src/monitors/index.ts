import type { HttpConfig, IcmpConfig, TargetType, TcpConfig } from '@downtime/shared'
import { HttpMonitor } from './http'
import { TcpMonitor } from './tcp'
import type { Monitor } from './types'

const httpMonitor = new HttpMonitor()
const tcpMonitor = new TcpMonitor()

export function getMonitor(type: TargetType): Monitor {
	switch (type) {
		case 'http':
			return httpMonitor as Monitor
		case 'tcp':
			return tcpMonitor as Monitor
		case 'icmp':
			throw new Error('ICMP monitor not yet implemented')
		default:
			throw new Error(`Unknown monitor type: ${type}`)
	}
}

export { HttpMonitor } from './http'
export { TcpMonitor } from './tcp'
export type { Monitor } from './types'
