import 'server-only'

import { and, countDistinct, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { events, orders } from '@/lib/db/schema'

// Counting began here. Orders taken before it have no visit to be a share of, so the
// funnel ignores them rather than reporting more buyers than visitors.
export const COUNTING_SINCE = new Date('2026-10-05T00:00:00-07:00')

export async function recordEvent(input: {
  name: string
  visitorId: string
  weekId: string | null
  detail?: string | null
}): Promise<void> {
  await db.insert(events).values({
    name: input.name,
    visitorId: input.visitorId,
    weekId: input.weekId,
    detail: input.detail ?? null,
  })
}

export type FunnelStep = { step: string; people: number }

// People, not events: someone who reloads the menu four times is still one person
// who looked. Orders come from the orders table, which is the only truth about money.
export async function funnelForWeek(weekId: string): Promise<{
  steps: FunnelStep[]
  byFlavor: { flavor: string; adds: number }[]
  orders: { status: string; count: number }[]
}> {
  const counted = await db
    .select({ name: events.name, people: countDistinct(events.visitorId) })
    .from(events)
    .where(and(eq(events.weekId, weekId), gte(events.createdAt, COUNTING_SINCE)))
    .groupBy(events.name)

  const peopleAt = (name: string) => counted.find((row) => row.name === name)?.people ?? 0

  const byFlavor = await db
    .select({ flavor: sql<string>`coalesce(${events.detail}, 'unknown')`, adds: countDistinct(events.visitorId) })
    .from(events)
    .where(
      and(
        eq(events.weekId, weekId),
        eq(events.name, 'add_to_cart'),
        gte(events.createdAt, COUNTING_SINCE),
      ),
    )
    .groupBy(events.detail)

  const byStatus = await db
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.weekId, weekId), gte(orders.createdAt, COUNTING_SINCE)))
    .groupBy(orders.status)

  return {
    steps: [
      { step: 'Looked at the menu', people: peopleAt('menu_viewed') },
      { step: 'Added a cookie', people: peopleAt('add_to_cart') },
      { step: 'Opened the cart', people: peopleAt('cart_viewed') },
      { step: 'Reached checkout', people: peopleAt('checkout_reached') },
    ],
    byFlavor: byFlavor.sort((a, b) => b.adds - a.adds),
    orders: byStatus,
  }
}
