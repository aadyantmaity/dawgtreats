import 'server-only'

import { asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { notifyRequests } from '@/lib/db/schema'

// Asking twice is not an error, and a second row would mean a second email. Someone who
// was already told and asks again is waiting for the next batch, so the mark is cleared.
export async function addNotifyRequest(email: string): Promise<void> {
  await db
    .insert(notifyRequests)
    .values({ email })
    .onConflictDoUpdate({ target: notifyRequests.email, set: { notifiedAt: null } })
}

export async function isWaiting(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: notifyRequests.id })
    .from(notifyRequests)
    .where(sql`${notifyRequests.email} = ${email} and ${notifyRequests.notifiedAt} is null`)
    .limit(1)
  return row !== undefined
}

export async function removeNotifyRequest(email: string): Promise<void> {
  await db.delete(notifyRequests).where(eq(notifyRequests.email, email))
}

// The link in an email carries the token, never the address: a guessed address must not
// take anyone off the list. Returns the address so the page can say whose it was.
export async function removeByToken(token: string): Promise<string | null> {
  const [gone] = await db
    .delete(notifyRequests)
    .where(eq(notifyRequests.token, token))
    .returning({ email: notifyRequests.email })
  return gone?.email ?? null
}

export async function listWaiting() {
  return db
    .select({ id: notifyRequests.id, email: notifyRequests.email, token: notifyRequests.token })
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
