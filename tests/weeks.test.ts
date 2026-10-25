import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { weeks } from '@/lib/db/schema'
import { closeWeek, isPickupBookable, isWeekdayPickup, openWeek, ptToUtc } from '@/lib/weeks'

import { resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

const statusOf = async (weekId: string) => (await db.select().from(weeks).where(eq(weeks.id, weekId)))[0].status

describe('opening a week', () => {
  // Closing early is a judgement call, so a mistaken one has to be undoable.
  it('reopens a week closed by hand, while its cutoff is still ahead', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 10 }, status: 'draft' })
    await openWeek(week.weekId)
    await closeWeek(week.weekId)

    const reopened = await openWeek(week.weekId)

    expect(reopened.status).toBe('open')
  })

  it('refuses a week that is already open', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 10 }, status: 'draft' })
    await openWeek(week.weekId)

    await expect(openWeek(week.weekId)).rejects.toThrow(/already open/)
    expect(await statusOf(week.weekId)).toBe('open')
  })

  it('still refuses a week with nothing to sell', async () => {
    const week = await seedWeek({ stock: {}, status: 'draft' })

    await expect(openWeek(week.weekId)).rejects.toThrow(/at least one flavor quantity/)
    expect(await statusOf(week.weekId)).toBe('draft')
  })

  it('still refuses a second open week', async () => {
    const first = await seedWeek({ stock: { Snickerdoodle: 10 }, status: 'draft' })
    const second = await seedWeek({ stock: { Caramel: 10 }, status: 'draft' })
    await openWeek(first.weekId)

    await expect(openWeek(second.weekId)).rejects.toThrow(/Another week is open/)
    expect(await statusOf(second.weekId)).toBe('draft')
  })
})

describe('weekday pickup', () => {
  it('charges on a weekday evening, whenever it was ordered', () => {
    // 2026-10-20 is a Tuesday, 10-21 a Wednesday. Both carry the fee, and the day the
    // order is placed on has nothing to do with it.
    expect(isWeekdayPickup(ptToUtc('2026-10-20', '20:00'))).toBe(true)
    expect(isWeekdayPickup(ptToUtc('2026-10-21', '20:00'))).toBe(true)
    expect(isWeekdayPickup(ptToUtc('2026-10-22', '20:00'))).toBe(true)
  })

  it('does not charge on the pickup weekend', () => {
    expect(isWeekdayPickup(ptToUtc('2026-10-24', '12:00'))).toBe(false)
    expect(isWeekdayPickup(ptToUtc('2026-10-25', '14:00'))).toBe(false)
  })

  it('reads the day in PT, not UTC', () => {
    // 8pm PT on Tuesday is 3am UTC on Wednesday. Read in UTC this is the wrong day, and a
    // late Sunday window would start charging.
    const sunday = ptToUtc('2026-10-25', '20:00')
    expect(sunday.toISOString().slice(0, 10)).toBe('2026-10-26')
    expect(isWeekdayPickup(sunday)).toBe(false)
  })
})

describe('the pickup lead time', () => {
  // 2026-10-20 is a Tuesday. All times below are PT.
  const start = ptToUtc('2026-10-20', '20:00')
  const end = ptToUtc('2026-10-20', '23:00')

  it('is open while more than an hour of today is left', () => {
    expect(isPickupBookable(start, end, ptToUtc('2026-10-20', '21:00'))).toBe(true)
    expect(isPickupBookable(start, end, ptToUtc('2026-10-20', '21:59'))).toBe(true)
  })

  it('closes an hour before today ends', () => {
    expect(isPickupBookable(start, end, ptToUtc('2026-10-20', '22:00'))).toBe(true)
    expect(isPickupBookable(start, end, ptToUtc('2026-10-20', '22:01'))).toBe(false)
    expect(isPickupBookable(start, end, ptToUtc('2026-10-20', '22:58'))).toBe(false)
  })

  it('does not apply to a window on a later day', () => {
    // Ordering on Monday for Tuesday: the hour rule has nothing to say about it, however
    // close to Tuesday's closing time the clock happens to read.
    expect(isPickupBookable(start, end, ptToUtc('2026-10-19', '22:30'))).toBe(true)
    expect(isPickupBookable(start, end, ptToUtc('2026-10-19', '23:59'))).toBe(true)
  })

  it('leaves the weekend alone, which is never today while orders are open', () => {
    const sat = [ptToUtc('2026-10-24', '13:00'), ptToUtc('2026-10-24', '16:00')] as const
    expect(isPickupBookable(sat[0], sat[1], ptToUtc('2026-10-22', '23:00'))).toBe(true)
  })
})
