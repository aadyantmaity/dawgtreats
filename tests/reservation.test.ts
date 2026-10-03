import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { batchItems, orderItems, orders, pickupSlots } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'
import { reserve } from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

const remainingOf = async (weekId: string, flavorId: string) => {
  const [row] = await db
    .select({ left: batchItems.quantityRemaining })
    .from(batchItems)
    .where(sql`${batchItems.weekId} = ${weekId} and ${batchItems.flavorId} = ${flavorId}`)
  return row.left
}

const orderCount = async () => {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(orders)
  return row.n
}

beforeEach(resetDatabase)

// Required by CLAUDE.md. Do not delete: it is the one rule the business cannot get wrong.
describe('no overselling', () => {
  it('gives the last 5 cookies to exactly 5 of 20 simultaneous checkouts', async () => {
    const { flavorIds, slotIds } = await seedWeek({
      stock: { Snickerdoodle: 5 },
      slots: 4,
      capacity: 5, // 20 pickups, so cookies are the only limit under test
    })
    const flavorId = flavorIds.Snickerdoodle

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        reserve({
          ...buyer,
          pickupSlotId: slotIds[i % slotIds.length],
          items: [{ flavorId, quantity: 1 }],
        }),
      ),
    )

    const won = results.filter((r) => r.status === 'fulfilled')
    const lost = results.filter((r) => r.status === 'rejected')

    expect(won).toHaveLength(5)
    expect(lost).toHaveLength(15)
    expect(lost.every((r) => (r as PromiseRejectedResult).reason instanceof DomainError)).toBe(true)
    expect(await remainingOf((await db.select().from(batchItems))[0].weekId, flavorId)).toBe(0)
    expect(await orderCount()).toBe(5)

    const [sold] = await db.select({ total: sql<number>`coalesce(sum(quantity), 0)::int` }).from(orderItems)
    expect(sold.total).toBe(5)
  })

  it('never books a slot past its capacity', async () => {
    const { flavorIds, slotIds } = await seedWeek({
      stock: { Snickerdoodle: 100 },
      slots: 1,
      capacity: 5,
    })

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        reserve({
          ...buyer,
          pickupSlotId: slotIds[0],
          items: [{ flavorId: flavorIds.Snickerdoodle, quantity: 1 }],
        }),
      ),
    )

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5)
    const [slot] = await db.select().from(pickupSlots).where(eq(pickupSlots.id, slotIds[0]))
    expect(slot.bookedCount).toBe(5)
    expect(slot.bookedCount).toBeLessThanOrEqual(slot.capacity)
  })
})

describe('a refused checkout leaves nothing behind', () => {
  it('gives back cookies taken earlier in the same order when the slot is full', async () => {
    const { weekId, flavorIds, slotIds } = await seedWeek({
      stock: { Snickerdoodle: 10, Oatmeal: 10 },
      slots: 1,
      capacity: 1,
    })
    await reserve({
      ...buyer,
      pickupSlotId: slotIds[0],
      items: [{ flavorId: flavorIds.Snickerdoodle, quantity: 1 }],
    })

    await expect(
      reserve({
        ...buyer,
        pickupSlotId: slotIds[0],
        items: [
          { flavorId: flavorIds.Snickerdoodle, quantity: 2 },
          { flavorId: flavorIds.Oatmeal, quantity: 2 },
        ],
      }),
    ).rejects.toThrow(/filled up/i)

    expect(await remainingOf(weekId, flavorIds.Snickerdoodle)).toBe(9)
    expect(await remainingOf(weekId, flavorIds.Oatmeal)).toBe(10)
    expect(await orderCount()).toBe(1)
  })

  it('refuses more than is left and says how many there are', async () => {
    const { weekId, flavorIds, slotIds } = await seedWeek({ stock: { Snickerdoodle: 3 } })

    await expect(
      reserve({
        ...buyer,
        pickupSlotId: slotIds[0],
        items: [{ flavorId: flavorIds.Snickerdoodle, quantity: 4 }],
      }),
    ).rejects.toThrow('Only 3 Snickerdoodle left')

    expect(await remainingOf(weekId, flavorIds.Snickerdoodle)).toBe(3)
    expect(await orderCount()).toBe(0)
  })
})

describe('what an order records', () => {
  it('prices from the database and freezes it on the order', async () => {
    const { flavorIds, slotIds } = await seedWeek({ stock: { Snickerdoodle: 10 } })

    const reservation = await reserve({
      ...buyer,
      pickupSlotId: slotIds[0],
      items: [{ flavorId: flavorIds.Snickerdoodle, quantity: 3 }],
    })

    expect(reservation.totalCents).toBe(900)
    const [order] = await db.select().from(orders)
    expect(order.status).toBe('pending')
    expect(order.totalCents).toBe(900)
    expect(order.paidAt).toBeNull()

    const [item] = await db.select().from(orderItems)
    expect(item.unitPriceCents).toBe(300)
  })

  it('holds the cookies for 30 minutes', async () => {
    const { flavorIds, slotIds } = await seedWeek({ stock: { Snickerdoodle: 10 } })
    const { reservedUntil } = await reserve({
      ...buyer,
      pickupSlotId: slotIds[0],
      items: [{ flavorId: flavorIds.Snickerdoodle, quantity: 1 }],
    })

    const minutes = (reservedUntil.getTime() - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(29)
    expect(minutes).toBeLessThanOrEqual(30)
  })

  it('gives every order a different code', async () => {
    const { flavorIds, slotIds } = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 20 })
    const codes = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const { orderCode } = await reserve({
        ...buyer,
        pickupSlotId: slotIds[0],
        items: [{ flavorId: flavorIds.Snickerdoodle, quantity: 1 }],
      })
      expect(orderCode).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/)
      codes.add(orderCode)
    }
    expect(codes.size).toBe(10)
  })
})

describe('when the shop is shut', () => {
  it('refuses checkout while the week is still a draft', async () => {
    const { flavorIds, slotIds } = await seedWeek({ stock: { Snickerdoodle: 10 }, status: 'draft' })

    await expect(
      reserve({
        ...buyer,
        pickupSlotId: slotIds[0],
        items: [{ flavorId: flavorIds.Snickerdoodle, quantity: 1 }],
      }),
    ).rejects.toThrow(/closed/i)
    expect(await orderCount()).toBe(0)
  })
})
