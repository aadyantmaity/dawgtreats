import 'server-only'

import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { batchItems, flavors, orderItems, orders, payments, pickupSlots, stripeEvents } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'
import type { CheckoutInput } from '@/lib/validation'
import { getOrderableWeek } from '@/lib/weeks'

// Matches Stripe's minimum Checkout session expiry, so stock is released only once Stripe says the session is dead.
const HOLD_MINUTES = 30

// Crockford's alphabet: no I, L, O or U, so a code read aloud can't be mistyped.
// Four characters is about a million codes. Guessing one is slow against the lookup
// rate limit, and a guessed code shows cookies and a pickup time, never who ordered.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 4

function newOrderCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export type Reservation = {
  orderId: string
  orderCode: string
  totalCents: number
  reservedUntil: Date
  pickupStartsAt: Date
  lines: { name: string; quantity: number; unitPriceCents: number }[]
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
export async function reserve(input: CheckoutInput, accountId?: string | null): Promise<Reservation> {
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
            userId: accountId ?? null,
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
          orderId: order.id,
          orderCode: order.orderCode,
          totalCents,
          reservedUntil,
          pickupStartsAt: booked[0].startsAt,
          lines: input.items.map((item) => ({
            name: byId.get(item.flavorId)!.name,
            quantity: item.quantity,
            unitPriceCents: byId.get(item.flavorId)!.priceCents,
          })),
        }
      })
    } catch (error) {
      if (!isDuplicateCode(error)) throw error
    }
  }

  throw new DomainError('Could not start checkout. Please try again.', 409)
}

export async function attachSession(orderId: string, stripeSessionId: string): Promise<void> {
  await db.update(orders).set({ stripeSessionId }).where(eq(orders.id, orderId))
}

export async function getOrderByCode(orderCode: string) {
  const [order] = await db.select().from(orders).where(eq(orders.orderCode, orderCode))
  if (!order) return null

  const lines = await db
    .select({
      name: flavors.name,
      quantity: orderItems.quantity,
      unitPriceCents: orderItems.unitPriceCents,
    })
    .from(orderItems)
    .innerJoin(flavors, eq(flavors.id, orderItems.flavorId))
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(flavors.name))

  const [slot] = await db
    .select({ startsAt: pickupSlots.startsAt, endsAt: pickupSlots.endsAt })
    .from(pickupSlots)
    .where(eq(pickupSlots.id, order.pickupSlotId))

  return { order, lines, slot }
}

export type PublicOrder = {
  orderCode: string
  status: (typeof orders.$inferSelect)['status']
  totalCents: number
  pickupStartsAt: Date
  pickupEndsAt: Date
  lines: { name: string; quantity: number; unitPriceCents: number }[]
}

// The order code is the only thing guarding a guest's order, so this never returns
// contact details: knowing a code must not reveal who placed the order.
export async function getPublicOrder(orderCode: string): Promise<PublicOrder | null> {
  const found = await getOrderByCode(orderCode)
  if (!found) return null

  return {
    orderCode: found.order.orderCode,
    status: found.order.status,
    totalCents: found.order.totalCents,
    pickupStartsAt: found.slot.startsAt,
    pickupEndsAt: found.slot.endsAt,
    lines: found.lines,
  }
}

// Returns false for an event id already written, so a Stripe retry does nothing twice.
export async function recordEvent(stripeEventId: string, type: string): Promise<boolean> {
  const written = await db
    .insert(stripeEvents)
    .values({ stripeEventId, type })
    .onConflictDoNothing({ target: stripeEvents.stripeEventId })
    .returning({ id: stripeEvents.id })
  return written.length > 0
}

// Status-guarded, so only a pending order can become paid, however often this is called.
export async function markPaid(
  orderId: string,
  payment: { paymentIntentId: string; amountCents: number },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
      .returning({ id: orders.id, orderCode: orders.orderCode })
    if (!order) return false

    await tx
      .insert(payments)
      .values({
        orderId: order.id,
        stripePaymentIntentId: payment.paymentIntentId,
        amountCents: payment.amountCents,
        status: 'succeeded',
      })
      .onConflictDoNothing({ target: payments.stripePaymentIntentId })

    console.log('order_paid', { orderCode: order.orderCode, amountCents: payment.amountCents })
    return true
  })
}

// Puts the cookies and the slot back. Only a pending order releases anything.
export async function releaseOrder(orderId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({ status: 'expired' })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
      .returning({
        id: orders.id,
        orderCode: orders.orderCode,
        weekId: orders.weekId,
        pickupSlotId: orders.pickupSlotId,
      })
    if (!order) return false

    const lines = await tx
      .select({ flavorId: orderItems.flavorId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))

    for (const line of lines) {
      await tx
        .update(batchItems)
        .set({ quantityRemaining: sql`${batchItems.quantityRemaining} + ${line.quantity}` })
        .where(and(eq(batchItems.weekId, order.weekId), eq(batchItems.flavorId, line.flavorId)))
    }

    await tx
      .update(pickupSlots)
      .set({ bookedCount: sql`greatest(${pickupSlots.bookedCount} - 1, 0)` })
      .where(eq(pickupSlots.id, order.pickupSlotId))

    console.log('order_expired', { orderCode: order.orderCode })
    return true
  })
}

// Anything still pending well past its hold: the webhook never arrived, or never will.
export async function listStuckOrders(olderThanMinutes = 35) {
  return db
    .select({ id: orders.id, orderCode: orders.orderCode, stripeSessionId: orders.stripeSessionId })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'pending'),
        lt(orders.createdAt, new Date(Date.now() - olderThanMinutes * 60_000)),
      ),
    )
    .orderBy(asc(orders.createdAt))
}

export async function listOrdersForAccount(accountId: string) {
  return db
    .select({
      orderCode: orders.orderCode,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      pickupStartsAt: pickupSlots.startsAt,
      pickupEndsAt: pickupSlots.endsAt,
    })
    .from(orders)
    .innerJoin(pickupSlots, eq(pickupSlots.id, orders.pickupSlotId))
    .where(eq(orders.userId, accountId))
    .orderBy(desc(orders.createdAt))
}

// Pickup day only cares about orders that were actually paid for; pending and
// expired ones have no cookies behind them.
const COLLECTABLE = ['paid', 'ready', 'picked_up'] as const

export type CollectableStatus = (typeof COLLECTABLE)[number]

export type PickupOrder = {
  id: string
  orderCode: string
  status: CollectableStatus
  name: string
  phone: string | null
  totalCents: number
  cookieCount: number
  lines: { name: string; quantity: number }[]
}

export type PickupSlotGroup = {
  slotId: string
  startsAt: Date
  endsAt: Date
  orders: PickupOrder[]
}

export async function listPickupDay(weekId: string): Promise<PickupSlotGroup[]> {
  const slots = await db
    .select({ id: pickupSlots.id, startsAt: pickupSlots.startsAt, endsAt: pickupSlots.endsAt })
    .from(pickupSlots)
    .where(eq(pickupSlots.weekId, weekId))
    .orderBy(asc(pickupSlots.startsAt))

  const rows = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      status: orders.status,
      name: orders.name,
      phone: orders.phone,
      totalCents: orders.totalCents,
      pickupSlotId: orders.pickupSlotId,
      flavor: flavors.name,
      quantity: orderItems.quantity,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(flavors, eq(flavors.id, orderItems.flavorId))
    .where(and(eq(orders.weekId, weekId), inArray(orders.status, [...COLLECTABLE])))
    .orderBy(asc(orders.createdAt), asc(flavors.name))

  const byOrder = new Map<string, PickupOrder & { pickupSlotId: string }>()
  for (const row of rows) {
    let order = byOrder.get(row.id)
    if (!order) {
      order = {
        id: row.id,
        orderCode: row.orderCode,
        status: row.status as CollectableStatus,
        name: row.name,
        phone: row.phone,
        totalCents: row.totalCents,
        cookieCount: 0,
        lines: [],
        pickupSlotId: row.pickupSlotId,
      }
      byOrder.set(row.id, order)
    }
    order.lines.push({ name: row.flavor, quantity: row.quantity })
    order.cookieCount += row.quantity
  }

  const grouped = [...byOrder.values()]
  return slots.map((slot) => ({
    slotId: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    orders: grouped.filter((order) => order.pickupSlotId === slot.id),
  }))
}

// Guarded like every other transition: a double tap, or two phones open at once,
// cannot walk an order backwards or skip payment.
async function moveTo(
  orderId: string,
  to: 'ready' | 'picked_up',
  from: readonly ('paid' | 'ready')[],
): Promise<boolean> {
  const [moved] = await db
    .update(orders)
    .set({ status: to })
    .where(and(eq(orders.id, orderId), inArray(orders.status, [...from])))
    .returning({ orderCode: orders.orderCode })
  if (moved) console.log(`order_${to}`, { orderCode: moved.orderCode })
  return Boolean(moved)
}

export const markReady = (orderId: string) => moveTo(orderId, 'ready', ['paid'])

// Someone turning up before their bag is packed skips straight past ready.
export const markPickedUp = (orderId: string) => moveTo(orderId, 'picked_up', ['paid', 'ready'])

export async function markBackToPaid(orderId: string): Promise<boolean> {
  const [moved] = await db
    .update(orders)
    .set({ status: 'paid' })
    .where(and(eq(orders.id, orderId), inArray(orders.status, ['ready', 'picked_up'])))
    .returning({ orderCode: orders.orderCode })
  return Boolean(moved)
}
