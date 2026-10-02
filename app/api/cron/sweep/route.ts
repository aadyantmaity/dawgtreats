import { timingSafeEqual } from 'node:crypto'

import { errorResponse } from '@/lib/errors'
import { listStuckOrders, markPaid, releaseOrder } from '@/lib/orders'
import { getSession } from '@/lib/payments'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const offered = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!secret || !offered) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(offered)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Hourly backstop: without it, one missed webhook holds stock until the week ends.
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const stuck = await listStuckOrders()
    let paid = 0
    let released = 0
    let stillOpen = 0

    for (const order of stuck) {
      if (!order.stripeSessionId) {
        if (await releaseOrder(order.id)) released++
        continue
      }

      const session = await getSession(order.stripeSessionId)
      if (session.payment_status === 'paid') {
        const intent = session.payment_intent
        const paymentIntentId = typeof intent === 'string' ? intent : (intent?.id ?? session.id)
        if (await markPaid(order.id, { paymentIntentId, amountCents: session.amount_total ?? 0 })) paid++
      } else if (session.status === 'expired') {
        if (await releaseOrder(order.id)) released++
      } else {
        stillOpen++
      }
    }

    console.log('sweep', { checked: stuck.length, paid, released, stillOpen })
    return Response.json({ checked: stuck.length, paid, released, stillOpen })
  } catch (error) {
    return errorResponse(error, 'GET /api/cron/sweep')
  }
}
