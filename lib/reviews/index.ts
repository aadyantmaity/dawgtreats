import 'server-only'

import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { orders, requests, reviews } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'

export type NewReview = { rating: number; comment: string | null }

// The order code is the proof: only someone who collected an order can review it,
// and only once. Without that, anyone could rate a shop they never bought from.
export async function leaveReview(orderCode: string, input: NewReview): Promise<void> {
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.orderCode, orderCode.toUpperCase()))
  if (!order) throw new DomainError('No order with that code', 404)
  if (order.status !== 'picked_up') {
    throw new DomainError('You can review an order once you have picked it up')
  }

  const written = await db
    .insert(reviews)
    .values({ orderId: order.id, rating: input.rating, comment: input.comment })
    .onConflictDoNothing({ target: reviews.orderId })
    .returning({ id: reviews.id })
  if (written.length === 0) throw new DomainError('This order has already been reviewed')
}

export async function hasReview(orderCode: string): Promise<boolean> {
  const [found] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .innerJoin(orders, eq(orders.id, reviews.orderId))
    .where(eq(orders.orderCode, orderCode.toUpperCase()))
  return Boolean(found)
}

export async function listReviews() {
  return db
    .select({
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      orderCode: orders.orderCode,
      name: orders.name,
    })
    .from(reviews)
    .innerJoin(orders, eq(orders.id, reviews.orderId))
    .orderBy(desc(reviews.createdAt))
}

export async function askFor(input: { name: string | null; text: string }): Promise<void> {
  await db.insert(requests).values(input)
}

export async function listRequests() {
  return db.select().from(requests).orderBy(desc(requests.createdAt))
}
