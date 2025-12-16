FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the server
RUN pnpm --filter @uptime-tui/server run build

# Production image
FROM node:20-slim

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose HTTP and WebSocket ports
EXPOSE 3000 3001

# Run the server
CMD ["node", "dist/index.js"]
