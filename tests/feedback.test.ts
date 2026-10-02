import { beforeEach, describe, expect, it } from 'vitest'

import { markPaid, markPickedUp, reserve } from '@/lib/orders'
import { askFor, hasReview, leaveReview, listRequests, listReviews } from '@/lib/reviews'
import { requestSchema, reviewSchema } from '@/lib/validation'

import { buyer, resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

async function collectedOrder() {
  const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
  const order = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 2 }],
  })
  await markPaid(order.orderId, { paymentIntentId: `pi_${order.orderCode}`, amountCents: 600 })
  await markPickedUp(order.orderId)
  return order
}

describe('leaving a review', () => {
  it('takes one from someone who collected their order', async () => {
    const order = await collectedOrder()

    await leaveReview(order.orderCode, { rating: 5, comment: 'Perfect' })

    const [saved] = await listReviews()
    expect(saved).toMatchObject({ rating: 5, comment: 'Perfect', orderCode: order.orderCode })
    expect(await hasReview(order.orderCode)).toBe(true)
  })

  it('accepts a lowercase code, the way it is typed', async () => {
    const order = await collectedOrder()

    await leaveReview(order.orderCode.toLowerCase(), { rating: 4, comment: null })

    expect(await listReviews()).toHaveLength(1)
  })

  // The order code is the only proof a review came from a customer.
  it('refuses an order that was never collected', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
    const order = await reserve({
      ...buyer,
      pickupSlotId: week.slotIds[0],
      items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 1 }],
    })

    await expect(leaveReview(order.orderCode, { rating: 5, comment: null })).rejects.toThrow(
      /picked it up/,
    )
    expect(await listReviews()).toHaveLength(0)
  })

  it('refuses a code that does not exist', async () => {
    await expect(leaveReview('ZZZZZZZZ', { rating: 5, comment: null })).rejects.toThrow(
      /No order with that code/,
    )
  })

  it('takes only one review per order', async () => {
    const order = await collectedOrder()
    await leaveReview(order.orderCode, { rating: 5, comment: 'First' })

    await expect(leaveReview(order.orderCode, { rating: 1, comment: 'Second' })).rejects.toThrow(
      /already been reviewed/,
    )

    const all = await listReviews()
    expect(all).toHaveLength(1)
    expect(all[0].comment).toBe('First')
  })
})

describe('what a review may say', () => {
  it('keeps the rating between one and five', () => {
    expect(reviewSchema.safeParse({ rating: 0, comment: '' }).success).toBe(false)
    expect(reviewSchema.safeParse({ rating: 6, comment: '' }).success).toBe(false)
    expect(reviewSchema.safeParse({ rating: 3, comment: '' }).success).toBe(true)
  })

  it('stores an empty comment as nothing', () => {
    expect(reviewSchema.parse({ rating: 3, comment: '   ' }).comment).toBeNull()
  })

  it('refuses an essay', () => {
    expect(reviewSchema.safeParse({ rating: 3, comment: 'x'.repeat(501) }).success).toBe(false)
  })
})

describe('asking for a flavour', () => {
  it('takes one without a name', async () => {
    await askFor({ name: null, text: 'Double chocolate' })

    const [saved] = await listRequests()
    expect(saved).toMatchObject({ name: null, text: 'Double chocolate' })
  })

  it('needs something to actually say', () => {
    expect(requestSchema.safeParse({ name: '', text: '   ' }).success).toBe(false)
    expect(requestSchema.safeParse({ name: '', text: 'Lemon' }).success).toBe(true)
  })

  it('stores an empty name as nothing', () => {
    expect(requestSchema.parse({ name: '  ', text: 'Lemon' }).name).toBeNull()
  })
})
