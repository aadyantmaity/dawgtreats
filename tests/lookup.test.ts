import { beforeEach, describe, expect, it } from 'vitest'

import { GET } from '@/app/api/orders/[code]/route'
import { reserve } from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

function lookup(code: string, ip = '203.0.113.1') {
  return GET(new Request(`http://localhost/api/orders/${code}`, { headers: { 'x-forwarded-for': ip } }), {
    params: Promise.resolve({ code }),
  })
}

beforeEach(resetDatabase)

async function anOrder() {
  const week = await seedWeek({ stock: { Snickerdoodle: 10 } })
  return reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 2 }],
  })
}

describe('looking an order up by its code', () => {
  it('returns the order', async () => {
    const order = await anOrder()

    const response = await lookup(order.orderCode)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ orderCode: order.orderCode, status: 'pending', totalCents: 600 })
    expect(body.lines).toEqual([{ name: 'Snickerdoodle', quantity: 2, unitPriceCents: 300 }])
  })

  it('never returns who placed it', async () => {
    const order = await anOrder()

    const body = await (await lookup(order.orderCode)).json()

    const text = JSON.stringify(body)
    expect(text).not.toContain(buyer.name)
    expect(text).not.toContain(buyer.email)
    expect(text).not.toContain(buyer.phone)
  })

  it('accepts a lowercase code, the way someone would type it', async () => {
    const order = await anOrder()

    const response = await lookup(order.orderCode.toLowerCase(), '203.0.113.2')

    expect(response.status).toBe(200)
  })

  it('says no for a code that does not exist', async () => {
    const response = await lookup('ZZZZZZZZ', '203.0.113.3')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: 'No order with that code' })
  })
})

describe('guessing codes', () => {
  it('is cut off after 20 tries a minute', async () => {
    const ip = '198.51.100.7'
    const codes = Array.from({ length: 20 }, (_, i) => `GUESS${String(i).padStart(3, '0')}`)
    for (const code of codes) expect((await lookup(code, ip)).status).toBe(404)

    const blocked = await lookup('GUESS999', ip)

    expect(blocked.status).toBe(429)
    expect((await lookup('GUESS999', '198.51.100.8')).status).toBe(404)
  })
})
