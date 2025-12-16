import { useInput } from 'ink'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'

export function useKeyboard() {
	const {
		view,
		setView,
		selectNextTarget,
		selectPrevTarget,
		selectedTargetId,
		removeTarget,
		setTargets,
		activeTab,
		setActiveTab,
		selectNextWebhook,
		selectPrevWebhook,
		selectedWebhookId,
		removeWebhook,
		setWebhooks,
	} = useAppStore()

	useInput(async (input, key) => {
		if (view !== 'dashboard') return

		// Tab switching with 1/2 keys or Tab key
		if (input === '1') {
			setActiveTab('targets')
			return
		} else if (input === '2') {
			setActiveTab('webhooks')
			return
		} else if (key.tab) {
			setActiveTab(activeTab === 'targets' ? 'webhooks' : 'targets')
			return
		}

		// Handle targets tab
		if (activeTab === 'targets') {
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
							lastCheckedAt: t.lastCheckedAt
								? new Date(t.lastCheckedAt as unknown as string)
								: null,
						})),
					)
				} catch (err) {
					console.error('Failed to refresh targets:', err)
				}
			}
		}

		// Handle webhooks tab
		if (activeTab === 'webhooks') {
			if (key.downArrow || input === 'j') {
				selectNextWebhook()
			} else if (key.upArrow || input === 'k') {
				selectPrevWebhook()
			} else if (input === 'a') {
				setView('add-webhook')
			} else if (input === 'e' && selectedWebhookId) {
				setView('edit-webhook')
			} else if (input === 't' && selectedWebhookId) {
				setView('test-webhook')
			} else if (key.return && selectedWebhookId) {
				setView('webhook-detail')
			} else if (input === 'd' && selectedWebhookId) {
				try {
					await trpc.webhooks.delete.mutate({ id: selectedWebhookId })
					removeWebhook(selectedWebhookId)
				} catch (err) {
					console.error('Failed to delete webhook:', err)
				}
			} else if (input === 'r') {
				try {
					const webhooks = await trpc.webhooks.list.query()
					setWebhooks(
						webhooks.map((w) => ({
							...w,
							createdAt: new Date(w.createdAt as unknown as string),
							updatedAt: new Date(w.updatedAt as unknown as string),
						})),
					)
				} catch (err) {
					console.error('Failed to refresh webhooks:', err)
				}
			}
		}

		// Global keys
		if (input === '?') {
			setView('help')
		} else if (input === ',') {
			setView('settings')
		} else if (input === 'q') {
			process.exit(0)
		}
	})
}
