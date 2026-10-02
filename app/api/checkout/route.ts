import { errorResponse, parseBody } from '@/lib/errors'
import { attachSession, releaseOrder, reserve } from '@/lib/orders'
import { createCheckoutSession } from '@/lib/payments'
import { checkoutSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, checkoutSchema)
    const reservation = await reserve(input)

    try {
      const session = await createCheckoutSession({
        id: reservation.orderId,
        orderCode: reservation.orderCode,
        email: input.email,
        lines: reservation.lines,
      })
      await attachSession(reservation.orderId, session.sessionId)
      return Response.json({ orderCode: reservation.orderCode, url: session.url }, { status: 201 })
    } catch (error) {
      // Stripe is down or misconfigured: give the cookies back now rather than hold them for 30 minutes.
      await releaseOrder(reservation.orderId)
      throw error
    }
  } catch (error) {
    return errorResponse(error, 'POST /api/checkout')
  }
}
