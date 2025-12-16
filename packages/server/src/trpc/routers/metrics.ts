import {
	type Metric,
	type UptimeSummary,
	metricsQueryInputSchema,
	uptimeSummaryInputSchema,
} from '@uptime-tui/shared'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db, metrics } from '../../db'
import { protectedProcedure, router } from '../trpc'

export const metricsRouter = router({
	query: protectedProcedure
		.input(metricsQueryInputSchema)
		.query(async ({ input }): Promise<Metric[]> => {
			const { targetId, startTime, endTime, aggregation, limit } = input

			if (aggregation === 'raw') {
				const result = await db
					.select()
					.from(metrics)
					.where(
						and(
							eq(metrics.targetId, targetId),
							gte(metrics.time, startTime),
							lte(metrics.time, endTime),
						),
					)
					.orderBy(metrics.time)
					.limit(limit)

				return result as Metric[]
			}

			const bucketSeconds =
				aggregation === '1m'
					? 60
					: aggregation === '5m'
						? 300
						: aggregation === '1h'
							? 3600
							: 86400

			const result = await db.execute(sql`
			SELECT
				time_bucket(${bucketSeconds} * interval '1 second', time) as time,
				${targetId} as target_id,
				mode() WITHIN GROUP (ORDER BY status) as status,
				avg(response_time_ms)::integer as response_time_ms,
				mode() WITHIN GROUP (ORDER BY status_code) as status_code,
				NULL as error
			FROM metrics
			WHERE target_id = ${targetId}
				AND time >= ${startTime}
				AND time <= ${endTime}
			GROUP BY 1
			ORDER BY 1
			LIMIT ${limit}
		`)

			return result as unknown as Metric[]
		}),

	summary: protectedProcedure
		.input(uptimeSummaryInputSchema)
		.query(async ({ input }): Promise<UptimeSummary> => {
			const { targetId, period } = input

			const intervalMap = {
				'1h': '1 hour',
				'24h': '24 hours',
				'7d': '7 days',
				'30d': '30 days',
			}

			const interval = intervalMap[period]

			const result = await db.execute(sql`
			SELECT
				count(*) as total_checks,
				count(*) FILTER (WHERE status = 'up') as successful_checks,
				count(*) FILTER (WHERE status != 'up') as failed_checks,
				avg(response_time_ms) as avg_response_time_ms
			FROM metrics
			WHERE target_id = ${targetId}
				AND time >= NOW() - ${sql.raw(`interval '${interval}'`)}
		`)

			const rows = result as unknown as Array<{
				total_checks: string
				successful_checks: string
				failed_checks: string
				avg_response_time_ms: string | null
			}>
			const row = rows[0] as {
				total_checks: string
				successful_checks: string
				failed_checks: string
				avg_response_time_ms: string | null
			}

			const totalChecks = Number.parseInt(row.total_checks, 10)
			const successfulChecks = Number.parseInt(row.successful_checks, 10)
			const failedChecks = Number.parseInt(row.failed_checks, 10)
			const avgResponseTimeMs = row.avg_response_time_ms
				? Math.round(Number.parseFloat(row.avg_response_time_ms))
				: null

			return {
				targetId,
				period,
				uptimePercent:
					totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0,
				avgResponseTimeMs,
				totalChecks,
				successfulChecks,
				failedChecks,
			}
		}),
})
