import { errorResponse } from '@/lib/errors'
import { callerIp, checkLimit, tooMany } from '@/lib/limits'
import { getPublicOrder } from '@/lib/orders'

// Order codes are the only guard on a guest's order, so guessing has to be slow.
export async function GET(request: Request, ctx: RouteContext<'/api/orders/[code]'>) {
  const { code } = await ctx.params

  const limit = await checkLimit('lookup', callerIp(request))
  if (!limit.ok) {
    return tooMany('Too many lookups. Wait a minute and try again.', limit.retryAfterSeconds)
  }

  try {
    const order = await getPublicOrder(code.trim().toUpperCase())
    if (!order) return Response.json({ error: 'No order with that code' }, { status: 404 })
    return Response.json(order)
  } catch (error) {
    return errorResponse(error, `GET /api/orders/${code}`)
  }
}
