import { describe, expect, it } from 'vitest'

import { DEAL_CENTS, DEAL_ON, WEEKDAY_CENTS, priceOrder } from '@/lib/money'

const choc = { name: 'Chocolate Chip', quantity: 1, unitPriceCents: 150 }
const mm = { name: 'M&M', quantity: 1, unitPriceCents: 175 }
const butter = { name: 'Butterscotch', quantity: 1, unitPriceCents: 150 }

// The deal is off, so there is nothing to price as a set. The cases stay for the day it
// comes back, and the suite below covers what a cookie costs while it is off.
describe.runIf(DEAL_ON)('three for four', () => {
  it('charges list price below three cookies', () => {
    const priced = priceOrder([{ ...choc, quantity: 2 }])
    expect(priced.totalCents).toBe(300)
    expect(priced.sets).toBe(0)
    expect(priced.savedCents).toBe(0)
  })

  it('prices any three as one set', () => {
    const priced = priceOrder([choc, mm, butter])
    expect(priced.listCents).toBe(475)
    expect(priced.totalCents).toBe(DEAL_CENTS)
    expect(priced.sets).toBe(1)
    expect(priced.savedCents).toBe(75)
  })

  it('prices three of one flavor as a set too', () => {
    expect(priceOrder([{ ...mm, quantity: 3 }]).totalCents).toBe(DEAL_CENTS)
  })

  it('repeats, and leaves the remainder at list price', () => {
    const priced = priceOrder([{ ...mm, quantity: 4 }, { ...choc, quantity: 3 }])
    expect(priced.sets).toBe(2)
    // Seven cookies: two sets of the cheapest, one $1.75 left over.
    expect(priced.totalCents).toBe(DEAL_CENTS * 2 + 175)
    expect(priced.rest).toEqual([{ name: 'M&M', quantity: 1, unitPriceCents: 175 }])
  })

  it('leaves the dearest cookie out of the set, whichever way the basket is filled', () => {
    const dear = priceOrder([{ ...mm, quantity: 3 }, choc])
    const cheap = priceOrder([{ ...choc, quantity: 3 }, mm])
    // The leftover is the $1.75 either way: the set takes the cheapest three it can.
    expect(dear.totalCents).toBe(DEAL_CENTS + 175)
    expect(cheap.totalCents).toBe(DEAL_CENTS + 175)
    // The dearer basket is worth more at list price, so the deal saves more on it.
    expect(dear.savedCents).toBe(100)
    expect(cheap.savedCents).toBe(50)
  })

  it('never charges more than the cookies are worth', () => {
    // A set of three at a dollar each is cheaper than the deal, so the deal stands aside.
    const cheap = { name: 'Plain', quantity: 3, unitPriceCents: 100 }
    expect(priceOrder([cheap]).totalCents).toBe(300)
    expect(priceOrder([cheap]).savedCents).toBe(0)
  })

  it('counts nothing as nothing', () => {
    expect(priceOrder([]).totalCents).toBe(0)
    expect(priceOrder([]).sets).toBe(0)
  })
  it('sits outside the deal, so a set still costs the set price', () => {
    const priced = priceOrder([choc, mm, butter], true)
    expect(priced.totalCents).toBe(DEAL_CENTS + WEEKDAY_CENTS)
    expect(priced.sets).toBe(1)
    // The fee is not a cookie, so it must not look like the deal saved less.
    expect(priced.savedCents).toBe(75)
  })
})

describe('weekday pickup fee', () => {
  it('adds nothing when the pickup is not same day', () => {
    const priced = priceOrder([choc, mm, butter], false)
    expect(priced.feeCents).toBe(0)
    expect(priced.totalCents).toBe(priced.listCents - priced.savedCents)
  })

  it('charges the fee once, whatever the order holds', () => {
    const one = priceOrder([choc], true)
    const many = priceOrder([{ ...choc, quantity: 9 }], true)
    expect(one.feeCents).toBe(WEEKDAY_CENTS)
    expect(many.feeCents).toBe(WEEKDAY_CENTS)
  })

  it('charges nothing on an empty order', () => {
    const priced = priceOrder([], true)
    expect(priced.feeCents).toBe(0)
    expect(priced.totalCents).toBe(0)
  })
})

describe.skipIf(DEAL_ON)('with the deal off', () => {
  it('charges every cookie its own price', () => {
    const priced = priceOrder([choc, mm, butter])
    expect(priced.totalCents).toBe(475)
    expect(priced.sets).toBe(0)
    expect(priced.savedCents).toBe(0)
  })
})
