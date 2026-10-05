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
    feedbackSchema.safeParse({ rating: 4, message: 'Something', name: '', ...form })

  // A star on its own is a complete answer: most people rate and say nothing.
  it('takes a rating with nothing said', () => {
    expect(parse({ message: '   ' }).success).toBe(true)
    expect(parse({ message: '   ' }).data?.message).toBe('')
  })

  it('refuses an essay', () => {
    expect(parse({ message: 'x'.repeat(501) }).success).toBe(false)
  })

  // The form holds 0 for "no stars picked", and a rating is the one thing it must have.
  it('refuses no stars', () => {
    const refused = parse({ rating: 0 })
    expect(refused.success).toBe(false)
    expect(refused.error?.issues[0].message).toBe('Pick a rating first')
  })

  it('keeps a rating between one and five', () => {
    expect(parse({ rating: 6 }).success).toBe(false)
    expect(parse({ rating: -1 }).success).toBe(false)
  })

  it('stores an empty name as nothing', () => {
    expect(parse({ name: '  ' }).data?.name).toBeNull()
  })
})
