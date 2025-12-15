import { z } from 'zod'

const envSchema = z.object({
	DATABASE_URL: z.string().url(),
	API_KEY: z.string().min(1),
	PORT: z.coerce.number().default(3000),
	WS_PORT: z.coerce.number().default(3001),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
	console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
	process.exit(1)
}

export const env = parsed.data
