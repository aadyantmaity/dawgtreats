import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/cron/sweep/route'
import { db } from '@/lib/db'
import { batchItems, orders } from '@/lib/db/schema'
import { attachSession, reserve } from '@/lib/orders'
import { getSession } from '@/lib/payments'

import { buyer, resetDatabase, seedWeek } from './helpers'

// Set here rather than in vitest.config: unlike STRIPE_SECRET_KEY, CRON_SECRET has no
// global test value, and the whole point of these tests is exercising the real check.
process.env.CRON_SECRET = 'sweep_test_secret_0123456789'

// `getSession` is the only mock in this file, because the sweep is the one route that reacts
// to what Stripe reports about a session; everything else here runs against the real database.
vi.mock('@/lib/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments')>()
  return { ...actual, getSession: vi.fn() }
})

const getSessionMock = vi.mocked(getSession)

function sweepRequest(authorization?: string) {
  return GET(
    new Request('http://localhost/api/cron/sweep', {
      headers: authorization ? { authorization } : {},
    }),
  )
}

function missingSessionError() {
  // Stripe's SDK throws this shape when it no longer recognizes a session id.
  return Object.assign(new Error('No such checkout.session'), { code: 'resource_missing' })
}

const openSession = () => ({ status: 'open', payment_status: 'unpaid' }) as never

beforeEach(async () => {
  await resetDatabase()
  getSessionMock.mockReset()
})

const statusOf = async (orderId: string) =>
  (await db.select().from(orders).where(eq(orders.id, orderId)))[0].status

const stockLeft = async (flavorId: string) =>
  (await db.select().from(batchItems).where(eq(batchItems.flavorId, flavorId)))[0].quantityRemaining

// Reserves an order, then backdates it past the hold window so the sweep picks it up,
// the way a webhook that never arrived would leave it.
async function aStuckOrder(sessionId: string) {
  const week = await seedWeek({ stock: { Snickerdoodle: 10 } })
  const reservation = await stuckOrderIn(week, 'Snickerdoodle', sessionId)
  return { ...week, ...reservation }
}

// Same as `aStuckOrder`, but against a week the caller already seeded: only one open week
// can exist at a time, so several stuck orders in one test must share a week, not each seed their own.
async function stuckOrderIn(week: Awaited<ReturnType<typeof seedWeek>>, flavorName: string, sessionId: string) {
  const reservation = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds[flavorName], quantity: 2 }],
  })
  await attachSession(reservation.orderId, sessionId)
  await db
    .update(orders)
    .set({ createdAt: new Date(Date.now() - 40 * 60_000) })
    .where(eq(orders.id, reservation.orderId))
  return { ...reservation, flavorIds: { [flavorName]: week.flavorIds[flavorName] } }
}

describe('the sweep endpoint', () => {
  describe('authorisation', () => {
    it('is a 404 with no token at all', async () => {
      const order = await aStuckOrder('cs_should_not_run')

      const response = await sweepRequest()

      expect(response.status).toBe(404)
      expect(await statusOf(order.orderId)).toBe('pending')
      expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(8)
      expect(getSessionMock).not.toHaveBeenCalled()
    })

    it('is a 404 for a wrong token the same length as the real one', async () => {
      const order = await aStuckOrder('cs_should_not_run')
      const wrong = 'x'.repeat(process.env.CRON_SECRET!.length)

      const response = await sweepRequest(`Bearer ${wrong}`)

      expect(response.status).toBe(404)
      expect(await statusOf(order.orderId)).toBe('pending')
      expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(8)
    })

    it('is a 404 for a short wrong token, not just a same-length one', async () => {
      // A length mismatch is handled by the `a.length === b.length` guard before
      // timingSafeEqual ever runs: this proves that guard still returns 404 rather than throwing.
      const order = await aStuckOrder('cs_should_not_run')

      const response = await sweepRequest('Bearer x')

      expect(response.status).toBe(404)
      expect(await statusOf(order.orderId)).toBe('pending')
      expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(8)
    })

    it('accepts the real secret', async () => {
      const order = await aStuckOrder('cs_open')
      getSessionMock.mockResolvedValue(openSession())

      const response = await sweepRequest(`Bearer ${process.env.CRON_SECRET}`)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ checked: 1, stillOpen: 1 })
      expect(await statusOf(order.orderId)).toBe('pending')
    })
  })

  describe('a session Stripe can no longer find', () => {
    it('releases the cookies and expires the order', async () => {
      const order = await aStuckOrder('cs_gone')
      getSessionMock.mockRejectedValue(missingSessionError())

      const response = await sweepRequest(`Bearer ${process.env.CRON_SECRET}`)

      expect(await response.json()).toMatchObject({ released: 1, failed: 0 })
      expect(await statusOf(order.orderId)).toBe('expired')
      expect(await stockLeft(order.flavorIds.Snickerdoodle)).toBe(10)
    })
  })

  describe('fault isolation', () => {
    it('counts one bad lookup as failed, leaves it untouched, and still processes the rest', async () => {
      // One shared week: `getOrderableWeek` picks whichever open week comes back first
      // with no tie-breaker, so three separate weeks would make these reservations flaky.
      const week = await seedWeek({ stock: { Snickerdoodle: 10, Oatmeal: 10, Sugar: 10 } })
      const bad = await stuckOrderIn(week, 'Snickerdoodle', 'cs_bad')
      const expired = await stuckOrderIn(week, 'Oatmeal', 'cs_expired')
      const open = await stuckOrderIn(week, 'Sugar', 'cs_open')
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      getSessionMock.mockImplementation(async (sessionId: string) => {
        if (sessionId === 'cs_bad') throw new Error('ECONNRESET')
        if (sessionId === 'cs_expired') return { status: 'expired', payment_status: 'unpaid' } as never
        return openSession()
      })

      const response = await sweepRequest(`Bearer ${process.env.CRON_SECRET}`)

      expect(await response.json()).toMatchObject({ checked: 3, released: 1, stillOpen: 1, failed: 1 })

      // The bad one is left exactly as the sweep found it.
      expect(await statusOf(bad.orderId)).toBe('pending')
      expect(await stockLeft(bad.flavorIds.Snickerdoodle)).toBe(8)
      expect(errorSpy).toHaveBeenCalledWith(
        'sweep_order_failed',
        expect.objectContaining({ orderCode: bad.orderCode }),
      )

      // The other two were still handled despite the bad one throwing.
      expect(await statusOf(expired.orderId)).toBe('expired')
      expect(await stockLeft(expired.flavorIds.Oatmeal)).toBe(10)
      expect(await statusOf(open.orderId)).toBe('pending')
      expect(await stockLeft(open.flavorIds.Sugar)).toBe(8)

      errorSpy.mockRestore()
    })
  })
})
