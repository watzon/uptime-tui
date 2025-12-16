import { AddTargetForm } from './components/AddTargetForm'
import { AddWebhookForm } from './components/AddWebhookForm'
import { EditTargetForm } from './components/EditTargetForm'
import { EditWebhookForm } from './components/EditWebhookForm'
import { HelpModal } from './components/HelpModal'
import { Layout } from './components/Layout'
import { SettingsView } from './components/SettingsView'
import { TestWebhookModal } from './components/TestWebhookModal'
import { WebhookDetailView } from './components/WebhookDetailView'
import { useLoadData } from './hooks/useData'
import { useKeyboard } from './hooks/useKeyboard'
import { useSubscriptions } from './hooks/useSubscriptions'
import { useLoadWebhooks } from './hooks/useWebhooks'
import { useAppStore } from './stores/app'

export function App() {
	const { view } = useAppStore()

	useLoadData()
	useLoadWebhooks()
	useSubscriptions()
	useKeyboard()

	if (view === 'add-target') {
		return <AddTargetForm />
	}

	if (view === 'edit-target') {
		return <EditTargetForm />
	}

	if (view === 'add-webhook') {
		return <AddWebhookForm />
	}

	if (view === 'edit-webhook') {
		return <EditWebhookForm />
	}

	if (view === 'test-webhook') {
		return <TestWebhookModal />
	}

	if (view === 'webhook-detail') {
		return <WebhookDetailView />
	}

	if (view === 'help') {
		return <HelpModal />
	}

	if (view === 'settings') {
		return <SettingsView />
	}

	return <Layout />
}
