import { beforeEach, describe, expect, it } from 'vitest'

import { funnel, recordEvent } from '@/lib/analytics'

import { resetDatabase } from './helpers'

beforeEach(resetDatabase)

const seen = (visitorId: string, device?: string | null) =>
  recordEvent({ name: 'menu_viewed', visitorId, weekId: null, device })

describe('where the traffic is', () => {
  it('counts people on each kind of device', async () => {
    await seen('visitor-phone-1', 'phone')
    await seen('visitor-phone-2', 'phone')
    await seen('visitor-laptop-1', 'desktop')

    const { byDevice } = await funnel()

    expect(byDevice).toEqual([
      { device: 'phone', people: 2 },
      { device: 'desktop', people: 1 },
    ])
  })

  // Someone who reloads the menu all afternoon is still one person on one phone.
  it('counts a person once however many times they look', async () => {
    await seen('visitor-phone-1', 'phone')
    await seen('visitor-phone-1', 'phone')
    await seen('visitor-phone-1', 'phone')

    const { byDevice } = await funnel()

    expect(byDevice).toEqual([{ device: 'phone', people: 1 }])
  })

  // Every row recorded before the column existed has no device, and saying so beats
  // quietly folding those people into one of the two real answers.
  it('keeps the rows recorded before this was counted separate', async () => {
    await seen('visitor-old', null)
    await seen('visitor-phone-1', 'phone')

    const { byDevice } = await funnel()

    expect(byDevice).toContainEqual({ device: 'unknown', people: 1 })
    expect(byDevice).toContainEqual({ device: 'phone', people: 1 })
  })
})
