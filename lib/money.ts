export function formatCents(cents: number): string {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

// Uses string math, so no float ever touches the value.
export function parsePriceCents(value: string): number | null {
  const match = /^\s*\$?(\d{1,3})(?:\.(\d{1,2}))?\s*$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

// Any three cookies cost this, whatever they are, and the deal repeats.
export const DEAL_SIZE = 3
export const DEAL_CENTS = 400

export type PricedLine = { name: string; quantity: number; unitPriceCents: number }

export type Priced = {
  totalCents: number
  listCents: number
  savedCents: number
  sets: number
  /** What the sets did not take, grouped as it arrived. */
  rest: PricedLine[]
}

// The dearest cookies go into the sets, because a set costs the same whatever is in it:
// anything else would quietly charge more for the same basket. A set also never costs more
// than the cookies it holds, so a cheaper menu can never turn the deal into a penalty.
export function priceOrder(lines: PricedLine[]): Priced {
  const cookies = lines.flatMap((line) =>
    Array.from({ length: line.quantity }, () => line),
  )
  cookies.sort((a, b) => b.unitPriceCents - a.unitPriceCents)

  const sets = Math.floor(cookies.length / DEAL_SIZE)
  const taken = cookies.slice(0, sets * DEAL_SIZE)
  const left = cookies.slice(sets * DEAL_SIZE)

  const listOf = (of: PricedLine[]) => of.reduce((sum, one) => sum + one.unitPriceCents, 0)
  const setsCents = Math.min(sets * DEAL_CENTS, listOf(taken))
  const totalCents = setsCents + listOf(left)
  const listCents = listOf(cookies)

  const rest: PricedLine[] = []
  for (const cookie of left) {
    const already = rest.find((line) => line.name === cookie.name)
    if (already) already.quantity += 1
    else rest.push({ ...cookie, quantity: 1 })
  }

  return { totalCents, listCents, savedCents: listCents - totalCents, sets, rest }
}
