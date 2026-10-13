import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { orders, pickupSlots } from '@/lib/db/schema'
import { listSlotsForOrder, markPaid, markReminderSent, moveToSlot, reserve } from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

async function aPaidOrder(slots = 2, capacity = 5) {
  const week = await seedWeek({ stock: { Snickerdoodle: 10 }, slots, capacity })
  const reservation = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 1 }],
  })
  await markPaid(reservation.orderId, { paymentIntentId: 'pi_move', amountCents: 300 })
  return { ...week, ...reservation }
}

const booked = async (slotId: string) =>
  (await db.select().from(pickupSlots).where(eq(pickupSlots.id, slotId)))[0].bookedCount

const slotOf = async (orderId: string) =>
  (await db.select().from(orders).where(eq(orders.id, orderId)))[0].pickupSlotId

const reminderMark = async (orderId: string) =>
  (await db.select().from(orders).where(eq(orders.id, orderId)))[0].reminderSentAt

describe('moving a pickup to another time', () => {
  it('takes the new slot and gives the old one back', async () => {
    const order = await aPaidOrder()
    expect(await booked(order.slotIds[0])).toBe(1)

    await moveToSlot(order.orderCode, order.slotIds[1])

    expect(await slotOf(order.orderId)).toBe(order.slotIds[1])
    expect(await booked(order.slotIds[0])).toBe(0)
    expect(await booked(order.slotIds[1])).toBe(1)
  })

  // A reminder names a time, so the one already sent is wrong the moment the time moves.
  it('clears a sent reminder, so the new time gets one of its own', async () => {
    const order = await aPaidOrder()
    expect(await markReminderSent(order.orderId)).toBe(true)

    await moveToSlot(order.orderCode, order.slotIds[1])

    expect(await reminderMark(order.orderId)).toBeNull()
    // The claim is free again, so the next run sends the time the customer now has.
    expect(await markReminderSent(order.orderId)).toBe(true)
  })

  // A slot that is full has somebody else's cookies behind every place in it.
  it('refuses a time that is already full, and changes nothing', async () => {
    const order = await aPaidOrder(2, 1)
    await reserve({
      ...buyer,
      pickupSlotId: order.slotIds[1],
      items: [{ flavorId: order.flavorIds.Snickerdoodle, quantity: 1 }],
    })

    await expect(moveToSlot(order.orderCode, order.slotIds[1])).rejects.toThrow(/filled up/)

    expect(await slotOf(order.orderId)).toBe(order.slotIds[0])
    expect(await booked(order.slotIds[0])).toBe(1)
    expect(await booked(order.slotIds[1])).toBe(1)
  })

  it('refuses a slot belonging to another week', async () => {
    const order = await aPaidOrder()
    const other = await seedWeek({ stock: { Snickerdoodle: 5 } })

    await expect(moveToSlot(order.orderCode, other.slotIds[0])).rejects.toThrow(/not on this week/)

    expect(await slotOf(order.orderId)).toBe(order.slotIds[0])
  })

  // An order still waiting on Stripe has no pickup anyone can rely on yet.
  it('refuses an order that is not waiting for pickup', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 10 }, slots: 2 })
    const pending = await reserve({
      ...buyer,
      pickupSlotId: week.slotIds[0],
      items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 1 }],
    })

    await expect(moveToSlot(pending.orderCode, week.slotIds[1])).rejects.toThrow(
      /waiting for pickup/,
    )
  })

  it('refuses the time the order already has', async () => {
    const order = await aPaidOrder()
    await expect(moveToSlot(order.orderCode, order.slotIds[0])).rejects.toThrow(/already your/)
  })

  it('offers the other times, and marks the one in use', async () => {
    const order = await aPaidOrder()

    const choices = await listSlotsForOrder(order.orderCode)

    expect(choices).toHaveLength(2)
    expect(choices.find((slot) => slot.id === order.slotIds[0])?.current).toBe(true)
    expect(choices.find((slot) => slot.id === order.slotIds[1])?.current).toBe(false)
  })

  it('offers nothing for an order nobody has paid for', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 10 }, slots: 2 })
    const pending = await reserve({
      ...buyer,
      pickupSlotId: week.slotIds[0],
      items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 1 }],
    })

    expect(await listSlotsForOrder(pending.orderCode)).toEqual([])
  })
})
