import 'server-only'

import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { batchItems, flavors, orderItems, orders, payments, pickupSlots, stripeEvents } from '@/lib/db/schema'
import { DomainError, reportIssue } from '@/lib/errors'
import { priceOrder } from '@/lib/money'
import { ORDER_CODE_ALPHABET, type CheckoutInput } from '@/lib/validation'
import { addDays, getOrderableWeek, ptToUtc } from '@/lib/weeks'

// Matches Stripe's minimum Checkout session expiry, so stock is released only once Stripe says the session is dead.
export const HOLD_MINUTES = 30

// The webhook arrives inside the hold. Five minutes after it ends, it is lost, not late.
const STUCK_MINUTES = HOLD_MINUTES + 5

// Four characters leaves about a million codes. A guessed code only shows cookies
// and a pickup time, never who ordered, and the lookup rate limit slows guessing.
const CODE_LENGTH = 4

// Two collisions in a row on a million codes means something other than luck is wrong,
// so the third refusal goes back to the customer instead of looping.
const CODE_ATTEMPTS = 3

function newOrderCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (byte) => ORDER_CODE_ALPHABET[byte % ORDER_CODE_ALPHABET.length]).join('')
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
  // Priced here and nowhere else: the browser sends flavors and counts, never money, so
  // the deal is applied to what the menu says today rather than to anything it was told.
  const { totalCents } = priceOrder(
    input.items.map((item) => ({
      name: byId.get(item.flavorId)!.name,
      quantity: item.quantity,
      unitPriceCents: byId.get(item.flavorId)!.priceCents,
    })),
  )

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
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
  /** Whether an account already holds it. */
  claimed: boolean
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
    claimed: found.order.userId !== null,
  }
}

// An order placed as a guest has no account behind it. Whoever is looking at it has its
// code, which is the same proof the page already accepts for changing a pickup time, so
// they may keep it — but only while nobody else has, which stops a shared code becoming a
// way to take someone's order away from them.
export async function claimOrder(orderCode: string, accountId: string): Promise<boolean> {
  const [kept] = await db
    .update(orders)
    .set({ userId: accountId })
    .where(and(eq(orders.orderCode, orderCode.toUpperCase()), sql`${orders.userId} is null`))
    .returning({ id: orders.id })
  return Boolean(kept)
}

// A Stripe retry of the same event does nothing: the second insert finds nothing new to write.
// Handling failed, so the mark has to go: Stripe retries the same event id, and a mark
// left behind would answer "already handled" and drop the payment on the floor.
export async function forgetEvent(stripeEventId: string): Promise<void> {
  await db.delete(stripeEvents).where(eq(stripeEvents.stripeEventId, stripeEventId))
}

export async function recordEvent(stripeEventId: string, type: string): Promise<boolean> {
  const written = await db
    .insert(stripeEvents)
    .values({ stripeEventId, type })
    .onConflictDoNothing({ target: stripeEvents.stripeEventId })
    .returning({ id: stripeEvents.id })
  return written.length > 0
}

// A Stripe retry lands on an order already paid, which is ordinary. An order that is
// gone is not: the money moved and nothing here is holding cookies for it.
export type PaidResult = 'paid' | 'already-paid' | 'no-longer-pending'

export async function markPaid(
  orderId: string,
  payment: { paymentIntentId: string; amountCents: number },
): Promise<PaidResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
      .returning({ id: orders.id, orderCode: orders.orderCode, totalCents: orders.totalCents })
    if (!order) {
      const [existing] = await tx
        .select({ status: orders.status, orderCode: orders.orderCode })
        .from(orders)
        .where(eq(orders.id, orderId))
      if (existing?.status === 'paid' || existing?.status === 'ready' || existing?.status === 'picked_up') {
        return 'already-paid'
      }
      // The money arrived and no cookies are held for it. The row outlives the alert,
      // so the payment is still findable when the email fails and the log scrolls away.
      if (existing) {
        await tx
          .insert(payments)
          .values({
            orderId,
            stripePaymentIntentId: payment.paymentIntentId,
            amountCents: payment.amountCents,
            status: 'stranded',
          })
          .onConflictDoNothing({ target: payments.stripePaymentIntentId })
      }
      reportIssue('paid_order_not_pending', {
        orderCode: existing?.orderCode ?? null,
        status: existing?.status ?? 'missing',
        paymentIntentId: payment.paymentIntentId,
        amountCents: payment.amountCents,
      })
      return 'no-longer-pending'
    }

    await tx
      .insert(payments)
      .values({
        orderId: order.id,
        stripePaymentIntentId: payment.paymentIntentId,
        amountCents: payment.amountCents,
        status: 'succeeded',
      })
      .onConflictDoNothing({ target: payments.stripePaymentIntentId })

    // The customer paid and the cookies are already theirs, so the order stays paid and a
    // person settles the difference. Silence here would hide a short payment for good.
    if (payment.amountCents !== order.totalCents) {
      reportIssue('paid_amount_mismatch', {
        orderCode: order.orderCode,
        owedCents: order.totalCents,
        paidCents: payment.amountCents,
        paymentIntentId: payment.paymentIntentId,
      })
    }

    console.log('order_paid', { orderCode: order.orderCode, amountCents: payment.amountCents })
    return 'paid'
  })
}

// Guarded the same way as markPaid: an order already paid or expired releases nothing twice.
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

// Only a paid order has a pickup to move, and only a time still ahead is worth moving to.
export async function listSlotsForOrder(orderCode: string) {
  const [order] = await db
    .select({ weekId: orders.weekId, pickupSlotId: orders.pickupSlotId, status: orders.status })
    .from(orders)
    .where(eq(orders.orderCode, orderCode))
  if (!order || (order.status !== 'paid' && order.status !== 'ready')) return []

  const rows = await db
    .select({
      id: pickupSlots.id,
      startsAt: pickupSlots.startsAt,
      endsAt: pickupSlots.endsAt,
      capacity: pickupSlots.capacity,
      bookedCount: pickupSlots.bookedCount,
    })
    .from(pickupSlots)
    .where(eq(pickupSlots.weekId, order.weekId))
    .orderBy(asc(pickupSlots.startsAt))

  const now = new Date()
  return rows
    .filter((slot) => slot.startsAt > now)
    .filter((slot) => slot.id === order.pickupSlotId || slot.bookedCount < slot.capacity)
    .map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      spotsLeft: slot.capacity - slot.bookedCount,
      current: slot.id === order.pickupSlotId,
    }))
}

// Moving a booking is not a refund: the cookies and the money stay where they are, and only
// the time changes. The old slot is given back in the same transaction that takes the new one.
export async function moveToSlot(orderCode: string, slotId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        weekId: orders.weekId,
        pickupSlotId: orders.pickupSlotId,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.orderCode, orderCode))
    if (!order) throw new DomainError('No order with that code', 404)
    if (order.status !== 'paid' && order.status !== 'ready') {
      throw new DomainError('Only an order waiting for pickup can change its time', 409)
    }
    if (order.pickupSlotId === slotId) {
      throw new DomainError('That is already your pickup time', 409)
    }

    const [wanted] = await tx
      .select({ startsAt: pickupSlots.startsAt, endsAt: pickupSlots.endsAt })
      .from(pickupSlots)
      .where(and(eq(pickupSlots.id, slotId), eq(pickupSlots.weekId, order.weekId)))
    if (!wanted) throw new DomainError('That pickup time is not on this week', 404)
    if (wanted.startsAt <= new Date()) {
      throw new DomainError('That pickup time has already passed', 409)
    }

    const taken = await tx
      .update(pickupSlots)
      .set({ bookedCount: sql`${pickupSlots.bookedCount} + 1` })
      .where(
        and(
          eq(pickupSlots.id, slotId),
          sql`${pickupSlots.bookedCount} < ${pickupSlots.capacity}`,
        ),
      )
      .returning({ id: pickupSlots.id })
    if (taken.length === 0) {
      throw new DomainError('That pickup time just filled up. Pick another one.', 409)
    }

    await tx
      .update(pickupSlots)
      .set({ bookedCount: sql`greatest(${pickupSlots.bookedCount} - 1, 0)` })
      .where(eq(pickupSlots.id, order.pickupSlotId))

    // A reminder names a time, so the one already sent is now wrong. Clearing the mark
    // lets the next run send the time the customer actually has.
    await tx
      .update(orders)
      .set({ pickupSlotId: slotId, reminderSentAt: null })
      .where(eq(orders.id, order.id))

    console.log('order_slot_moved', { orderCode, slotId })
    return { startsAt: wanted.startsAt, endsAt: wanted.endsAt }
  })
}

// Anything still pending well past its hold: the webhook never arrived, or never will.
export async function listStuckOrders(olderThanMinutes = STUCK_MINUTES) {
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

// Paid or ready orders picking up today, Pacific, that have not had a reminder sent.
// A day boundary rather than "from now" catches a slot already passed today, so a
// job that starts late still reminds everyone with cookies waiting.
export async function listRemindersDue(now = new Date()) {
  const todayPt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now)
  const startOfDay = ptToUtc(todayPt, '00:00')
  // Not 24 hours: the day a clock changes is 23 or 25, and both fall on a pickup Sunday.
  const endOfDay = ptToUtc(addDays(todayPt, 1), '00:00')

  return db
    .select({ id: orders.id, orderCode: orders.orderCode })
    .from(orders)
    .innerJoin(pickupSlots, eq(pickupSlots.id, orders.pickupSlotId))
    .where(
      and(
        inArray(orders.status, ['paid', 'ready']),
        sql`${orders.reminderSentAt} is null`,
        gte(pickupSlots.startsAt, startOfDay),
        lt(pickupSlots.startsAt, endOfDay),
      ),
    )
    .orderBy(asc(orders.createdAt))
}

// Claims the order before the mail goes out, so a crash between sending and this write
// can never repeat a reminder; the cost is that the same crash can occasionally miss one.
// Claiming before sending stops two runs mailing the same person. If the mail then
// fails, the claim goes back so the next run can try again instead of losing it.
export async function releaseReminder(orderId: string): Promise<void> {
  await db.update(orders).set({ reminderSentAt: null }).where(eq(orders.id, orderId))
}

export async function markReminderSent(orderId: string): Promise<boolean> {
  const [marked] = await db
    .update(orders)
    .set({ reminderSentAt: new Date() })
    .where(and(eq(orders.id, orderId), sql`${orders.reminderSentAt} is null`))
    .returning({ id: orders.id })
  return Boolean(marked)
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

// Pickup day only cares about orders that were actually paid for. Pending and
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
