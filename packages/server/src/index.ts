import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'
import { env } from './env'
import { scheduler } from './scheduler'
import { createContext } from './trpc/context'
import { appRouter } from './trpc/router'
import { startWebhookDispatcher } from './webhooks/dispatcher'

const httpServer = createHTTPServer({
	router: appRouter,
	createContext,
	onError: ({ error }) => {
		console.error('tRPC error:', error)
	},
})

const wss = new WebSocketServer({ port: env.WS_PORT })
const wssHandler = applyWSSHandler({
	wss,
	router: appRouter,
	createContext,
	onError: ({ error }) => {
		console.error('WebSocket error:', error)
	},
})

process.on('SIGTERM', () => {
	console.log('SIGTERM received, shutting down...')
	wssHandler.broadcastReconnectNotification()
	wss.close()
	scheduler.stop()
	process.exit(0)
})

process.on('SIGINT', () => {
	console.log('SIGINT received, shutting down...')
	wssHandler.broadcastReconnectNotification()
	wss.close()
	scheduler.stop()
	process.exit(0)
})

async function main() {
	httpServer.listen(env.PORT)
	console.log(`HTTP server listening on port ${env.PORT}`)
	console.log(`WebSocket server listening on port ${env.WS_PORT}`)

	startWebhookDispatcher()
	await scheduler.start()
}

main().catch((error) => {
	console.error('Failed to start server:', error)
	process.exit(1)
})

export type { AppRouter } from './trpc/router'
