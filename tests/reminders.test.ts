import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/cron/reminders/route'
import { db } from '@/lib/db'
import { orders, pickupSlots } from '@/lib/db/schema'
import { markPaid, reserve } from '@/lib/orders'
import { ptToUtc } from '@/lib/weeks'

import { buyer, resetDatabase, seedWeek } from './helpers'

// Set here rather than in vitest.config, the same way the sweep test does: CRON_SECRET
// has no global test value, and the point of these tests is exercising the real check.
process.env.CRON_SECRET = 'reminders_test_secret_0123456789'

function remindersRequest(authorization?: string) {
  return GET(
    new Request('http://localhost/api/cron/reminders', {
      headers: authorization ? { authorization } : {},
    }),
  )
}

const orderRow = async (orderId: string) =>
  (await db.select().from(orders).where(eq(orders.id, orderId)))[0]

function todayPt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

// Moves a seeded slot onto today's Pacific calendar day, the way the real slot would
// sit there on pickup morning, without re-seeding a whole week around today's date.
async function moveSlotToToday(slotId: string) {
  const startsAt = ptToUtc(todayPt(), '10:00')
  await db
    .update(pickupSlots)
    .set({ startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000) })
    .where(eq(pickupSlots.id, slotId))
}

async function reservedOrder(flavorName = 'Snickerdoodle') {
  const week = await seedWeek({ stock: { [flavorName]: 10 } })
  const reservation = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds[flavorName], quantity: 2 }],
  })
  return { ...week, ...reservation }
}

beforeEach(async () => {
  await resetDatabase()
  delete process.env.RESEND_API_KEY
})

describe('the reminders endpoint', () => {
  describe('authorisation', () => {
    it('is a 404 with no token at all', async () => {
      const order = await reservedOrder()
      await moveSlotToToday(order.slotIds[0])
      await markPaid(order.orderId, { paymentIntentId: 'pi_noauth', amountCents: order.totalCents })

      const response = await remindersRequest()

      expect(response.status).toBe(404)
      expect(await orderRow(order.orderId)).toMatchObject({ reminderSentAt: null })
    })
  })

  describe('a paid order picking up today', () => {
    it('gets exactly one reminder even when the route runs twice', async () => {
      process.env.RESEND_API_KEY = 'test_key'
      const order = await reservedOrder()
      await moveSlotToToday(order.slotIds[0])
      await markPaid(order.orderId, { paymentIntentId: 'pi_today', amountCents: order.totalCents })
      const posts = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }))

      const first = await remindersRequest(`Bearer ${process.env.CRON_SECRET}`)
      expect(await first.json()).toMatchObject({ checked: 1, sent: 1, failed: 0 })

      const afterFirst = await orderRow(order.orderId)
      expect(afterFirst.reminderSentAt).not.toBeNull()

      const second = await remindersRequest(`Bearer ${process.env.CRON_SECRET}`)
      expect(await second.json()).toMatchObject({ checked: 0, sent: 0 })

      const afterSecond = await orderRow(order.orderId)
      expect(afterSecond.reminderSentAt).toEqual(afterFirst.reminderSentAt)

      const reminderCalls = posts.mock.calls.filter(
        ([url]) => String(url) === 'https://api.resend.com/emails',
      )
      expect(reminderCalls).toHaveLength(1)
      expect(JSON.parse(String(reminderCalls[0][1]?.body)).to).toBe(buyer.email)

      posts.mockRestore()
    })
  })

  describe('a reminder that could not be sent', () => {
    it('is tried again next run, because a silent miss defeats the point', async () => {
      process.env.RESEND_API_KEY = 'test_key'
      const order = await reservedOrder()
      await moveSlotToToday(order.slotIds[0])
      await markPaid(order.orderId, { paymentIntentId: 'pi_retry', amountCents: order.totalCents })
      const posts = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('mail is down', { status: 500 }))
        .mockResolvedValue(new Response(JSON.stringify({ id: 'msg_2' }), { status: 200 }))

      const first = await remindersRequest(`Bearer ${process.env.CRON_SECRET}`)
      expect(await first.json()).toMatchObject({ checked: 1, sent: 0, failed: 1 })
      // The claim went back, so the order is still waiting rather than marked done.
      expect(await orderRow(order.orderId)).toMatchObject({ reminderSentAt: null })

      const second = await remindersRequest(`Bearer ${process.env.CRON_SECRET}`)
      expect(await second.json()).toMatchObject({ checked: 1, sent: 1, failed: 0 })
      expect((await orderRow(order.orderId)).reminderSentAt).not.toBeNull()

      posts.mockRestore()
      delete process.env.RESEND_API_KEY
    })
  })

  describe('an order that never paid', () => {
    it('gets no reminder', async () => {
      const order = await reservedOrder()
      await moveSlotToToday(order.slotIds[0])
      const posts = vi.spyOn(globalThis, 'fetch')

      const response = await remindersRequest(`Bearer ${process.env.CRON_SECRET}`)

      expect(await response.json()).toMatchObject({ checked: 0, sent: 0 })
      expect(await orderRow(order.orderId)).toMatchObject({ status: 'pending', reminderSentAt: null })
      expect(posts).not.toHaveBeenCalled()

      posts.mockRestore()
    })
  })

  describe('a paid order whose pickup is not today', () => {
    it('gets no reminder', async () => {
      const order = await reservedOrder()
      await markPaid(order.orderId, { paymentIntentId: 'pi_later', amountCents: order.totalCents })
      const posts = vi.spyOn(globalThis, 'fetch')

      const response = await remindersRequest(`Bearer ${process.env.CRON_SECRET}`)

      expect(await response.json()).toMatchObject({ checked: 0, sent: 0 })
      expect(await orderRow(order.orderId)).toMatchObject({ status: 'paid', reminderSentAt: null })
      expect(posts).not.toHaveBeenCalled()

      posts.mockRestore()
    })
  })
})
