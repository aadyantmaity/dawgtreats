import 'server-only'

import { and, asc, count, eq, gt, isNotNull, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { batchItems, flavors, orders, pickupSlots, weeks } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'
import { addDays, ptToUtc } from '@/lib/weeks'

const SLOT_MINUTES = 30

export type InventoryRow = {
  flavorId: string
  name: string
  active: boolean
  priceCents: number
  quantityTotal: number
  sold: number
}

export type Slot = typeof pickupSlots.$inferSelect & { orderCount: number }

export async function getWeekInventory(weekId: string): Promise<InventoryRow[]> {
  const rows = await db
    .select({
      flavorId: flavors.id,
      name: flavors.name,
      active: flavors.active,
      priceCents: flavors.priceCents,
      quantityTotal: batchItems.quantityTotal,
      quantityRemaining: batchItems.quantityRemaining,
    })
    .from(flavors)
    .leftJoin(batchItems, and(eq(batchItems.flavorId, flavors.id), eq(batchItems.weekId, weekId)))
    .where(or(eq(flavors.active, true), isNotNull(batchItems.id)))
    .orderBy(asc(flavors.name))

  return rows.map(({ quantityTotal, quantityRemaining, ...row }) => ({
    ...row,
    quantityTotal: quantityTotal ?? 0,
    sold: (quantityTotal ?? 0) - (quantityRemaining ?? 0),
  }))
}

// A pending checkout can still be paid for, so "sold" counts the cookies it holds.
export async function setBatchQuantities(
  weekId: string,
  items: { flavorId: string; quantity: number }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const [week] = await tx.select({ id: weeks.id }).from(weeks).where(eq(weeks.id, weekId))
    if (!week) throw new DomainError('Week not found', 404)

    for (const { flavorId, quantity } of items) {
      const [flavor] = await tx
        .select({ name: flavors.name, active: flavors.active })
        .from(flavors)
        .where(eq(flavors.id, flavorId))
      if (!flavor) throw new DomainError('One of those flavors no longer exists', 400)

      const [existing] = await tx
        .select({ id: batchItems.id })
        .from(batchItems)
        .where(and(eq(batchItems.weekId, weekId), eq(batchItems.flavorId, flavorId)))
      if (!existing && quantity === 0) continue
      if (!existing && !flavor.active) {
        throw new DomainError(`${flavor.name} is inactive. Reactivate it before adding it to a week.`)
      }

      const moved = await tx
        .insert(batchItems)
        .values({ weekId, flavorId, quantityTotal: quantity, quantityRemaining: quantity })
        .onConflictDoUpdate({
          target: [batchItems.weekId, batchItems.flavorId],
          set: {
            quantityTotal: sql`excluded.quantity_total`,
            quantityRemaining: sql`excluded.quantity_total - (${batchItems.quantityTotal} - ${batchItems.quantityRemaining})`,
          },
          setWhere: sql`${batchItems.quantityTotal} - ${batchItems.quantityRemaining} <= excluded.quantity_total`,
        })
        .returning({ id: batchItems.id })

      if (moved.length === 0) {
        const [row] = await tx
          .select({ sold: sql<number>`(${batchItems.quantityTotal} - ${batchItems.quantityRemaining})::int` })
          .from(batchItems)
          .where(and(eq(batchItems.weekId, weekId), eq(batchItems.flavorId, flavorId)))
        throw new DomainError(
          `${flavor.name} can't go below ${row?.sold ?? 0}: that many are already sold or held`,
        )
      }
    }
  })
}

export async function listSlots(weekId: string): Promise<Slot[]> {
  return db
    .select({
      id: pickupSlots.id,
      weekId: pickupSlots.weekId,
      startsAt: pickupSlots.startsAt,
      endsAt: pickupSlots.endsAt,
      capacity: pickupSlots.capacity,
      bookedCount: pickupSlots.bookedCount,
      orderCount: count(orders.id),
    })
    .from(pickupSlots)
    .leftJoin(orders, eq(orders.pickupSlotId, pickupSlots.id))
    .where(eq(pickupSlots.weekId, weekId))
    .groupBy(pickupSlots.id)
    .orderBy(asc(pickupSlots.startsAt))
}

export async function addSlot(weekId: string, day: 'sat' | 'sun', time: string): Promise<void> {
  if (!/^([01]\d|2[0-3]):(00|30)$/.test(time)) {
    throw new DomainError('Slots start on the hour or half hour', 400)
  }

  await db.transaction(async (tx) => {
    const [week] = await tx.select().from(weeks).where(eq(weeks.id, weekId)).for('update')
    if (!week) throw new DomainError('Week not found', 404)
    if (week.status === 'closed') throw new DomainError('This week is closed')

    const date = day === 'sat' ? week.pickupWeekendStart : addDays(week.pickupWeekendStart, 1)
    const startsAt = ptToUtc(date, time)
    if (startsAt.getTime() <= Date.now()) throw new DomainError('That time has already passed', 400)

    const [clash] = await tx
      .select({ id: pickupSlots.id })
      .from(pickupSlots)
      .where(and(eq(pickupSlots.weekId, weekId), eq(pickupSlots.startsAt, startsAt)))
    if (clash) throw new DomainError('That slot already exists')

    const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60000)
    await tx.insert(pickupSlots).values({ weekId, startsAt, endsAt })
  })
}

export async function deleteSlot(slotId: string): Promise<void> {
  const deleted = await db
    .delete(pickupSlots)
    .where(
      and(
        eq(pickupSlots.id, slotId),
        sql`not exists (select 1 from orders o where o.pickup_slot_id = ${slotId})`,
      ),
    )
    .returning({ id: pickupSlots.id })
  if (deleted.length > 0) return

  const [slot] = await db.select({ id: pickupSlots.id }).from(pickupSlots).where(eq(pickupSlots.id, slotId))
  if (!slot) throw new DomainError('Slot not found', 404)

  const [{ orderCount }] = await db
    .select({ orderCount: count() })
    .from(orders)
    .where(eq(orders.pickupSlotId, slotId))
  const noun = orderCount === 1 ? 'order' : 'orders'
  throw new DomainError(`This slot has ${orderCount} ${noun} and can't be removed`)
}

export async function findSlotAt(weekId: string, day: 'sat' | 'sun', time: string): Promise<string> {
  const [week] = await db.select().from(weeks).where(eq(weeks.id, weekId))
  if (!week) throw new DomainError('Week not found', 404)

  const date = day === 'sat' ? week.pickupWeekendStart : addDays(week.pickupWeekendStart, 1)
  const [slot] = await db
    .select({ id: pickupSlots.id })
    .from(pickupSlots)
    .where(and(eq(pickupSlots.weekId, weekId), eq(pickupSlots.startsAt, ptToUtc(date, time))))
  if (!slot) throw new DomainError('There is no slot at that time', 404)
  return slot.id
}

export type MenuItem = {
  id: string
  name: string
  description: string | null
  priceCents: number
  imageUrl: string | null
  toppings: string | null
  remaining: number | null
}

// Without an orderable week there is no stock to speak of, so `remaining` stays null.
export async function getMenu(weekId: string | null): Promise<MenuItem[]> {
  if (!weekId) {
    const rows = await db
      .select({
        id: flavors.id,
        name: flavors.name,
        description: flavors.description,
        priceCents: flavors.priceCents,
        imageUrl: flavors.imageUrl,
      toppings: flavors.toppings,
      })
      .from(flavors)
      .where(eq(flavors.active, true))
      .orderBy(asc(flavors.name))
    return rows.map((row) => ({ ...row, remaining: null }))
  }

  const rows = await db
    .select({
      id: flavors.id,
      name: flavors.name,
      description: flavors.description,
      priceCents: flavors.priceCents,
      imageUrl: flavors.imageUrl,
      toppings: flavors.toppings,
      quantityRemaining: batchItems.quantityRemaining,
    })
    .from(flavors)
    .innerJoin(batchItems, and(eq(batchItems.flavorId, flavors.id), eq(batchItems.weekId, weekId)))
    .where(and(eq(flavors.active, true), gt(batchItems.quantityTotal, 0)))
    .orderBy(asc(flavors.name))

  return rows.map(({ quantityRemaining, ...row }) => ({ ...row, remaining: Math.max(0, quantityRemaining) }))
}
