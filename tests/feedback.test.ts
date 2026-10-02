import { beforeEach, describe, expect, it } from 'vitest'

import { leaveFeedback, listFeedback } from '@/lib/feedback'
import { feedbackSchema } from '@/lib/validation'

import { resetDatabase } from './helpers'

beforeEach(resetDatabase)

describe('sending feedback', () => {
  it('keeps a rating and a message together', async () => {
    await leaveFeedback({ rating: 5, message: 'Perfect', name: 'Alex' })

    const [saved] = await listFeedback()
    expect(saved).toMatchObject({ rating: 5, message: 'Perfect', name: 'Alex' })
  })

  // A flavour idea needs no rating, which is why the column is nullable.
  it('takes a message with no rating and no name', async () => {
    await leaveFeedback({ rating: null, message: 'Matcha please', name: null })

    const [saved] = await listFeedback()
    expect(saved).toMatchObject({ rating: null, message: 'Matcha please', name: null })
  })

  it('newest first', async () => {
    await leaveFeedback({ rating: null, message: 'First', name: null })
    await leaveFeedback({ rating: null, message: 'Second', name: null })

    expect((await listFeedback()).map((f) => f.message)).toEqual(['Second', 'First'])
  })
})

describe('what feedback may say', () => {
  const parse = (form: Record<string, unknown>) =>
    feedbackSchema.safeParse({ rating: 0, message: 'Something', name: '', ...form })

  it('needs something actually said', () => {
    expect(parse({ message: '   ' }).success).toBe(false)
    expect(parse({ message: 'Lemon' }).success).toBe(true)
  })

  it('refuses an essay', () => {
    expect(parse({ message: 'x'.repeat(501) }).success).toBe(false)
  })

  // The form sends 0 for "no stars picked", which has to become null, not a zero rating.
  it('reads no stars as no rating', () => {
    expect(parse({ rating: 0 }).data?.rating).toBeNull()
    expect(parse({ rating: 4 }).data?.rating).toBe(4)
  })

  it('keeps a rating between one and five', () => {
    expect(parse({ rating: 6 }).success).toBe(false)
    expect(parse({ rating: -1 }).success).toBe(false)
  })

  it('stores an empty name as nothing', () => {
    expect(parse({ name: '  ' }).data?.name).toBeNull()
  })
})
