# Downtime TUI

A terminal-based downtime monitoring system with real-time updates.

## Architecture

- **@downtime/server** - tRPC server with PostgreSQL/TimescaleDB storage
- **@downtime/tui-client** - Ink-based TUI client with real-time subscriptions
- **@downtime/shared** - Shared types and Zod schemas

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://docker.com) (for PostgreSQL + TimescaleDB)

## Quick Start

```bash
# Install dependencies
bun install

# Start PostgreSQL + TimescaleDB
docker compose up -d

# Create .env file for server
cp packages/server/.env.example packages/server/.env
# Edit packages/server/.env and set your API_KEY

# Run database migrations
bun run db:push

# Set up TimescaleDB hypertable
bun run --cwd packages/server db:setup-timescale

# Start the server (in one terminal)
bun run --cwd packages/server dev

# Create .env file for client
cp packages/tui-client/.env.example packages/tui-client/.env
# Edit packages/tui-client/.env with matching API_KEY

# Start the TUI client (in another terminal)
bun run --cwd packages/tui-client dev
```

## TUI Controls

- `j/k` or `↑/↓` - Navigate targets
- `a` - Add new target
- `e` - Edit selected target
- `d` - Delete selected target
- `r` - Force refresh
- `q` - Quit

## Features

- HTTP/HTTPS endpoint monitoring
- TCP port monitoring (coming soon)
- ICMP ping monitoring (coming soon)
- Configurable check intervals
- Failure threshold before marking down
- Real-time status updates via WebSocket
- 24h/7d/30d uptime statistics
- Webhook notifications on status changes
- TimescaleDB for efficient time-series storage

## Environment Variables

### Server

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/downtime
API_KEY=your-secret-api-key
PORT=3000
WS_PORT=3001
```

### Client

```
SERVER_URL=http://localhost:3000
WS_URL=ws://localhost:3001
API_KEY=your-secret-api-key
```

## Development

```bash
# Type check all packages
bun run typecheck

# Lint and format
bun run lint
bun run format

# Run both server and client in dev mode
bun run dev
```

## Database

The server uses PostgreSQL with TimescaleDB extension for efficient time-series storage.

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (development)
bun run db:push

# Open Drizzle Studio
bun run --cwd packages/server db:studio
```
