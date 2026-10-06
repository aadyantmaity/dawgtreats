import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { beforeEach, describe, expect, it } from 'vitest'

import { POST } from '@/app/api/webhooks/stripe/route'
import { db } from '@/lib/db'
import { batchItems, orders } from '@/lib/db/schema'
import { reserve } from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

const SECRET = 'whsec_test_secret'

// Signed the way Stripe signs, then checked by the same library: no network involved.
function webhookRequest(event: unknown) {
  const payload = JSON.stringify(event)
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
    body: payload,
  })
}

const sessionEvent = (
  type:
    | 'checkout.session.completed'
    | 'checkout.session.expired'
    | 'checkout.session.async_payment_succeeded'
    | 'checkout.session.async_payment_failed',
  orderId: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`,
  object: 'event',
  type,
  data: {
    object: {
      id: 'cs_test_1',
      object: 'checkout.session',
      metadata: { orderId },
      payment_intent: 'pi_test_1',
      amount_total: 600,
      payment_status:
        type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded'
          ? 'paid'
          : 'unpaid',
      ...overrides,
    },
  },
})

beforeEach(resetDatabase)

async function anOrder() {
  const week = await seedWeek({ stock: { Snickerdoodle: 10 } })
  const reservation = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 2 }],
  })
  return { ...week, ...reservation }
}

const statusOf = async (orderId: string) =>
  (await db.select().from(orders).where(eq(orders.id, orderId)))[0].status

const stockLeft = async (flavorId: string) =>
  (await db.select().from(batchItems).where(eq(batchItems.flavorId, flavorId)))[0].quantityRemaining

describe('a payment that settles later', () => {
  // Klarna and bank debits report the checkout finished before any money moves. Treating
  // that as paid hands over the cookies for a payment that may never arrive.
  it('holds the cookies when the session finishes unpaid', async () => {
    const order = await anOrder()
    const before = await stockLeft(order.flavorIds.Snickerdoodle)

    const response = await POST(
      webhookRequest(
        sessionEvent('checkout.session.completed', order.orderId, { payment_status: 'unpaid' }),
      ),
    )

    expect(await response.json()).toMatchObject({ received: true, awaitingPayment: true })
    expect(await statusOf(order.orderId)).toBe('pending')
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(before)
  })

  it('marks the order paid once the money arrives', async () => {
    const order = await anOrder()
    await POST(
      webhookRequest(
        sessionEvent('checkout.session.completed', order.orderId, { payment_status: 'unpaid' }),
      ),
    )

    const response = await POST(
      webhookRequest(sessionEvent('checkout.session.async_payment_succeeded', order.orderId)),
    )

    expect(await response.json()).toMatchObject({ received: true, result: 'paid' })
    expect(await statusOf(order.orderId)).toBe('paid')
  })

  it('puts the cookies back when the slow payment fails', async () => {
    const order = await anOrder()
    const before = await stockLeft(order.flavorIds.Snickerdoodle)
    await POST(
      webhookRequest(
        sessionEvent('checkout.session.completed', order.orderId, { payment_status: 'unpaid' }),
      ),
    )

    await POST(webhookRequest(sessionEvent('checkout.session.async_payment_failed', order.orderId)))

    expect(await statusOf(order.orderId)).toBe('expired')
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(before + 2)
  })

  // The money is taken and nothing is holding cookies for it. A person has to decide.
  it('says so when the money lands on an order that is gone', async () => {
    const order = await anOrder()
    await POST(webhookRequest(sessionEvent('checkout.session.expired', order.orderId)))
    expect(await statusOf(order.orderId)).toBe('expired')

    const response = await POST(
      webhookRequest(sessionEvent('checkout.session.completed', order.orderId)),
    )

    expect(await response.json()).toMatchObject({ received: true, result: 'no-longer-pending' })
    expect(await statusOf(order.orderId)).toBe('expired')
  })

  it('reads a retry of a paid order as ordinary, not as a stranded payment', async () => {
    const order = await anOrder()
    await POST(webhookRequest(sessionEvent('checkout.session.completed', order.orderId)))

    const response = await POST(
      webhookRequest(sessionEvent('checkout.session.completed', order.orderId)),
    )

    expect(await response.json()).toMatchObject({ received: true, result: 'already-paid' })
  })
})

describe('the paid webhook', () => {
  it('marks the order paid', async () => {
    const order = await anOrder()

    const response = await POST(webhookRequest(sessionEvent('checkout.session.completed', order.orderId)))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ received: true, result: 'paid' })
    expect(await statusOf(order.orderId)).toBe('paid')
  })

  it('ignores the same event arriving twice', async () => {
    const order = await anOrder()
    const event = sessionEvent('checkout.session.completed', order.orderId)

    await POST(webhookRequest(event))
    const second = await POST(webhookRequest(event))

    expect(await second.json()).toMatchObject({ alreadyHandled: true })
    expect(await statusOf(order.orderId)).toBe('paid')
  })
})

describe('the expiry webhook', () => {
  it('puts the cookies back', async () => {
    const order = await anOrder()
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(8)

    await POST(webhookRequest(sessionEvent('checkout.session.expired', order.orderId)))

    expect(await statusOf(order.orderId)).toBe('expired')
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(10)
  })

  it('cannot undo a payment that already landed', async () => {
    const order = await anOrder()
    await POST(webhookRequest(sessionEvent('checkout.session.completed', order.orderId)))

    await POST(webhookRequest(sessionEvent('checkout.session.expired', order.orderId)))

    expect(await statusOf(order.orderId)).toBe('paid')
    expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(8)
  })
})

describe('what the webhook refuses', () => {
  it('rejects a payload that is not signed by Stripe', async () => {
    const order = await anOrder()
    const payload = JSON.stringify(sessionEvent('checkout.session.completed', order.orderId))
    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=forged' },
        body: payload,
      }),
    )

    expect(response.status).toBe(400)
    expect(await statusOf(order.orderId)).toBe('pending')
  })

  it('rejects a payload with no signature at all', async () => {
    const order = await anOrder()
    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(sessionEvent('checkout.session.completed', order.orderId)),
      }),
    )

    expect(response.status).toBe(400)
    expect(await statusOf(order.orderId)).toBe('pending')
  })

  it('shrugs at an event type it does not handle', async () => {
    const response = await POST(
      webhookRequest({
        id: 'evt_other',
        object: 'event',
        type: 'payment_intent.created',
        data: { object: { id: 'pi_test_2', object: 'payment_intent' } },
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ignored: 'payment_intent.created' })
  })
})
