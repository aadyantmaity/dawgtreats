import 'server-only'

import { desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'

export type NewFeedback = { rating: number | null; message: string; name: string | null }

export async function leaveFeedback(input: NewFeedback): Promise<void> {
  await db.insert(feedback).values(input)
}

export async function listFeedback() {
  return db.select().from(feedback).orderBy(desc(feedback.createdAt))
}
