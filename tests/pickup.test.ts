import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { setRole, syncAccount } from '@/lib/auth'
import { db } from '@/lib/db'
import { orders } from '@/lib/db/schema'
import {
  listPickupDay,
  markBackToPaid,
  markPaid,
  markPickedUp,
  markReady,
  reserve,
} from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

type Week = Awaited<ReturnType<typeof seedWeek>>

const place = (week: Week, quantity = 2) =>
  reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity }],
  })

async function paidOrder(week: Week, quantity = 2) {
  const order = await place(week, quantity)
  await markPaid(order.orderId, { paymentIntentId: `pi_${order.orderCode}`, amountCents: order.totalCents })
  return order
}

const statusOf = async (orderCode: string) => {
  const [row] = await db.select().from(orders).where(eq(orders.orderCode, orderCode))
  return row.status
}

describe('the pickup list', () => {
  it('groups paid orders under their slot, with what to bag', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, slots: 2, capacity: 10 })
    const order = await paidOrder(week, 3)

    const groups = await listPickupDay(week.weekId)

    expect(groups).toHaveLength(2)
    expect(groups[0].orders).toHaveLength(1)
    expect(groups[1].orders).toHaveLength(0)
    expect(groups[0].orders[0]).toMatchObject({
      orderCode: order.orderCode,
      name: buyer.name,
      phone: buyer.phone,
      cookieCount: 3,
      status: 'paid',
    })
  })

  // Someone whose payment never landed has no cookies behind their order.
  it('never lists an order that was not paid for', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
    await place(week)

    const [group] = await listPickupDay(week.weekId)

    expect(group.orders).toHaveLength(0)
  })
})

describe('handing cookies over', () => {
  it('walks an order from paid to bagged to gone', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
    const order = await paidOrder(week)

    expect(await markReady(order.orderId)).toBe(true)
    expect(await statusOf(order.orderCode)).toBe('ready')
    expect(await markPickedUp(order.orderId)).toBe(true)
    expect(await statusOf(order.orderCode)).toBe('picked_up')
  })

  it('lets someone collect before their bag is packed', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
    const order = await paidOrder(week)

    expect(await markPickedUp(order.orderId)).toBe(true)
    expect(await statusOf(order.orderCode)).toBe('picked_up')
  })

  // Two taps, or two phones open at once, must not walk an order backwards.
  it('refuses to repeat a step it already took', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
    const order = await paidOrder(week)
    await markReady(order.orderId)

    expect(await markReady(order.orderId)).toBe(false)
    expect(await statusOf(order.orderCode)).toBe('ready')

    await markPickedUp(order.orderId)
    expect(await markPickedUp(order.orderId)).toBe(false)
    expect(await statusOf(order.orderCode)).toBe('picked_up')
  })

  it('never hands over an order nobody paid for', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
    const order = await place(week)

    expect(await markReady(order.orderId)).toBe(false)
    expect(await markPickedUp(order.orderId)).toBe(false)
    expect(await statusOf(order.orderCode)).toBe('pending')
  })

  it('undoes a mistaken tap', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
    const order = await paidOrder(week)
    await markPickedUp(order.orderId)

    expect(await markBackToPaid(order.orderId)).toBe(true)
    expect(await statusOf(order.orderCode)).toBe('paid')
  })
})

describe('who can open the page', () => {
  it('promotes and demotes an account by email', async () => {
    await syncAccount({ supabaseUid: crypto.randomUUID(), email: 'me@example.com', name: 'Me' })

    expect((await setRole('ME@EXAMPLE.COM', 'admin')).role).toBe('admin')
    expect((await setRole('me@example.com', 'customer')).role).toBe('customer')
  })

  it('refuses an email that never signed in', async () => {
    await expect(setRole('nobody@example.com', 'admin')).rejects.toThrow(/must sign in once/)
  })
})
