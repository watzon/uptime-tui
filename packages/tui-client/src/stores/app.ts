import type {
	Event,
	Metric,
	TargetWithStatus,
	UptimeSummary,
	WebhookConfig,
} from '@uptime-tui/shared'
import { create } from 'zustand'
import type { Config } from '../lib/config'
import { log } from '../lib/logger'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
type View =
	| 'dashboard'
	| 'add-target'
	| 'edit-target'
	| 'add-webhook'
	| 'edit-webhook'
	| 'webhook-detail'
	| 'test-webhook'
	| 'help'
	| 'settings'
type ActiveTab = 'targets' | 'webhooks'

interface AppState {
	connectionStatus: ConnectionStatus
	targets: TargetWithStatus[]
	selectedTargetId: string | null
	events: Event[]
	view: View
	error: string | null

	selectedTargetSummary: UptimeSummary | null
	selectedTargetMetrics: Metric[]
	metricsLoading: boolean

	// Webhook state
	activeTab: ActiveTab
	webhooks: WebhookConfig[]
	selectedWebhookId: string | null

	// Config state
	config: Config | null

	setConnectionStatus: (status: ConnectionStatus) => void
	setTargets: (targets: TargetWithStatus[]) => void
	updateTarget: (target: TargetWithStatus) => void
	removeTarget: (id: string) => void
	setSelectedTargetId: (id: string | null) => void
	addEvent: (event: Event) => void
	setEvents: (events: Event[]) => void
	setView: (view: View) => void
	setError: (error: string | null) => void
	setSelectedTargetSummary: (summary: UptimeSummary | null) => void
	setSelectedTargetMetrics: (metrics: Metric[]) => void
	setMetricsLoading: (loading: boolean) => void
	addMetric: (metric: Metric) => void

	selectNextTarget: () => void
	selectPrevTarget: () => void

	// Webhook actions
	setActiveTab: (tab: ActiveTab) => void
	setWebhooks: (webhooks: WebhookConfig[]) => void
	updateWebhook: (webhook: WebhookConfig) => void
	removeWebhook: (id: string) => void
	setSelectedWebhookId: (id: string | null) => void
	selectNextWebhook: () => void
	selectPrevWebhook: () => void

	// Config actions
	setConfig: (config: Config | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
	connectionStatus: 'connecting',
	targets: [],
	selectedTargetId: null,
	events: [],
	view: 'dashboard',
	error: null,
	selectedTargetSummary: null,
	selectedTargetMetrics: [],
	metricsLoading: false,

	// Webhook initial state
	activeTab: 'targets',
	webhooks: [],
	selectedWebhookId: null,

	// Config initial state
	config: null,

	setConnectionStatus: (status) => set({ connectionStatus: status }),

	setTargets: (targets) => {
		const state = get()
		set({ targets })
		if (!state.selectedTargetId && targets.length > 0) {
			set({ selectedTargetId: targets[0]?.id ?? null })
		}
	},

	updateTarget: (target) => {
		log(
			'Store updateTarget called:',
			target.name,
			target.currentStatus,
			target.lastResponseTimeMs,
		)
		set((state) => {
			const newTargets = state.targets.map((t) =>
				t.id === target.id ? target : t,
			)
			log('Store updating targets array, length:', newTargets.length)
			return { targets: newTargets }
		})
	},

	removeTarget: (id) =>
		set((state) => {
			const newTargets = state.targets.filter((t) => t.id !== id)
			const newSelectedId =
				state.selectedTargetId === id
					? (newTargets[0]?.id ?? null)
					: state.selectedTargetId
			return { targets: newTargets, selectedTargetId: newSelectedId }
		}),

	setSelectedTargetId: (id) =>
		set({
			selectedTargetId: id,
			selectedTargetSummary: null,
			selectedTargetMetrics: [],
			metricsLoading: true,
		}),

	addEvent: (event) =>
		set((state) => ({
			events: [event, ...state.events].slice(0, 100),
		})),

	setEvents: (events) => set({ events }),

	setView: (view) => set({ view }),

	setError: (error) => set({ error }),

	setSelectedTargetSummary: (summary) =>
		set({ selectedTargetSummary: summary }),

	setSelectedTargetMetrics: (metrics) =>
		set({ selectedTargetMetrics: metrics, metricsLoading: false }),

	setMetricsLoading: (loading) => set({ metricsLoading: loading }),

	addMetric: (metric) =>
		set((state) => {
			// Only add if it's for the selected target
			if (metric.targetId !== state.selectedTargetId) return state
			// Keep last 100 metrics, sorted by time
			const newMetrics = [...state.selectedTargetMetrics, metric]
				.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
				.slice(-100)
			return { selectedTargetMetrics: newMetrics }
		}),

	selectNextTarget: () => {
		const state = get()
		const currentIndex = state.targets.findIndex(
			(t) => t.id === state.selectedTargetId,
		)
		const nextIndex = (currentIndex + 1) % state.targets.length
		const nextTarget = state.targets[nextIndex]
		if (nextTarget) {
			set({
				selectedTargetId: nextTarget.id,
				selectedTargetSummary: null,
				selectedTargetMetrics: [],
				metricsLoading: true,
			})
		}
	},

	selectPrevTarget: () => {
		const state = get()
		const currentIndex = state.targets.findIndex(
			(t) => t.id === state.selectedTargetId,
		)
		const prevIndex =
			currentIndex <= 0 ? state.targets.length - 1 : currentIndex - 1
		const prevTarget = state.targets[prevIndex]
		if (prevTarget) {
			set({
				selectedTargetId: prevTarget.id,
				selectedTargetSummary: null,
				selectedTargetMetrics: [],
				metricsLoading: true,
			})
		}
	},

	// Webhook actions
	setActiveTab: (tab) => set({ activeTab: tab }),

	setWebhooks: (webhooks) => {
		const state = get()
		set({ webhooks })
		if (!state.selectedWebhookId && webhooks.length > 0) {
			set({ selectedWebhookId: webhooks[0]?.id ?? null })
		}
	},

	updateWebhook: (webhook) =>
		set((state) => ({
			webhooks: state.webhooks.map((w) => (w.id === webhook.id ? webhook : w)),
		})),

	removeWebhook: (id) =>
		set((state) => {
			const newWebhooks = state.webhooks.filter((w) => w.id !== id)
			const newSelectedId =
				state.selectedWebhookId === id
					? (newWebhooks[0]?.id ?? null)
					: state.selectedWebhookId
			return { webhooks: newWebhooks, selectedWebhookId: newSelectedId }
		}),

	setSelectedWebhookId: (id) => set({ selectedWebhookId: id }),

	selectNextWebhook: () => {
		const state = get()
		const currentIndex = state.webhooks.findIndex(
			(w) => w.id === state.selectedWebhookId,
		)
		const nextIndex = (currentIndex + 1) % state.webhooks.length
		const nextWebhook = state.webhooks[nextIndex]
		if (nextWebhook) {
			set({ selectedWebhookId: nextWebhook.id })
		}
	},

	selectPrevWebhook: () => {
		const state = get()
		const currentIndex = state.webhooks.findIndex(
			(w) => w.id === state.selectedWebhookId,
		)
		const prevIndex =
			currentIndex <= 0 ? state.webhooks.length - 1 : currentIndex - 1
		const prevWebhook = state.webhooks[prevIndex]
		if (prevWebhook) {
			set({ selectedWebhookId: prevWebhook.id })
		}
	},

	// Config actions
	setConfig: (config) => set({ config }),
}))
