import { cleanupOldDeliveries, processRetries } from './dispatcher'

let retryInterval: ReturnType<typeof setInterval> | null = null
let cleanupInterval: ReturnType<typeof setInterval> | null = null

const RETRY_POLL_MS = 5_000 // Check for pending retries every 5 seconds
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // Cleanup old deliveries every hour

/**
 * Starts the retry scheduler that:
 * 1. Polls for pending webhook deliveries every 5 seconds
 * 2. Cleans up old delivery records every hour
 */
export function startRetryScheduler(): void {
	if (retryInterval || cleanupInterval) {
		console.warn('Retry scheduler already running')
		return
	}

	console.log('Starting webhook retry scheduler')

	// Process retries every 5 seconds
	retryInterval = setInterval(() => {
		processRetries().catch((error) => {
			console.error('Error processing webhook retries:', error)
		})
	}, RETRY_POLL_MS)

	// Cleanup old deliveries every hour
	cleanupInterval = setInterval(() => {
		cleanupOldDeliveries().catch((error) => {
			console.error('Error cleaning up old deliveries:', error)
		})
	}, CLEANUP_INTERVAL_MS)

	// Run initial cleanup on startup
	cleanupOldDeliveries().catch((error) => {
		console.error('Error during initial delivery cleanup:', error)
	})
}

/**
 * Stops the retry scheduler
 */
export function stopRetryScheduler(): void {
	if (retryInterval) {
		clearInterval(retryInterval)
		retryInterval = null
	}

	if (cleanupInterval) {
		clearInterval(cleanupInterval)
		cleanupInterval = null
	}

	console.log('Webhook retry scheduler stopped')
}
