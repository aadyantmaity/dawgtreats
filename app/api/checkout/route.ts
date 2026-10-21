import { currentAccount } from '@/lib/auth'
import { errorResponse, parseBody } from '@/lib/errors'
import { callerIp, checkLimit, tooMany } from '@/lib/limits'
import { attachSession, releaseOrder, reserve } from '@/lib/orders'
import { createCheckoutSession } from '@/lib/payments'
import { checkoutSchema } from '@/lib/validation'

export async function POST(request: Request) {
  // A reservation holds cookies for 30 minutes without payment, so an unlimited loop
  // could keep the week sold out for free. Real buyers never reach five in ten minutes.
  const limit = await checkLimit('checkout', callerIp(request))
  if (!limit.ok) {
    return tooMany('Too many checkout attempts. Wait a few minutes and try again.', limit.retryAfterSeconds)
  }

  try {
    const input = await parseBody(request, checkoutSchema)
    // Taken from the session, never the request body: a cart cannot claim someone else's account.
    const account = await currentAccount()
    const reservation = await reserve(input, account?.id ?? null)

    try {
      const session = await createCheckoutSession({
        id: reservation.orderId,
        orderCode: reservation.orderCode,
        email: input.email,
        lines: reservation.lines,
        pickupFeeCents: reservation.pickupFeeCents,
        origin: request.headers.get('origin'),
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
