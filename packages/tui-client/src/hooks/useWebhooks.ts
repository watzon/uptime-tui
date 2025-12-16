import type {
	WebhookConfig,
	WebhookDeliveryWithDetails,
} from '@uptime-tui/shared'
import { useEffect, useState } from 'react'
import { log } from '../lib/logger'
import { trpc } from '../lib/trpc'
import { useAppStore } from '../stores/app'

function parseWebhook(raw: Record<string, unknown>): WebhookConfig {
	return {
		...raw,
		createdAt: new Date(raw.createdAt as string),
		updatedAt: new Date(raw.updatedAt as string),
	} as WebhookConfig
}

function parseDelivery(
	raw: Record<string, unknown>,
): WebhookDeliveryWithDetails {
	const delivery = raw as Record<string, unknown>
	const event = delivery.event as Record<string, unknown>
	return {
		...delivery,
		createdAt: new Date(delivery.createdAt as string),
		lastAttemptAt: delivery.lastAttemptAt
			? new Date(delivery.lastAttemptAt as string)
			: null,
		nextRetryAt: delivery.nextRetryAt
			? new Date(delivery.nextRetryAt as string)
			: null,
		event: {
			...event,
			createdAt: new Date(event.createdAt as string),
		},
	} as WebhookDeliveryWithDetails
}

export function useLoadWebhooks() {
	const { setWebhooks } = useAppStore()

	useEffect(() => {
		async function load() {
			try {
				const webhooks = await trpc.webhooks.list.query()
				setWebhooks(
					webhooks.map((w) =>
						parseWebhook(w as unknown as Record<string, unknown>),
					),
				)
			} catch (error) {
				log('Failed to load webhooks:', error)
			}
		}

		load()
	}, [setWebhooks])
}

export function useWebhookDeliveries(webhookId: string | null) {
	const [deliveries, setDeliveries] = useState<WebhookDeliveryWithDetails[]>([])
	const [loading, setLoading] = useState(false)
	const [hasMore, setHasMore] = useState(false)
	const [cursor, setCursor] = useState<string | undefined>(undefined)

	useEffect(() => {
		if (!webhookId) {
			setDeliveries([])
			setLoading(false)
			setHasMore(false)
			setCursor(undefined)
			return
		}

		setLoading(true)
		setCursor(undefined)

		async function load() {
			try {
				const result = await trpc.webhooks.deliveries.query({
					webhookId: webhookId!,
					limit: 50,
				})

				setDeliveries(
					result.deliveries.map((d) =>
						parseDelivery(d as unknown as Record<string, unknown>),
					),
				)
				setHasMore(!!result.nextCursor)
				setCursor(result.nextCursor)
			} catch (error) {
				log('Failed to load deliveries:', error)
			} finally {
				setLoading(false)
			}
		}

		load()
	}, [webhookId])

	const loadMore = async () => {
		if (!webhookId || !cursor || loading) return

		setLoading(true)
		try {
			const result = await trpc.webhooks.deliveries.query({
				webhookId,
				limit: 50,
				cursor,
			})

			setDeliveries((prev) => [
				...prev,
				...result.deliveries.map((d) =>
					parseDelivery(d as unknown as Record<string, unknown>),
				),
			])
			setHasMore(!!result.nextCursor)
			setCursor(result.nextCursor)
		} catch (error) {
			log('Failed to load more deliveries:', error)
		} finally {
			setLoading(false)
		}
	}

	return { deliveries, loading, hasMore, loadMore }
}

export function useRecentDeliveries(webhookId: string | null) {
	const [statuses, setStatuses] = useState<string[]>([])

	useEffect(() => {
		if (!webhookId) {
			setStatuses([])
			return
		}

		async function load() {
			try {
				const result = await trpc.webhooks.recentDeliveries.query({
					webhookId: webhookId!,
					limit: 5,
				})
				setStatuses(result)
			} catch (error) {
				log('Failed to load recent deliveries:', error)
			}
		}

		load()
	}, [webhookId])

	return statuses
}
