import type { AppRouter } from '@uptime-tui/server'
import {
	createTRPCClient,
	createWSClient,
	httpLink,
	splitLink,
	wsLink,
} from '@trpc/client'
import superjson from 'superjson'
import { env } from './env'
import { log } from './logger'

const wsClient = createWSClient({
	url: env.WS_URL,
	connectionParams: () => {
		log('Sending connectionParams with apiKey')
		return {
			apiKey: env.API_KEY,
		}
	},
	onOpen: () => {
		log('WebSocket connected')
	},
	onClose: (cause) => {
		log('WebSocket disconnected', cause)
	},
})

export const trpc = createTRPCClient<AppRouter>({
	links: [
		splitLink({
			condition: (op) => op.type === 'subscription',
			true: wsLink({ client: wsClient, transformer: superjson }),
			false: httpLink({
				url: env.SERVER_URL,
				headers: () => ({
					'x-api-key': env.API_KEY,
				}),
				transformer: superjson,
			}),
		}),
	],
})
