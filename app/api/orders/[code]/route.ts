import { errorResponse } from '@/lib/errors'
import { getPublicOrder } from '@/lib/orders'

// Order codes are the only guard on a guest's order, so guessing has to be slow.
// Per-instance and in-memory for now; slice 11 replaces it with something shared.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const seen = new Map<string, { count: number; resetAt: number }>()

function rateLimited(request: Request): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const now = Date.now()
  const entry = seen.get(ip)

  if (!entry || entry.resetAt < now) {
    seen.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > MAX_PER_WINDOW
}

export async function GET(_request: Request, ctx: RouteContext<'/api/orders/[code]'>) {
  const request = _request
  if (rateLimited(request)) {
    return Response.json({ error: 'Too many lookups. Wait a minute and try again.' }, { status: 429 })
  }

  const { code } = await ctx.params
  try {
    const order = await getPublicOrder(code.trim().toUpperCase())
    if (!order) return Response.json({ error: 'No order with that code' }, { status: 404 })
    return Response.json(order)
  } catch (error) {
    return errorResponse(error, `GET /api/orders/${code}`)
  }
}
