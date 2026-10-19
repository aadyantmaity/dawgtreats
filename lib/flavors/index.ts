import 'server-only'

import { asc, desc, eq } from 'drizzle-orm'
import type { z } from 'zod'

import { db } from '@/lib/db'
import { flavors } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'
import type { flavorSchema } from '@/lib/validation'

export type Flavor = typeof flavors.$inferSelect

export type FlavorInput = z.infer<typeof flavorSchema>

// How the menu reads, everywhere it is read. The two tie-breaks only matter for rows
// that have never been moved, and they keep that order the same between two queries.
export const MENU_ORDER = [asc(flavors.sortOrder), asc(flavors.createdAt), asc(flavors.id)] as const

export async function listFlavors(): Promise<Flavor[]> {
  // The menu's own order, so the listing reads the way the menu does. The ones that are
  // off have no place on it, so they fall to the bottom.
  return db.select().from(flavors).orderBy(desc(flavors.active), ...MENU_ORDER)
}

export async function createFlavor(input: FlavorInput): Promise<Flavor> {
  // A new flavor joins the end rather than jumping the queue on the first letter of its
  // name. Moving it is a separate decision, so flavor:move makes it.
  const [last] = await db
    .select({ sortOrder: flavors.sortOrder })
    .from(flavors)
    .orderBy(desc(flavors.sortOrder))
    .limit(1)
  const [flavor] = await db
    .insert(flavors)
    .values({ ...input, sortOrder: (last?.sortOrder ?? 0) + 1 })
    .returning()
  return flavor
}

// Moves one flavor to a place on the menu, counting from 1, and closes the gap it left.
// Every flavor between the two places shifts by one; nothing else moves.
export async function moveFlavor(id: string, position: number): Promise<Flavor[]> {
  const ordered = await db.select().from(flavors).orderBy(...MENU_ORDER)
  const from = ordered.findIndex((flavor) => flavor.id === id)
  if (from < 0) throw new DomainError('Flavor not found', 404)
  if (position < 1 || position > ordered.length) {
    throw new DomainError(`There are ${ordered.length} flavors, so pick a place from 1 to ${ordered.length}.`, 400)
  }

  const to = position - 1
  const moved = ordered.splice(from, 1)[0]
  ordered.splice(to, 0, moved)

  // One statement, so the menu is never read halfway through a renumber.
  await db.transaction(async (tx) => {
    for (const [index, flavor] of ordered.entries()) {
      if (flavor.sortOrder === index + 1) continue
      await tx.update(flavors).set({ sortOrder: index + 1 }).where(eq(flavors.id, flavor.id))
    }
  })

  return ordered.map((flavor, index) => ({ ...flavor, sortOrder: index + 1 }))
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
