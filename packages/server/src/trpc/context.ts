import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone'
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws'
import { env } from '../env'

type ContextOptions = CreateHTTPContextOptions | CreateWSSContextFnOptions

function hasConnectionParams(opts: ContextOptions): opts is CreateWSSContextFnOptions {
	return 'info' in opts && 'connectionParams' in (opts as CreateWSSContextFnOptions).info
}

export async function createContext(opts: ContextOptions) {
	let apiKey: string | null = null

	// Try WebSocket connectionParams first
	if (hasConnectionParams(opts)) {
		const params = opts.info.connectionParams as Record<string, unknown> | undefined
		if (params?.apiKey) {
			apiKey = params.apiKey as string
		}
	}

	// Try HTTP headers
	if (!apiKey && 'req' in opts && opts.req) {
		const authHeader = opts.req.headers.authorization ?? opts.req.headers['x-api-key']
		if (typeof authHeader === 'string') {
			apiKey = authHeader.replace('Bearer ', '')
		}
	}

	// Fall back to URL query parameter
	if (!apiKey && 'req' in opts && opts.req?.url) {
		try {
			const url = new URL(opts.req.url, 'http://localhost')
			apiKey = url.searchParams.get('apiKey')
		} catch {
			// Invalid URL, ignore
		}
	}

	return {
		apiKey,
		isAuthenticated: apiKey === env.API_KEY,
	}
}

export type Context = Awaited<ReturnType<typeof createContext>>
