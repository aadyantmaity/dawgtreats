import { beforeEach, describe, expect, it } from 'vitest'

import { closeWeek, openWeek } from '@/lib/weeks'

import { resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

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
  })

  it('still refuses a week with nothing to sell', async () => {
    const week = await seedWeek({ stock: {}, status: 'draft' })

    await expect(openWeek(week.weekId)).rejects.toThrow(/at least one flavor quantity/)
  })

  it('still refuses a second open week', async () => {
    const first = await seedWeek({ stock: { Snickerdoodle: 10 }, status: 'draft' })
    const second = await seedWeek({ stock: { Caramel: 10 }, status: 'draft' })
    await openWeek(first.weekId)

    await expect(openWeek(second.weekId)).rejects.toThrow(/Another week is open/)
  })
})
