import 'server-only'

import { asc, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { notifyRequests } from '@/lib/db/schema'

// Asking twice is not an error, and a second row would mean a second email.
export async function addNotifyRequest(email: string): Promise<void> {
  await db
    .insert(notifyRequests)
    .values({ email })
    .onConflictDoNothing({ target: notifyRequests.email })
}

export async function listWaiting() {
  return db
    .select({ id: notifyRequests.id, email: notifyRequests.email })
    .from(notifyRequests)
    .where(isNull(notifyRequests.notifiedAt))
    .orderBy(asc(notifyRequests.createdAt))
}

export async function countWaiting(): Promise<number> {
  const [row] = await db
    .select({ waiting: sql<number>`count(*) filter (where ${notifyRequests.notifiedAt} is null)::int` })
    .from(notifyRequests)
  return row?.waiting ?? 0
}

export async function markNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db
    .update(notifyRequests)
    .set({ notifiedAt: new Date() })
    .where(inArray(notifyRequests.id, ids))
}
