import { authRouter } from './routers/auth'
import { eventsRouter } from './routers/events'
import { metricsRouter } from './routers/metrics'
import { targetsRouter } from './routers/targets'
import { webhooksRouter } from './routers/webhooks'
import { subscriptionsRouter } from './subscriptions'
import { router } from './trpc'

export const appRouter = router({
	auth: authRouter,
	targets: targetsRouter,
	metrics: metricsRouter,
	events: eventsRouter,
	webhooks: webhooksRouter,
	subscriptions: subscriptionsRouter,
})

export type AppRouter = typeof appRouter
