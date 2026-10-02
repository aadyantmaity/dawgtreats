'use server'

import { revalidatePath } from 'next/cache'

import { currentAdmin } from '@/lib/auth'
import { markBackToPaid, markPickedUp, markReady } from '@/lib/orders'

// Every action re-checks the admin: a server action is a public endpoint, and the
// page having rendered once proves nothing about who is calling now.
async function asAdmin(run: () => Promise<boolean>): Promise<void> {
  if (!(await currentAdmin())) throw new Error('Not allowed')
  await run()
  revalidatePath('/pickup')
}

export async function readyAction(orderId: string): Promise<void> {
  await asAdmin(() => markReady(orderId))
}

export async function pickedUpAction(orderId: string): Promise<void> {
  await asAdmin(() => markPickedUp(orderId))
}

export async function undoAction(orderId: string): Promise<void> {
  await asAdmin(() => markBackToPaid(orderId))
}
