import { loadConfig } from './config'

// Load config from file or environment variables
// This is used by the tRPC client at module load time
const config = loadConfig()

// Export values for tRPC client
// If no config, use defaults - the setup wizard will handle getting the API key
export const env = {
	SERVER_URL: config?.serverUrl ?? 'http://localhost:3000',
	WS_URL: config?.wsUrl ?? 'ws://localhost:3001',
	API_KEY: config?.apiKey ?? '',
}
