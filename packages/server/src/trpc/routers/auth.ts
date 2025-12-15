import { publicProcedure, router } from '../trpc'

export const authRouter = router({
	verify: publicProcedure.query(({ ctx }) => {
		return {
			authenticated: ctx.isAuthenticated,
		}
	}),
})
