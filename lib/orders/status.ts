// Client-safe, unlike lib/orders/index.ts: the order and account pages are client
// components. The pickup screen keeps its own map, where paid still means work to do.
export const ORDER_STATUS_TONE = {
  pending: 'neutral',
  paid: 'success',
  ready: 'success',
  picked_up: 'success',
  expired: 'warning',
} as const
