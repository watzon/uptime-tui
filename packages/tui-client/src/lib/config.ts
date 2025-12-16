import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

const CONFIG_DIR = join(homedir(), '.config', 'uptime')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

const configSchema = z.object({
	serverUrl: z.string().url().default('http://localhost:3000'),
	wsUrl: z.string().url().default('ws://localhost:3001'),
	apiKey: z.string().min(1),
})

export type Config = z.infer<typeof configSchema>

/**
 * Check if a config file exists
 */
export function configExists(): boolean {
	return existsSync(CONFIG_PATH)
}

/**
 * Filter out undefined values from an object
 */
function filterUndefined<T extends Record<string, unknown>>(
	obj: T,
): Partial<T> {
	return Object.fromEntries(
		Object.entries(obj).filter(([, v]) => v !== undefined),
	) as Partial<T>
}

/**
 * Load config from file and/or environment variables.
 * Environment variables take precedence over file values.
 * Returns null if no valid config can be constructed.
 */
export function loadConfig(): Config | null {
	// Check for env var overrides
	const envConfig = {
		serverUrl: process.env.SERVER_URL,
		wsUrl: process.env.WS_URL,
		apiKey: process.env.API_KEY,
	}

	// If all env vars are present, use them exclusively
	if (envConfig.serverUrl && envConfig.wsUrl && envConfig.apiKey) {
		const result = configSchema.safeParse(envConfig)
		if (result.success) {
			return result.data
		}
	}

	// Try loading from file
	if (!configExists()) {
		return null
	}

	try {
		const fileContent = readFileSync(CONFIG_PATH, 'utf-8')
		const fileConfig = JSON.parse(fileContent)

		// Merge: env vars override file values
		const merged = { ...fileConfig, ...filterUndefined(envConfig) }
		const result = configSchema.safeParse(merged)

		if (result.success) {
			return result.data
		}

		return null
	} catch {
		return null
	}
}

/**
 * Save config to file, creating the directory if needed
 */
export function saveConfig(config: Config): void {
	mkdirSync(CONFIG_DIR, { recursive: true })
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, '\t'))
}

/**
 * Get the config file path (useful for error messages)
 */
export function getConfigPath(): string {
	return CONFIG_PATH
}
