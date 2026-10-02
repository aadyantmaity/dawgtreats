import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { claimGuestOrders, syncAccount, updateAccount } from '@/lib/auth'
import { db } from '@/lib/db'
import { orders, users } from '@/lib/db/schema'
import { listOrdersForAccount, reserve } from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

const account = (email: string, uid = crypto.randomUUID()) =>
  syncAccount({ supabaseUid: uid, email, name: 'Alex' })

type Week = Awaited<ReturnType<typeof seedWeek>>

const orderIn = (week: Week, email: string) =>
  reserve({
    ...buyer,
    email,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 1 }],
  })

// Only one week takes orders at a time, so a test with two buyers shares one week.
async function guestOrder(email: string) {
  const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 20 })
  return orderIn(week, email)
}

describe('signing in', () => {
  it('creates an account the first time and reuses it after', async () => {
    const first = await account('alex@example.com')
    const again = await account('alex@example.com')

    expect(again.id).toBe(first.id)
    expect(await db.select().from(users)).toHaveLength(1)
  })

  it('keeps the same account when Google reports a changed email', async () => {
    const uid = crypto.randomUUID()
    const first = await syncAccount({ supabaseUid: uid, email: 'old@example.com', name: 'Alex' })
    const moved = await syncAccount({ supabaseUid: uid, email: 'new@example.com', name: 'Alex' })

    expect(moved.id).toBe(first.id)
    expect(moved.email).toBe('new@example.com')
  })
})

describe('claiming past guest orders', () => {
  it('claims orders placed with the same email', async () => {
    const order = await guestOrder('alex@example.com')
    const alex = await account('alex@example.com')

    expect(await claimGuestOrders(alex)).toBe(1)

    const [saved] = await db.select().from(orders).where(eq(orders.orderCode, order.orderCode))
    expect(saved.userId).toBe(alex.id)
  })

  it('ignores case, the way people type their address', async () => {
    await guestOrder('Alex@Example.com')
    const alex = await account('alex@example.com')

    expect(await claimGuestOrders(alex)).toBe(1)
  })

  it('never claims an order placed with a different email', async () => {
    const other = await guestOrder('someone-else@example.com')
    const alex = await account('alex@example.com')

    expect(await claimGuestOrders(alex)).toBe(0)

    const [saved] = await db.select().from(orders).where(eq(orders.orderCode, other.orderCode))
    expect(saved.userId).toBeNull()
  })

  it('never takes an order that already belongs to someone', async () => {
    const order = await guestOrder('alex@example.com')
    const alex = await account('alex@example.com')
    await claimGuestOrders(alex)

    const impostor = await syncAccount({
      supabaseUid: crypto.randomUUID(),
      email: 'alex@example.com'.toUpperCase(),
      name: 'Not Alex',
    })
    expect(await claimGuestOrders(impostor)).toBe(0)

    const [saved] = await db.select().from(orders).where(eq(orders.orderCode, order.orderCode))
    expect(saved.userId).toBe(alex.id)
  })
})

describe('what an account can see', () => {
  it('lists only its own orders', async () => {
    const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 20 })
    await orderIn(week, 'alex@example.com')
    await orderIn(week, 'someone-else@example.com')
    const alex = await account('alex@example.com')
    await claimGuestOrders(alex)

    const mine = await listOrdersForAccount(alex.id)

    expect(mine).toHaveLength(1)
  })

  it('saves details for the next checkout', async () => {
    const alex = await account('alex@example.com')

    const saved = await updateAccount(alex.id, { name: 'Alex Maity', phone: '2065550123' })

    expect(saved.name).toBe('Alex Maity')
    expect(saved.phone).toBe('2065550123')
  })
})
