import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
	throw new Error('DATABASE_URL environment variable is required')
}

const sql = postgres(connectionString)

async function setupTimescale() {
	console.log('Setting up TimescaleDB...')

	try {
		await sql`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`
		console.log('TimescaleDB extension enabled')

		const result = await sql`
			SELECT * FROM timescaledb_information.hypertables
			WHERE hypertable_name = 'metrics'
		`

		if (result.length === 0) {
			await sql`
				SELECT create_hypertable('metrics', by_range('time'), if_not_exists => TRUE)
			`
			console.log('Created hypertable for metrics')

			await sql`
				SELECT add_retention_policy('metrics', INTERVAL '90 days', if_not_exists => TRUE)
			`
			console.log('Added 90-day retention policy for metrics')
		} else {
			console.log('Metrics hypertable already exists')
		}

		console.log('TimescaleDB setup complete!')
	} catch (error) {
		console.error('TimescaleDB setup failed:', error)
		throw error
	} finally {
		await sql.end()
	}
}

setupTimescale().catch((err) => {
	console.error('Setup failed:', err)
	process.exit(1)
})
