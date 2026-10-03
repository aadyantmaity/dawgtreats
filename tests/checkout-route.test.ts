import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// This suite has no request, so `currentAccount` cannot read a session from cookies through `next/headers`.
// The mock returns null, the same result a real guest checkout gets; the route itself stays untouched.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, currentAccount: vi.fn() }
})

import { POST } from '@/app/api/checkout/route'
import { currentAccount } from '@/lib/auth'
import { db } from '@/lib/db'
import { batchItems, orders, pickupSlots } from '@/lib/db/schema'

import { resetDatabase, seedWeek } from './helpers'

vi.mocked(currentAccount).mockResolvedValue(null)

beforeEach(resetDatabase)

function checkoutRequest(body: unknown) {
  const isString = typeof body === 'string'
  return POST(
    new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: isString ? body : JSON.stringify(body),
    }),
  )
}

async function anOrderableWeek() {
  return seedWeek({ stock: { Snickerdoodle: 10 } })
}

function validBody(week: Awaited<ReturnType<typeof anOrderableWeek>>) {
  return {
    name: 'Test Buyer',
    email: 'buyer@example.com',
    phone: '2065550123',
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 2 }],
  }
}

const orderCount = async () => (await db.select().from(orders)).length

const stockLeft = async (flavorId: string) =>
  (await db.select().from(batchItems).where(eq(batchItems.flavorId, flavorId)))[0].quantityRemaining

const bookedCount = async (slotId: string) =>
  (await db.select().from(pickupSlots).where(eq(pickupSlots.id, slotId)))[0].bookedCount

describe('what checkout refuses', () => {
  it('rejects a body that is not JSON at all', async () => {
    const week = await anOrderableWeek()

    const response = await checkoutRequest('not json')

    expect(response.status).toBe(400)
    expect(typeof (await response.json()).error).toBe('string')
    expect(await orderCount()).toBe(0)
    expect(await stockLeft(week.flavorIds.Snickerdoodle)).toBe(10)
  })

  it('rejects a body missing the email', async () => {
    const week = await anOrderableWeek()
    const body = validBody(week) as Record<string, unknown>
    delete body.email

    const response = await checkoutRequest(body)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/email/i)
    expect(await orderCount()).toBe(0)
    expect(await stockLeft(week.flavorIds.Snickerdoodle)).toBe(10)
  })

  it('rejects a quantity of the wrong type', async () => {
    const week = await anOrderableWeek()
    const body = validBody(week)
    body.items = [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 'two' }] as never

    const response = await checkoutRequest(body)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(typeof json.error).toBe('string')
    expect(json.error.length).toBeGreaterThan(0)
    expect(await orderCount()).toBe(0)
    expect(await stockLeft(week.flavorIds.Snickerdoodle)).toBe(10)
  })
})

describe('when Stripe cannot create the session', () => {
  const realKey = process.env.STRIPE_SECRET_KEY

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = realKey
  })

  it('releases the reservation instead of leaving stock locked', async () => {
    const week = await anOrderableWeek()
    // `lib/payments` throws a 503 when `STRIPE_SECRET_KEY` is unset, which this deletion triggers on purpose.
    delete process.env.STRIPE_SECRET_KEY

    const response = await checkoutRequest(validBody(week))
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(typeof json.error).toBe('string')

    // The whole point: checkout reserves stock, then gives it back rather than leaving it pending.
    const [order] = await db.select().from(orders)
    expect(order.status).toBe('expired')
    expect(await stockLeft(week.flavorIds.Snickerdoodle)).toBe(10)
    expect(await bookedCount(week.slotIds[0])).toBe(0)
  })
})
