import { z } from 'zod'

const envSchema = z.object({
	SERVER_URL: z.string().url().default('http://localhost:3000'),
	WS_URL: z.string().url().default('ws://localhost:3001'),
	API_KEY: z.string().min(1),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
	console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
	process.exit(1)
}

export const env = parsed.data
