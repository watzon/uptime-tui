import type {
	DnsConfig,
	DockerConfig,
	HttpConfig,
	IcmpConfig,
	MonitorResult,
	PostgresConfig,
	RedisConfig,
	TcpConfig,
} from '@uptime-tui/shared'

export interface Monitor<
	T =
		| HttpConfig
		| TcpConfig
		| IcmpConfig
		| DnsConfig
		| DockerConfig
		| PostgresConfig
		| RedisConfig,
> {
	execute(config: T, timeoutMs: number): Promise<MonitorResult>
}
