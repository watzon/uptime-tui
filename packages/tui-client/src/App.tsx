import { useLoadData } from './hooks/useData'
import { useSubscriptions } from './hooks/useSubscriptions'
import { useKeyboard } from './hooks/useKeyboard'
import { Layout } from './components/Layout'
import { AddTargetForm } from './components/AddTargetForm'
import { EditTargetForm } from './components/EditTargetForm'
import { HelpModal } from './components/HelpModal'
import { useAppStore } from './stores/app'

export function App() {
	const { view } = useAppStore()

	useLoadData()
	useSubscriptions()
	useKeyboard()

	if (view === 'add-target') {
		return <AddTargetForm />
	}

	if (view === 'edit-target') {
		return <EditTargetForm />
	}

	if (view === 'help') {
		return <HelpModal />
	}

	return <Layout />
}
