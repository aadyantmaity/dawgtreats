import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { batchItems, flavors, pickupSlots, weeks } from '@/lib/db/schema'

export async function resetDatabase() {
  await db.execute(
    sql`truncate feedback, stripe_events, payments, order_items, orders, pickup_slots, batch_items, weeks, flavors, users restart identity cascade`,
  )
}

type WeekSpec = {
  /** name -> cookies left this week */
  stock: Record<string, number>
  slots?: number
  capacity?: number
  status?: 'draft' | 'open'
}

export type TestWeek = {
  weekId: string
  slotIds: string[]
  flavorIds: Record<string, string>
}

// Each seeded week gets its own weekend: a weekend can only hold one week.
let weekendsUsed = 0

// A week that is open and orderable right now, with the stock and slots a test asks for.
export async function seedWeek({
  stock,
  slots = 1,
  capacity = 5,
  status = 'open',
}: WeekSpec): Promise<TestWeek> {
  const weekend = new Date(Date.UTC(2099, 0, 3) + weekendsUsed++ * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const [week] = await db
    .insert(weeks)
    .values({
      pickupWeekendStart: weekend,
      ordersCloseAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      status,
    })
    .returning({ id: weeks.id })

  const flavorIds: Record<string, string> = {}
  for (const [name, remaining] of Object.entries(stock)) {
    const [flavor] = await db
      .insert(flavors)
      .values({ name, description: null, priceCents: 300 })
      .returning({ id: flavors.id })
    flavorIds[name] = flavor.id
    await db.insert(batchItems).values({
      weekId: week.id,
      flavorId: flavor.id,
      quantityTotal: remaining,
      quantityRemaining: remaining,
    })
  }

  const slotIds: string[] = []
  for (let i = 0; i < slots; i++) {
    const startsAt = new Date(`${weekend}T20:00:00Z`)
    startsAt.setUTCMinutes(startsAt.getUTCMinutes() + i * 30)
    const [slot] = await db
      .insert(pickupSlots)
      .values({
        weekId: week.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        capacity,
      })
      .returning({ id: pickupSlots.id })
    slotIds.push(slot.id)
  }

  return { weekId: week.id, slotIds, flavorIds }
}

export const buyer = { name: 'Test Buyer', email: 'buyer@example.com', phone: '2065550123' }
