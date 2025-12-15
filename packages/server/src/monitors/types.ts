import type { HttpConfig, IcmpConfig, MonitorResult, TcpConfig } from '@downtime/shared'

export interface Monitor<T = HttpConfig | TcpConfig | IcmpConfig> {
	execute(config: T, timeoutMs: number): Promise<MonitorResult>
}
