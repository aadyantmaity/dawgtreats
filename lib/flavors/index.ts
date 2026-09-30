import 'server-only'

import { asc, desc, eq } from 'drizzle-orm'
import type { z } from 'zod'

import { db } from '@/lib/db'
import { flavors } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'
import type { flavorSchema } from '@/lib/validation'

export type Flavor = typeof flavors.$inferSelect

export type FlavorInput = z.infer<typeof flavorSchema>

export async function listFlavors(): Promise<Flavor[]> {
  return db.select().from(flavors).orderBy(desc(flavors.active), asc(flavors.name))
}

export async function createFlavor(input: FlavorInput): Promise<Flavor> {
  const [flavor] = await db.insert(flavors).values(input).returning()
  return flavor
}

// Flavors are deactivated, never deleted: past order_items still point at them.
export async function updateFlavor(
  id: string,
  patch: Partial<FlavorInput> & { active?: boolean },
): Promise<Flavor> {
  const [flavor] = await db.update(flavors).set(patch).where(eq(flavors.id, id)).returning()
  if (!flavor) throw new DomainError('Flavor not found', 404)
  return flavor
}
