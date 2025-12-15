import { useInput } from 'ink'
import { useAppStore } from '../stores/app'
import { trpc } from '../lib/trpc'

export function useKeyboard() {
	const { view, setView, selectNextTarget, selectPrevTarget, selectedTargetId, removeTarget, setTargets } =
		useAppStore()

	useInput(async (input, key) => {
		if (view !== 'dashboard') return

		if (key.downArrow || input === 'j') {
			selectNextTarget()
		} else if (key.upArrow || input === 'k') {
			selectPrevTarget()
		} else if (input === 'a') {
			setView('add-target')
		} else if (input === 'e' && selectedTargetId) {
			setView('edit-target')
		} else if (input === 'd' && selectedTargetId) {
			try {
				await trpc.targets.delete.mutate({ id: selectedTargetId })
				removeTarget(selectedTargetId)
			} catch (err) {
				console.error('Failed to delete target:', err)
			}
		} else if (input === 'r') {
			try {
				const targets = await trpc.targets.list.query()
				setTargets(
					targets.map((t) => ({
						...t,
						createdAt: new Date(t.createdAt as unknown as string),
						updatedAt: new Date(t.updatedAt as unknown as string),
						lastCheckedAt: t.lastCheckedAt ? new Date(t.lastCheckedAt as unknown as string) : null,
					})),
				)
			} catch (err) {
				console.error('Failed to refresh targets:', err)
			}
		} else if (input === '?') {
			setView('help')
		} else if (input === 'q') {
			process.exit(0)
		}
	})
}
