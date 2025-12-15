import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
	transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware

const isAuthenticated = middleware(async ({ ctx, next }) => {
	if (!ctx.isAuthenticated) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'Invalid or missing API key',
		})
	}
	return next({ ctx })
})

export const protectedProcedure = t.procedure.use(isAuthenticated)
