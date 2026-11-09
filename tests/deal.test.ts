import { describe, expect, it } from 'vitest'

import { DEAL_ON, DEAL_SIZE, WEEKDAY_CENTS, priceOrder } from '@/lib/money'

const choc = { name: 'Chocolate Chip', quantity: 1, unitPriceCents: 150 }
const mm = { name: 'M&M', quantity: 1, unitPriceCents: 175 }
const butter = { name: 'Butterscotch', quantity: 1, unitPriceCents: 150 }

describe('what an order costs', () => {
  it('charges every cookie its own price', () => {
    const priced = priceOrder([choc, mm, butter])
    expect(priced.totalCents).toBe(475)
    expect(priced.listCents).toBe(475)
  })

  it('charges nothing for an empty basket', () => {
    const priced = priceOrder([])
    expect(priced.totalCents).toBe(0)
    expect(priced.freeCookies).toBe(0)
  })
})

describe.runIf(DEAL_ON)('three cookies earn a free one', () => {
  it('earns nothing below three', () => {
    expect(priceOrder([{ ...choc, quantity: 2 }]).freeCookies).toBe(0)
  })

  it('earns one on three, whatever they are', () => {
    expect(priceOrder([choc, mm, butter]).freeCookies).toBe(1)
    expect(priceOrder([{ ...mm, quantity: DEAL_SIZE }]).freeCookies).toBe(1)
  })

  it('repeats, and the remainder earns nothing', () => {
    expect(priceOrder([{ ...choc, quantity: 7 }]).freeCookies).toBe(2)
  })

  it('costs nothing, so the total is the cookies that were paid for', () => {
    const priced = priceOrder([{ ...choc, quantity: 3 }])
    expect(priced.freeCookies).toBe(1)
    expect(priced.totalCents).toBe(450)
  })
})

describe.skipIf(DEAL_ON)('with the offer off', () => {
  it('earns nothing, whatever the order holds', () => {
    expect(priceOrder([{ ...choc, quantity: 9 }]).freeCookies).toBe(0)
  })
})

describe('weekday pickup fee', () => {
  it('adds nothing when the pickup is not same day', () => {
    const priced = priceOrder([choc, mm, butter], false)
    expect(priced.feeCents).toBe(0)
    expect(priced.totalCents).toBe(priced.listCents)
  })

  it('charges the fee once, whatever the order holds', () => {
    const one = priceOrder([choc], true)
    const many = priceOrder([{ ...choc, quantity: 9 }], true)
    expect(one.feeCents).toBe(WEEKDAY_CENTS)
    expect(many.feeCents).toBe(WEEKDAY_CENTS)
  })

  it('is not a cookie, so it earns nothing', () => {
    const priced = priceOrder([choc, mm], true)
    expect(priced.totalCents).toBe(325 + WEEKDAY_CENTS)
    expect(priced.freeCookies).toBe(0)
  })

  it('charges nothing on an empty order', () => {
    const priced = priceOrder([], true)
    expect(priced.feeCents).toBe(0)
    expect(priced.totalCents).toBe(0)
  })
})
