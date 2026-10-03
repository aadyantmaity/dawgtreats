import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `revalidatePath` only works inside a Next.js request/render context, which this suite never has.
// Stubbing it lets the actions run to completion; it has no bearing on the admin gate under test.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// `currentAdmin()` calls `currentAccount()` internally, so mocking that export instead would miss
// the call; `currentAdmin` is the narrowest thing reachable from outside `lib/auth` to mock here.
// `asAdmin` in actions.ts, the code under test, still runs its own real check against the mock.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, currentAdmin: vi.fn() }
})

import { pickedUpAction, readyAction, undoAction } from '@/app/pickup/actions'
import { currentAdmin, setRole, syncAccount } from '@/lib/auth'
import { db } from '@/lib/db'
import { orders } from '@/lib/db/schema'
import { markPaid, markPickedUp, reserve } from '@/lib/orders'

import { buyer, resetDatabase, seedWeek } from './helpers'

beforeEach(resetDatabase)

const mockedCurrentAdmin = vi.mocked(currentAdmin)

async function paidOrder() {
  const week = await seedWeek({ stock: { Snickerdoodle: 20 }, capacity: 10 })
  const order = await reserve({
    ...buyer,
    pickupSlotId: week.slotIds[0],
    items: [{ flavorId: week.flavorIds.Snickerdoodle, quantity: 2 }],
  })
  await markPaid(order.orderId, {
    paymentIntentId: `pi_${order.orderCode}`,
    amountCents: order.totalCents,
  })
  return order
}

const statusOf = async (orderId: string) => {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId))
  return row.status
}

// A real customer account exists in the database; what is mocked is only the result of
// the role check `currentAdmin` would have made against it (null, same as a customer).
async function asCustomer() {
  await syncAccount({
    supabaseUid: crypto.randomUUID(),
    email: 'customer@example.com',
    name: 'Customer',
  })
  mockedCurrentAdmin.mockResolvedValue(null)
}

async function asAdminAccount() {
  const account = await syncAccount({
    supabaseUid: crypto.randomUUID(),
    email: 'admin@example.com',
    name: 'Admin',
  })
  const admin = await setRole(account.email, 'admin')
  mockedCurrentAdmin.mockResolvedValue(admin)
}

describe('pickup actions are gated on currentAdmin, not on the page having rendered', () => {
  describe('with no signed-in user', () => {
    beforeEach(() => mockedCurrentAdmin.mockResolvedValue(null))

    it('refuses readyAction and leaves the order unchanged', async () => {
      const order = await paidOrder()

      await expect(readyAction(order.orderId)).rejects.toThrow('Not allowed')

      expect(await statusOf(order.orderId)).toBe('paid')
    })

    it('refuses pickedUpAction and leaves the order unchanged', async () => {
      const order = await paidOrder()

      await expect(pickedUpAction(order.orderId)).rejects.toThrow('Not allowed')

      expect(await statusOf(order.orderId)).toBe('paid')
    })

    it('refuses undoAction and leaves the order unchanged', async () => {
      const order = await paidOrder()
      await markPickedUp(order.orderId)

      await expect(undoAction(order.orderId)).rejects.toThrow('Not allowed')

      expect(await statusOf(order.orderId)).toBe('picked_up')
    })
  })

  describe('with a signed-in customer', () => {
    it('refuses readyAction and leaves the order unchanged', async () => {
      const order = await paidOrder()
      await asCustomer()

      await expect(readyAction(order.orderId)).rejects.toThrow('Not allowed')

      expect(await statusOf(order.orderId)).toBe('paid')
    })

    it('refuses pickedUpAction and leaves the order unchanged', async () => {
      const order = await paidOrder()
      await asCustomer()

      await expect(pickedUpAction(order.orderId)).rejects.toThrow('Not allowed')

      expect(await statusOf(order.orderId)).toBe('paid')
    })

    it('refuses undoAction and leaves the order unchanged', async () => {
      const order = await paidOrder()
      await markPickedUp(order.orderId)
      await asCustomer()

      await expect(undoAction(order.orderId)).rejects.toThrow('Not allowed')

      expect(await statusOf(order.orderId)).toBe('picked_up')
    })
  })

  describe('with a signed-in admin', () => {
    it('lets readyAction change the order status', async () => {
      const order = await paidOrder()
      await asAdminAccount()

      await readyAction(order.orderId)

      expect(await statusOf(order.orderId)).toBe('ready')
    })

    it('lets pickedUpAction change the order status', async () => {
      const order = await paidOrder()
      await asAdminAccount()

      await pickedUpAction(order.orderId)

      expect(await statusOf(order.orderId)).toBe('picked_up')
    })

    it('lets undoAction change the order status back', async () => {
      const order = await paidOrder()
      await markPickedUp(order.orderId)
      await asAdminAccount()

      await undoAction(order.orderId)

      expect(await statusOf(order.orderId)).toBe('paid')
    })
  })
})
