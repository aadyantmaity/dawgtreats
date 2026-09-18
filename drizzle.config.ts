import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local', quiet: true })

const url = process.env.DIRECT_URL

if (!url) {
  throw new Error('DIRECT_URL is not set')
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
