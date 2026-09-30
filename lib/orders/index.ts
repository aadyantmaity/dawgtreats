import 'server-only'

import { and, eq, gte, inArray, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { batchItems, flavors, orderItems, orders, pickupSlots } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'
import type { CheckoutInput } from '@/lib/validation'
import { getOrderableWeek } from '@/lib/weeks'

// Matches Stripe's minimum Checkout session expiry, so stock is released only once Stripe says the session is dead.
const HOLD_MINUTES = 30

// Crockford's alphabet: no I, L, O or U, so a code read aloud can't be mistyped.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 8

function newOrderCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export type Reservation = {
  orderCode: string
  totalCents: number
  reservedUntil: Date
  pickupStartsAt: Date
}

function isDuplicateCode(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint_name' in error &&
    error.constraint_name === 'orders_order_code_unique'
  )
}

// One transaction of conditional updates: a row only moves if there is room, and any
// statement that changes nothing rolls the whole checkout back.
export async function reserve(input: CheckoutInput): Promise<Reservation> {
  const week = await getOrderableWeek()
  if (!week) throw new DomainError('Orders are closed right now', 409)

  const priced = await db
    .select({ id: flavors.id, name: flavors.name, priceCents: flavors.priceCents })
    .from(flavors)
    .where(
      and(
        inArray(
          flavors.id,
          input.items.map((item) => item.flavorId),
        ),
        eq(flavors.active, true),
      ),
    )
  if (priced.length !== input.items.length) {
    throw new DomainError('Something on the menu changed. Refresh and try again.', 409)
  }
  const byId = new Map(priced.map((flavor) => [flavor.id, flavor]))
  const totalCents = input.items.reduce(
    (sum, item) => sum + byId.get(item.flavorId)!.priceCents * item.quantity,
    0,
  )

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        for (const item of input.items) {
          const held = await tx
            .update(batchItems)
            .set({ quantityRemaining: sql`${batchItems.quantityRemaining} - ${item.quantity}` })
            .where(
              and(
                eq(batchItems.weekId, week.id),
                eq(batchItems.flavorId, item.flavorId),
                gte(batchItems.quantityRemaining, item.quantity),
              ),
            )
            .returning({ id: batchItems.id })

          if (held.length === 0) {
            const [row] = await tx
              .select({ remaining: batchItems.quantityRemaining })
              .from(batchItems)
              .where(and(eq(batchItems.weekId, week.id), eq(batchItems.flavorId, item.flavorId)))
            const name = byId.get(item.flavorId)!.name
            throw new DomainError(
              row && row.remaining > 0
                ? `Only ${row.remaining} ${name} left`
                : `${name} just sold out`,
              409,
            )
          }
        }

        const booked = await tx
          .update(pickupSlots)
          .set({ bookedCount: sql`${pickupSlots.bookedCount} + 1` })
          .where(
            and(
              eq(pickupSlots.id, input.pickupSlotId),
              eq(pickupSlots.weekId, week.id),
              sql`${pickupSlots.bookedCount} < ${pickupSlots.capacity}`,
            ),
          )
          .returning({ startsAt: pickupSlots.startsAt })

        if (booked.length === 0) {
          throw new DomainError('That pickup time just filled up. Pick another one.', 409)
        }

        const reservedUntil = new Date(Date.now() + HOLD_MINUTES * 60_000)
        const [order] = await tx
          .insert(orders)
          .values({
            orderCode: newOrderCode(),
            weekId: week.id,
            pickupSlotId: input.pickupSlotId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            totalCents,
            reservedUntil,
          })
          .returning({ id: orders.id, orderCode: orders.orderCode })

        await tx.insert(orderItems).values(
          input.items.map((item) => ({
            orderId: order.id,
            flavorId: item.flavorId,
            quantity: item.quantity,
            unitPriceCents: byId.get(item.flavorId)!.priceCents,
          })),
        )

        console.log('checkout_started', { orderCode: order.orderCode, totalCents, weekId: week.id })
        return {
          orderCode: order.orderCode,
          totalCents,
          reservedUntil,
          pickupStartsAt: booked[0].startsAt,
        }
      })
    } catch (error) {
      if (!isDuplicateCode(error)) throw error
    }
  }

  throw new DomainError('Could not start checkout. Please try again.', 409)
}
