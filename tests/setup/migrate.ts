import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgres://postgres:dawgtreats@localhost:5433/dawgtreats_test'
  const client = postgres(url, { max: 1 })
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  await client.end()
}
