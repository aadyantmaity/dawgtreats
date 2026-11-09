export function formatCents(cents: number): string {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

// Uses string math, so no float ever touches the value.
export function parsePriceCents(value: string): number | null {
  const match = /^\s*\$?(\d{1,3})(?:\.(\d{1,2}))?\s*$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

// Every three cookies earn one more, free, in a flavor the baker picks. Nothing comes
// off the price: the order is the cookies it holds, and the free ones ride along.
export const DEAL_SIZE = 3

// Whether the offer stands. Off, three cookies earn nothing and no page mentions it.
export const DEAL_ON = true

// Collecting on a weekday evening costs this, once, however many cookies are in the order.
// It is a charge on the handover rather than on the cookies, so it earns nothing: a fee
// is not a cookie, and three cookies on a Tuesday earn the same one free cookie.
export const WEEKDAY_CENTS = 50

export type PricedLine = { name: string; quantity: number; unitPriceCents: number }

export type Priced = {
  totalCents: number
  listCents: number
  /** The weekday charge, already counted in totalCents. */
  feeCents: number
  /** Cookies the order earned on top of what it paid for. */
  freeCookies: number
}

export function priceOrder(lines: PricedLine[], weekday = false): Priced {
  const cookies = lines.reduce((sum, line) => sum + line.quantity, 0)
  const listCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  // An order with nothing in it is not an order, so an empty basket is never charged the
  // fee: the checkout refuses it anyway, and a lone 50c total would reach Stripe.
  const feeCents = weekday && cookies > 0 ? WEEKDAY_CENTS : 0

  return {
    totalCents: listCents + feeCents,
    listCents,
    feeCents,
    freeCookies: DEAL_ON ? Math.floor(cookies / DEAL_SIZE) : 0,
  }
}
