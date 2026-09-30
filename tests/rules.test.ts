import { describe, expect, it } from 'vitest'

import { formatCents, parsePriceCents } from '@/lib/money'
import { checkoutSchema, nameError, priceError, quantityError } from '@/lib/validation'
import { ptToUtc, upcomingWeekend } from '@/lib/weeks'

describe('money never goes through a float', () => {
  it('reads dollars as whole cents', () => {
    expect(parsePriceCents('3.50')).toBe(350)
    expect(parsePriceCents('$3.5')).toBe(350)
    expect(parsePriceCents('3')).toBe(300)
    expect(parsePriceCents('0.05')).toBe(5)
  })

  it('refuses anything that is not a price', () => {
    expect(parsePriceCents('3.501')).toBeNull()
    expect(parsePriceCents('free')).toBeNull()
    expect(parsePriceCents('')).toBeNull()
  })

  it('writes cents back as dollars', () => {
    expect(formatCents(350)).toBe('$3.50')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(1000)).toBe('$10.00')
  })
})

describe('input rules', () => {
  it('requires a name that is not just spaces', () => {
    expect(nameError('  ')).toBe('Name is required')
    expect(nameError('Snickerdoodle')).toBeNull()
  })

  it('keeps prices between a cent and $100', () => {
    expect(priceError('0')).toBe('Price must be more than $0')
    expect(priceError('100.01')).toBe('Price must be $100.00 or less')
    expect(priceError('3.50')).toBeNull()
  })

  it('will not let a quantity drop below what is already sold', () => {
    expect(quantityError('4', 5)).toMatch(/below 5/)
    expect(quantityError('5', 5)).toBeNull()
    expect(quantityError('', 0)).toBeNull()
    expect(quantityError('1001', 0)).toMatch(/1000 or fewer/)
  })
})

describe('what checkout accepts', () => {
  const base = {
    name: 'Buyer',
    email: 'buyer@example.com',
    phone: '2065550123',
    pickupSlotId: '11111111-1111-4111-8111-111111111111',
  }
  const parse = (items: { flavorId: string; quantity: number }[]) =>
    checkoutSchema.safeParse({ ...base, items })
  const flavor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  it('takes a normal cart', () => {
    expect(parse([{ flavorId: flavor, quantity: 2 }]).success).toBe(true)
  })

  it('refuses an empty cart', () => {
    expect(parse([]).error?.issues[0].message).toBe('Your cart is empty')
  })

  it('caps the whole order at 24 cookies', () => {
    const result = parse([
      { flavorId: flavor, quantity: 20 },
      { flavorId: other, quantity: 5 },
    ])
    expect(result.error?.issues[0].message).toMatch(/24 cookies per order/)
  })

  it('refuses the same flavor twice', () => {
    const result = parse([
      { flavorId: flavor, quantity: 1 },
      { flavorId: flavor, quantity: 1 },
    ])
    expect(result.error?.issues[0].message).toBe('Each flavor can appear only once')
  })

  it('refuses an email that is not one', () => {
    const result = checkoutSchema.safeParse({
      ...base,
      email: 'buyer',
      items: [{ flavorId: flavor, quantity: 1 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('which weekend is next', () => {
  const at = (iso: string) => upcomingWeekend(new Date(iso)).pickupWeekendStart

  it('offers this weekend up to the Thursday cutoff', () => {
    expect(at('2026-09-18T19:00:00Z')).toBe('2026-09-26') // Fri: cutoff gone, so next week
    expect(at('2026-09-24T06:58:00Z')).toBe('2026-09-26') // Wed evening PT
    expect(at('2026-09-25T06:58:00Z')).toBe('2026-09-26') // Thu 11:58pm PT
  })

  it('rolls over the moment the cutoff passes', () => {
    expect(at('2026-09-25T06:59:00Z')).toBe('2026-10-03')
  })

  it('reads the date in Pacific time, not UTC', () => {
    // Thursday 8pm PT is already Friday in UTC; the cutoff has not passed.
    expect(at('2026-09-25T03:00:00Z')).toBe('2026-09-26')
  })

  it('survives the end of daylight saving', () => {
    const before = upcomingWeekend(new Date('2026-10-30T06:30:00Z'))
    expect(before.ordersCloseAt.toISOString()).toBe('2026-10-30T06:59:00.000Z') // PDT

    const after = upcomingWeekend(new Date('2026-11-06T07:30:00Z'))
    expect(after.pickupWeekendStart).toBe('2026-11-07')
    expect(after.ordersCloseAt.toISOString()).toBe('2026-11-06T07:59:00.000Z') // PST, an hour later
  })

  it('turns a Pacific wall time into the right instant on both sides of the switch', () => {
    expect(ptToUtc('2026-10-31', '12:00').toISOString()).toBe('2026-10-31T19:00:00.000Z')
    expect(ptToUtc('2026-11-07', '12:00').toISOString()).toBe('2026-11-07T20:00:00.000Z')
  })
})
