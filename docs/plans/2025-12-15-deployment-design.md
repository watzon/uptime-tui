# Deployment Design

## Overview

Set up GitHub Actions for CI/CD to publish all packages to npm, Docker image to GHCR, and standalone executables to GitHub Releases.

## Package Structure

**npm org:** `@uptime-tui`

| Package | npm Name | Description | Binary |
|---------|----------|-------------|--------|
| shared | `@uptime-tui/shared` | Zod schemas, types | - |
| server | `@uptime-tui/server` | Monitoring server | `uptime-server` |
| tui-client | `@uptime-tui/cli` | TUI client | `downtime` |

## CI Workflow

**File:** `.github/workflows/ci.yml`

**Triggers:** Push to `main`, Pull requests to `main`

**Jobs:**
1. **lint-and-typecheck** - Run `bun run lint` and `bun run typecheck`
2. **build** - Run `bun run build` (depends on lint-and-typecheck)

## Release Workflow

**File:** `.github/workflows/release.yml`

**Triggers:** Push tags matching `v*` (e.g., `v1.0.0`)

**Jobs:**

1. **publish-npm**
   - Build all packages
   - Publish in dependency order: shared → server → cli
   - Version extracted from git tag

2. **publish-docker**
   - Build Docker image for server
   - Push to `ghcr.io/watzon/uptime-server:latest` and `ghcr.io/watzon/uptime-server:vX.X.X`

3. **build-executables** (matrix)
   - Platforms: linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64
   - Builds both `uptime-server` and `downtime` (CLI) per platform
   - 10 total artifacts

4. **create-release**
   - Create GitHub Release from tag
   - Attach all executables
   - Auto-generate changelog

## Dockerfile

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build --filter=@uptime-tui/server

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000 3001
CMD ["bun", "run", "dist/index.js"]
```

## Package.json Changes

**packages/shared/package.json:**
- `name`: `@uptime-tui/shared`
- `private`: `false`
- Add `files: ["dist"]`

**packages/server/package.json:**
- `name`: `@uptime-tui/server`
- `private`: `false`
- Add `bin: { "uptime-server": "./dist/index.js" }`
- Add `files: ["dist"]`
- Change `@downtime/shared` to `@uptime-tui/shared`

**packages/tui-client/package.json:**
- `name`: `@uptime-tui/cli`
- `private`: `false`
- Add `bin: { "downtime": "./dist/index.js" }`
- Add `files: ["dist"]`
- Change workspace deps to `@uptime-tui/*`

## GitHub Secrets Required

- `NPM_TOKEN` - npm automation token for publishing

## Usage After Deployment

```bash
# Run server via npm
npx @uptime-tui/server

# Run CLI via npm
npx @uptime-tui/cli

# Run server via Docker
docker run -p 3000:3000 -p 3001:3001 ghcr.io/watzon/uptime-server

# Download standalone executables from GitHub Releases
```
