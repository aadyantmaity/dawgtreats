import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

config({ path: '.env.local', quiet: true })

async function main() {
  const url = process.env.DIRECT_URL

  if (!url) {
    throw new Error('DIRECT_URL is not set')
  }

  // Migrations run over the direct connection, not the pooler.
  const client = postgres(url, { max: 1 })

  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  await client.end()

  console.log('migrations applied')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
