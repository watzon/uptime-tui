# Additional Monitor Types Design

**Date:** 2025-12-15
**Status:** Approved
**Goal:** Add 5 new monitor types to reach feature parity with Uptime Kuma

## Overview

Extend the downtime-tui monitoring capabilities from HTTP/TCP to include ICMP, DNS, Docker, PostgreSQL, and Redis monitors. This brings the tool closer to Uptime Kuma's functionality while maintaining the TUI-first power user focus.

## New Monitor Types

| Monitor | Purpose | Dependency |
|---------|---------|------------|
| ICMP/Ping | Network reachability | `ping` npm package |
| DNS | Domain resolution verification | Bun built-in (`node:dns`) |
| Docker | Container health monitoring | `dockerode` npm package |
| PostgreSQL | Database connectivity | Bun built-in (`Bun.SQL`) |
| Redis | Cache/queue health | Bun built-in (`Bun.RedisClient`) |

**Total new dependencies:** 2 (`ping`, `dockerode`)

## Configuration Schemas

### ICMP Monitor

```typescript
export const IcmpConfigSchema = z.object({
  host: z.string().min(1),
  packetCount: z.number().min(1).max(10).default(1),
});
```

**Checks:** Host responds to ICMP echo requests.

### DNS Monitor

```typescript
export const DnsConfigSchema = z.object({
  host: z.string().min(1),
  recordType: z.enum(["A", "AAAA", "MX", "TXT", "CNAME", "NS"]).default("A"),
  nameserver: z.string().optional(),
  expectedValue: z.string().optional(),
});
```

**Checks:** DNS resolution succeeds, optionally validates the response contains expected value.

### Docker Monitor

```typescript
export const DockerConfigSchema = z.object({
  containerId: z.string().optional(),
  containerName: z.string().optional(),
  socketPath: z.string().default("/var/run/docker.sock"),
}).refine(d => d.containerId || d.containerName, {
  message: "Either containerId or containerName required"
});
```

**Checks:** Container is running and healthy (if health check configured).

### PostgreSQL Monitor

```typescript
export const PostgresConfigSchema = z.object({
  connectionString: z.string(),
  query: z.string().default("SELECT 1"),
});
```

**Checks:** Can connect and execute query successfully.

### Redis Monitor

```typescript
export const RedisConfigSchema = z.object({
  url: z.string().default("redis://localhost:6379"),
});
```

**Checks:** PING command succeeds.

## Monitor Implementations

### File Structure

```
packages/server/src/monitors/
├── index.ts          # Extended factory
├── http.ts           # Existing
├── tcp.ts            # Existing
├── icmp.ts           # NEW
├── dns.ts            # NEW
├── docker.ts         # NEW
├── postgres.ts       # NEW
└── redis.ts          # NEW
```

### ICMP Monitor

```typescript
import ping from "ping";

export class IcmpMonitor implements Monitor {
  async execute(config: IcmpConfig, timeoutMs: number): Promise<MonitorResult> {
    const start = performance.now();

    const result = await ping.promise.probe(config.host, {
      timeout: Math.ceil(timeoutMs / 1000),
      min_reply: config.packetCount,
    });

    return {
      success: result.alive,
      responseTimeMs: result.time === "unknown" ? null : parseFloat(result.time),
      error: result.alive ? undefined : "Host unreachable",
    };
  }
}
```

### DNS Monitor

```typescript
import dns from "node:dns";

export class DnsMonitor implements Monitor {
  async execute(config: DnsConfig, timeoutMs: number): Promise<MonitorResult> {
    const resolver = new dns.promises.Resolver({ timeout: timeoutMs });

    if (config.nameserver) {
      resolver.setServers([config.nameserver]);
    }

    const start = performance.now();
    const method = `resolve${config.recordType}` as keyof typeof resolver;

    const records = await (resolver[method] as Function)(config.host);
    const responseTimeMs = performance.now() - start;

    if (config.expectedValue) {
      const found = records.some((r: any) =>
        String(r.address ?? r.exchange ?? r).includes(config.expectedValue)
      );
      if (!found) {
        return { success: false, responseTimeMs, error: "Expected value not found" };
      }
    }

    return { success: true, responseTimeMs };
  }
}
```

### Docker Monitor

```typescript
import Docker from "dockerode";

export class DockerMonitor implements Monitor {
  async execute(config: DockerConfig, timeoutMs: number): Promise<MonitorResult> {
    const docker = new Docker({ socketPath: config.socketPath });
    const start = performance.now();

    const container = docker.getContainer(config.containerId ?? config.containerName!);
    const info = await container.inspect();

    const isRunning = info.State.Running;
    const isHealthy = info.State.Health?.Status !== "unhealthy";

    return {
      success: isRunning && isHealthy,
      responseTimeMs: performance.now() - start,
      error: !isRunning ? "Container not running" :
             !isHealthy ? "Container unhealthy" : undefined,
    };
  }
}
```

### PostgreSQL Monitor

```typescript
import { SQL } from "bun";

export class PostgresMonitor implements Monitor {
  async execute(config: PostgresConfig, timeoutMs: number): Promise<MonitorResult> {
    const sql = new SQL(config.connectionString);
    const start = performance.now();

    try {
      await sql.unsafe(config.query);
      return { success: true, responseTimeMs: performance.now() - start };
    } finally {
      await sql.close();
    }
  }
}
```

### Redis Monitor

```typescript
import { RedisClient } from "bun";

export class RedisMonitor implements Monitor {
  async execute(config: RedisConfig, timeoutMs: number): Promise<MonitorResult> {
    const client = new RedisClient(config.url);
    const start = performance.now();

    try {
      await client.ping();
      return { success: true, responseTimeMs: performance.now() - start };
    } finally {
      client.close();
    }
  }
}
```

## Integration Points

### Update Target Type Enum

**File:** `packages/shared/src/types.ts`

```typescript
export type TargetType = "http" | "tcp" | "icmp" | "dns" | "docker" | "postgres" | "redis";
```

### Update Config Union

**File:** `packages/shared/src/schemas.ts`

```typescript
export const TargetConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("http"), ...HttpConfigSchema.shape }),
  z.object({ type: z.literal("tcp"), ...TcpConfigSchema.shape }),
  z.object({ type: z.literal("icmp"), ...IcmpConfigSchema.shape }),
  z.object({ type: z.literal("dns"), ...DnsConfigSchema.shape }),
  z.object({ type: z.literal("docker"), ...DockerConfigSchema.shape }),
  z.object({ type: z.literal("postgres"), ...PostgresConfigSchema.shape }),
  z.object({ type: z.literal("redis"), ...RedisConfigSchema.shape }),
]);
```

### Update Monitor Factory

**File:** `packages/server/src/monitors/index.ts`

```typescript
import { IcmpMonitor } from "./icmp";
import { DnsMonitor } from "./dns";
import { DockerMonitor } from "./docker";
import { PostgresMonitor } from "./postgres";
import { RedisMonitor } from "./redis";

export function getMonitor(type: TargetType): Monitor {
  switch (type) {
    case "http": return new HttpMonitor();
    case "tcp": return new TcpMonitor();
    case "icmp": return new IcmpMonitor();
    case "dns": return new DnsMonitor();
    case "docker": return new DockerMonitor();
    case "postgres": return new PostgresMonitor();
    case "redis": return new RedisMonitor();
    default: throw new Error(`Unknown monitor type: ${type}`);
  }
}
```

### TUI Form Updates

The Add/Edit Target forms need to become dynamic based on selected type:

```
┌─ Add Target ─────────────────────────────┐
│ Name: [___________________]              │
│ Type: [HTTP ▼]                           │
│                                          │
│ ─── HTTP Settings ───                    │
│ URL: [___________________]               │
│ Method: [GET ▼]                          │
│ Expected Status: [200]                   │
│                                          │
│ ─── Common Settings ───                  │
│ Interval: [60s ▼]                        │
│                                          │
│ [Cancel]              [Save]             │
└──────────────────────────────────────────┘
```

When type changes, the settings section updates to show relevant fields for that monitor type.

## Dependencies

```bash
bun add ping dockerode
bun add -d @types/ping
```

## Testing Strategy

### Docker Compose Test Services

**File:** `docker-compose.test.yml`

```yaml
services:
  redis-test:
    image: redis:alpine
    ports: ["6380:6379"]

  postgres-test:
    image: postgres:alpine
    environment:
      POSTGRES_PASSWORD: test
    ports: ["5433:5432"]
```

### Test Cases

| Monitor | Success Case | Failure Cases |
|---------|--------------|---------------|
| ICMP | `localhost` responds | Invalid host, timeout |
| DNS | Resolves `google.com` | NXDOMAIN, timeout, wrong expected value |
| Docker | Running container | Stopped, non-existent, unhealthy |
| PostgreSQL | `SELECT 1` succeeds | Bad credentials, unreachable, query fails |
| Redis | `PING` returns `PONG` | Connection refused, auth failure |

## Implementation Order

1. **Shared schemas** - Add all new config schemas and update types
2. **Redis monitor** - Simplest, good pattern validation
3. **PostgreSQL monitor** - Similar pattern to Redis
4. **ICMP monitor** - Add `ping` dependency
5. **DNS monitor** - Uses Bun's `node:dns`
6. **Docker monitor** - Add `dockerode` dependency
7. **TUI form updates** - Dynamic form based on type
8. **Integration tests** - Docker Compose test suite

## Future Considerations

Additional monitor types to consider for later:
- MySQL/MariaDB (Bun.SQL supports it)
- MongoDB
- gRPC health checks
- MQTT (for IoT/home automation)
- Game servers (GameDig)
- SSL certificate expiry monitoring
