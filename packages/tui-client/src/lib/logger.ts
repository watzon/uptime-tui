import { appendFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const DEBUG_ENABLED = process.argv.includes('--debug')
const logFile = join(process.cwd(), 'tui-debug.log')

// Clear log on start if debug is enabled
if (DEBUG_ENABLED) {
	writeFileSync(logFile, `--- TUI Client Started ${new Date().toISOString()} ---\n`)
}

export function log(...args: unknown[]) {
	if (!DEBUG_ENABLED) return

	const timestamp = new Date().toISOString()
	const message = args
		.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
		.join(' ')
	appendFileSync(logFile, `[${timestamp}] ${message}\n`)
}

export function isDebugEnabled() {
	return DEBUG_ENABLED
}
