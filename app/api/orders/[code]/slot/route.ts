import { errorResponse, parseBody } from '@/lib/errors'
import { callerIp, checkLimit, tooMany } from '@/lib/limits'
import { moveToSlot } from '@/lib/orders'
import { moveSlotSchema } from '@/lib/validation'

// The order code is the whole guard here, the same as the page that shows the order.
// Moving a booking cannot take anyone's cookies or money, only the time they collect them.
export async function POST(request: Request, { params }: RouteContext<'/api/orders/[code]/slot'>) {
  const limit = await checkLimit('slot', callerIp(request))
  if (!limit.ok) return tooMany('Too many tries. Wait a few minutes.', limit.retryAfterSeconds)

  try {
    const { code } = await params
    const { slotId } = await parseBody(request, moveSlotSchema)
    const pickup = await moveToSlot(code.toUpperCase(), slotId)
    return Response.json({ ok: true, startsAt: pickup.startsAt, endsAt: pickup.endsAt })
  } catch (error) {
    return errorResponse(error, 'POST /api/orders/[code]/slot')
  }
}
