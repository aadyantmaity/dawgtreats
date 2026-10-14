import { describe, expect, it } from 'vitest'

import { DEAL_CENTS, priceOrder } from '@/lib/money'

const choc = { name: 'Chocolate Chip', quantity: 1, unitPriceCents: 150 }
const mm = { name: 'M&M', quantity: 1, unitPriceCents: 175 }
const butter = { name: 'Butterscotch', quantity: 1, unitPriceCents: 150 }

describe('three for four', () => {
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
    // Seven cookies: two sets of the dearest, one $1.50 left over.
    expect(priced.totalCents).toBe(DEAL_CENTS * 2 + 150)
    expect(priced.rest).toEqual([{ name: 'Chocolate Chip', quantity: 1, unitPriceCents: 150 }])
  })

  it('leaves the cheapest cookie out of the set, whichever way the basket is filled', () => {
    const dear = priceOrder([{ ...mm, quantity: 3 }, choc])
    const cheap = priceOrder([{ ...choc, quantity: 3 }, mm])
    // The leftover is the $1.50 either way: the set takes the dearest three it can.
    expect(dear.totalCents).toBe(DEAL_CENTS + 150)
    expect(cheap.totalCents).toBe(DEAL_CENTS + 150)
    // The dearer basket is worth more at list price, so the deal saves more on it.
    expect(dear.savedCents).toBe(125)
    expect(cheap.savedCents).toBe(75)
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
})
