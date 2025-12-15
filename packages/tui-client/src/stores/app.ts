import type { Event, Metric, TargetWithStatus, UptimeSummary } from '@downtime/shared'
import { create } from 'zustand'
import { log } from '../lib/logger'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
type View = 'dashboard' | 'add-target' | 'edit-target' | 'help'

interface AppState {
	connectionStatus: ConnectionStatus
	targets: TargetWithStatus[]
	selectedTargetId: string | null
	events: Event[]
	view: View
	error: string | null

	selectedTargetSummary: UptimeSummary | null
	selectedTargetMetrics: Metric[]

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
	addMetric: (metric: Metric) => void

	selectNextTarget: () => void
	selectPrevTarget: () => void
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

	setConnectionStatus: (status) => set({ connectionStatus: status }),

	setTargets: (targets) => {
		const state = get()
		set({ targets })
		if (!state.selectedTargetId && targets.length > 0) {
			set({ selectedTargetId: targets[0]?.id ?? null })
		}
	},

	updateTarget: (target) => {
		log('Store updateTarget called:', target.name, target.currentStatus, target.lastResponseTimeMs)
		set((state) => {
			const newTargets = state.targets.map((t) => (t.id === target.id ? target : t))
			log('Store updating targets array, length:', newTargets.length)
			return { targets: newTargets }
		})
	},

	removeTarget: (id) =>
		set((state) => {
			const newTargets = state.targets.filter((t) => t.id !== id)
			const newSelectedId = state.selectedTargetId === id ? (newTargets[0]?.id ?? null) : state.selectedTargetId
			return { targets: newTargets, selectedTargetId: newSelectedId }
		}),

	setSelectedTargetId: (id) => set({ selectedTargetId: id, selectedTargetSummary: null, selectedTargetMetrics: [] }),

	addEvent: (event) =>
		set((state) => ({
			events: [event, ...state.events].slice(0, 100),
		})),

	setEvents: (events) => set({ events }),

	setView: (view) => set({ view }),

	setError: (error) => set({ error }),

	setSelectedTargetSummary: (summary) => set({ selectedTargetSummary: summary }),

	setSelectedTargetMetrics: (metrics) => set({ selectedTargetMetrics: metrics }),

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
		const currentIndex = state.targets.findIndex((t) => t.id === state.selectedTargetId)
		const nextIndex = (currentIndex + 1) % state.targets.length
		const nextTarget = state.targets[nextIndex]
		if (nextTarget) {
			set({ selectedTargetId: nextTarget.id, selectedTargetSummary: null, selectedTargetMetrics: [] })
		}
	},

	selectPrevTarget: () => {
		const state = get()
		const currentIndex = state.targets.findIndex((t) => t.id === state.selectedTargetId)
		const prevIndex = currentIndex <= 0 ? state.targets.length - 1 : currentIndex - 1
		const prevTarget = state.targets[prevIndex]
		if (prevTarget) {
			set({ selectedTargetId: prevTarget.id, selectedTargetSummary: null, selectedTargetMetrics: [] })
		}
	},
}))
