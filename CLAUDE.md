# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uptime TUI is a terminal-based uptime monitoring system with real-time updates. It's a Bun monorepo using Turborepo with three packages:

- **@downtime/server** - tRPC server with PostgreSQL/TimescaleDB storage and WebSocket subscriptions
- **@downtime/tui-client** - Ink-based (React for terminal) TUI client with real-time updates
- **@downtime/shared** - Shared Zod schemas and TypeScript types

## Commands

```bash
# Install dependencies
bun install

# Development (runs both server and client via Turbo)
bun run dev

# Run server only
bun run --cwd packages/server dev

# Run TUI client only
bun run --cwd packages/tui-client dev

# Type checking
bun run typecheck

# Linting and formatting (Biome)
bun run lint          # Check only
bun run lint:fix      # Fix issues
bun run format        # Format files

# Database commands (requires Docker for PostgreSQL)
docker compose up -d                              # Start PostgreSQL + TimescaleDB
bun run db:push                                   # Push schema (development)
bun run db:generate                               # Generate migration from schema changes
bun run db:migrate                                # Apply migrations
bun run --cwd packages/server db:setup-timescale  # Set up TimescaleDB hypertable
bun run --cwd packages/server db:studio           # Open Drizzle Studio
```

## Architecture

### Server (`packages/server`)

The server uses tRPC with both HTTP and WebSocket transports:

- **Entry**: `src/index.ts` - Sets up HTTP server, WebSocket server, scheduler, and webhook dispatcher
- **tRPC Router**: `src/trpc/router.ts` - Combines sub-routers: auth, targets, metrics, events, webhooks, subscriptions
- **Database**: Drizzle ORM with PostgreSQL + TimescaleDB
  - Schema: `src/db/schema.ts` - Tables: targets, metrics (hypertable), events, webhook_configs, target_current_status
- **Scheduler**: `src/scheduler/index.ts` - Manages check intervals per target, emits events on status changes
- **Monitors**: `src/monitors/` - Monitor implementations (http, tcp, icmp, dns, docker, postgres, redis)

### TUI Client (`packages/tui-client`)

React-based terminal UI using Ink:

- **Entry**: `src/index.tsx` - Renders the App
- **App**: `src/App.tsx` - View routing based on Zustand store state
- **State**: `src/stores/app.ts` - Zustand store for targets, events, UI state
- **Data**: `src/hooks/useData.ts` - Initial data loading via tRPC queries
- **Subscriptions**: `src/hooks/useSubscriptions.ts` - Real-time updates via tRPC WebSocket subscriptions
- **Components**: `src/components/` - UI components (Layout, TargetList, DetailPanel, etc.)

### Shared (`packages/shared`)

- **Schemas**: `src/schemas.ts` - Zod schemas for all API inputs (createTarget, updateTarget, etc.)
- **Types**: `src/types.ts` - TypeScript types derived from schemas and database

### Data Flow

1. Server scheduler runs monitors at configured intervals
2. Results stored in metrics table, status changes stored in events table
3. Scheduler emits events via EventEmitter (`schedulerEvents`)
4. tRPC subscriptions broadcast changes to connected clients
5. TUI client updates Zustand store, React re-renders

## Code Style

- **Formatter**: Biome with tabs, single quotes, no semicolons, trailing commas
- **Imports**: Organized automatically by Biome
- **Type exports**: Types exported from `@downtime/shared`, server types via `AppRouter` export

## Monitor Types

Each target type has a specific config schema in `packages/shared/src/schemas.ts`:
- `http` - URL monitoring with configurable method/headers/expected status
- `tcp` - Port connectivity check
- `icmp` - Ping monitoring
- `dns` - DNS record resolution
- `docker` - Container health via Docker socket
- `postgres` - Database connectivity
- `redis` - Redis connectivity
