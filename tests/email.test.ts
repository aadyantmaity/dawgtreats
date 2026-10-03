import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/lib/db'
import { flavors } from '@/lib/db/schema'
import { sendConfirmation } from '@/lib/email'
import { formatCents } from '@/lib/money'
import { reserve } from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test_key'
})

afterEach(() => {
  delete process.env.RESEND_API_KEY
  vi.unstubAllGlobals()
})

// Captures the request Resend would have received instead of sending anything.
function stubFetch(
  respond: (url: string, init: RequestInit) => Response | Promise<Response> = () =>
    new Response(JSON.stringify({ id: 'msg_1' })),
) {
  const fetchMock = vi.fn(respond)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>) {
  const [, init] = fetchMock.mock.calls[0]
  return JSON.parse(init.body as string) as { to: string; subject: string; text: string }
}

async function anOrder() {
  const week = await seedWeek({ stock: { Snickerdoodle: 10, Caramel: 10 } })
  const reservation = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [
      { flavorId: week.flavorIds.Snickerdoodle, quantity: 2 },
      { flavorId: week.flavorIds.Caramel, quantity: 3 },
    ],
  })
  return { ...week, ...reservation }
}

describe('sending the order confirmation', () => {
  it('posts the order code, each line, and the pickup details', async () => {
    const fetchMock = stubFetch()
    const order = await anOrder()

    const result = await sendConfirmation(order.orderCode)

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')

    const body = sentBody(fetchMock)
    expect(body.to).toBe(buyer.email)
    expect(body.text).toContain(`Order code: ${order.orderCode}`)
    expect(body.text).toContain(`2 x Snickerdoodle  ${formatCents(600)}`)
    expect(body.text).toContain(`3 x Caramel  ${formatCents(900)}`)
    expect(body.text).toContain('The Standard at Seattle, Midrise lobby.')
    // Thursday 11:59pm PT cutoff means the pickup weekend is always a Sat/Sun; the
    // seeded slot starts at 20:00 UTC, 12-13pm PT depending on daylight saving.
    expect(body.text).toMatch(/Pick up (Saturday|Sunday), .+-.+\./)
  })

  it('totals the money from the price stored on the order, not the flavor table', async () => {
    const fetchMock = stubFetch()
    const order = await anOrder()

    // Flavours can reprice after an order is placed; the receipt must not recompute.
    await db.update(flavors).set({ priceCents: 50_000 }).where(eq(flavors.id, order.flavorIds.Snickerdoodle))
    await db.update(flavors).set({ priceCents: 50_000 }).where(eq(flavors.id, order.flavorIds.Caramel))

    await sendConfirmation(order.orderCode)

    const body = sentBody(fetchMock)
    const expectedTotal = 2 * 300 + 3 * 300
    expect(order.totalCents).toBe(expectedTotal)
    expect(body.text).toContain(`Total: ${formatCents(expectedTotal)}`)
    expect(body.text).not.toContain(formatCents(50_000 * 5))
  })

  it('never throws when Resend is unreachable, so a failed email cannot look like a failed webhook', async () => {
    stubFetch(() => Promise.reject(new Error('network down')))
    const order = await anOrder()

    await expect(sendConfirmation(order.orderCode)).resolves.toBe(false)
  })

  it('returns false and sends nothing for an order code that does not exist', async () => {
    const fetchMock = stubFetch()

    const result = await sendConfirmation('ZZZZ')

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
