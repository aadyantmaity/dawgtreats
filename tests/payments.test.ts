import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { batchItems, orders, payments, pickupSlots } from '@/lib/db/schema'
import {
  listStuckOrders,
  markPaid,
  recordEvent,
  releaseOrder,
  reserve,
} from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

async function anOrder(quantity = 2) {
  const week = await seedWeek({ stock: { Snickerdoodle: 10 } })
  const reservation = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity }],
  })
  return { ...week, ...reservation }
}

const stockLeft = async (flavorId: string) => {
  const [row] = await db.select().from(batchItems).where(eq(batchItems.flavorId, flavorId))
  return row.quantityRemaining
}

describe('marking an order paid', () => {
  it('records the payment and the time', async () => {
    const order = await anOrder()

    expect(await markPaid(order.orderId, { paymentIntentId: 'pi_1', amountCents: 600 })).toBe(true)

    const [saved] = await db.select().from(orders).where(eq(orders.id, order.orderId))
    expect(saved.status).toBe('paid')
    expect(saved.paidAt).toBeInstanceOf(Date)

    const [payment] = await db.select().from(payments)
    expect(payment.stripePaymentIntentId).toBe('pi_1')
    expect(payment.amountCents).toBe(600)
  })

  it('does nothing the second time, so a retried webhook cannot double up', async () => {
    const order = await anOrder()
    await markPaid(order.orderId, { paymentIntentId: 'pi_1', amountCents: 600 })

    expect(await markPaid(order.orderId, { paymentIntentId: 'pi_1', amountCents: 600 })).toBe(false)
    const rows = await db.select().from(payments)
    expect(rows).toHaveLength(1)
  })
})

describe('releasing an order', () => {
  it('puts the cookies and the slot back', async () => {
    const order = await anOrder(3)
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(7)

    expect(await releaseOrder(order.orderId)).toBe(true)

    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(10)
    const [slot] = await db.select().from(pickupSlots).where(eq(pickupSlots.id, order.slotIds[0]))
    expect(slot.bookedCount).toBe(0)
    const [saved] = await db.select().from(orders).where(eq(orders.id, order.orderId))
    expect(saved.status).toBe('expired')
  })

  it('refuses to release a paid order, so cookies are never given away twice', async () => {
    const order = await anOrder(3)
    await markPaid(order.orderId, { paymentIntentId: 'pi_1', amountCents: 900 })

    expect(await releaseOrder(order.orderId)).toBe(false)
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(7)
  })

  it('only gives the stock back once', async () => {
    const order = await anOrder(3)
    await releaseOrder(order.orderId)

    expect(await releaseOrder(order.orderId)).toBe(false)
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(10)
  })
})

describe('event bookkeeping', () => {
  it('accepts an event id once', async () => {
    expect(await recordEvent('evt_1', 'checkout.session.completed')).toBe(true)
    expect(await recordEvent('evt_1', 'checkout.session.completed')).toBe(false)
  })
})

describe('finding orders the webhooks forgot', () => {
  it('ignores fresh orders and lists old pending ones', async () => {
    const order = await anOrder()
    expect(await listStuckOrders()).toHaveLength(0)

    await db
      .update(orders)
      .set({ createdAt: new Date(Date.now() - 40 * 60_000) })
      .where(eq(orders.id, order.orderId))
    expect(await listStuckOrders()).toHaveLength(1)

    await markPaid(order.orderId, { paymentIntentId: 'pi_1', amountCents: 600 })
    expect(await listStuckOrders()).toHaveLength(0)
  })
})
