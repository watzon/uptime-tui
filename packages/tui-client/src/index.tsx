import { render } from 'ink'
import { App } from './App'
import { SetupWizard } from './components/SetupWizard'
import { loadConfig } from './lib/config'
import { useAppStore } from './stores/app'

// Load config synchronously before React renders
const initialConfig = loadConfig()

function Root() {
	// Initialize store with config on first render
	if (initialConfig && useAppStore.getState().config === null) {
		useAppStore.getState().setConfig(initialConfig)
	}

	if (!initialConfig) {
		return <SetupWizard />
	}

	return <App />
}

render(<Root />)
