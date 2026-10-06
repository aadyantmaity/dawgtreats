import { authorizedCron } from '@/lib/auth'
import { announcePaidOrder } from '@/lib/email'
import { errorResponse } from '@/lib/errors'
import { listStuckOrders, markPaid, releaseOrder } from '@/lib/orders'
import { getSession } from '@/lib/payments'

function isMissingSession(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'resource_missing'
  )
}

// Hourly backstop: without it, one missed webhook holds stock until the week ends.
export async function GET(request: Request) {
  if (!authorizedCron(request)) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const stuck = await listStuckOrders()
    let paid = 0
    let released = 0
    let stillOpen = 0
    let failed = 0

    for (const order of stuck) {
      // One unreadable session must not stop the rest: the whole point of the sweep is
      // that stock gets released even when something upstream is broken.
      try {
        if (!order.stripeSessionId) {
          if (await releaseOrder(order.id)) released++
          continue
        }

        const session = await getSession(order.stripeSessionId)
        if (session.payment_status === 'paid') {
          const intent = session.payment_intent
          const paymentIntentId = typeof intent === 'string' ? intent : (intent?.id ?? session.id)
          const result = await markPaid(order.id, {
            paymentIntentId,
            amountCents: session.amount_total ?? 0,
          })
          if (result === 'paid') {
            paid++
            // The webhook never arrived, so this is the only chance to tell anyone.
            await announcePaidOrder(order.orderCode)
          }
        } else if (session.status === 'expired') {
          if (await releaseOrder(order.id)) released++
        } else {
          stillOpen++
        }
      } catch (error) {
        // A session Stripe cannot find is gone for good, so the cookies go back. Anything
        // else is left alone: an order is only released when we know it was not paid.
        if (isMissingSession(error)) {
          console.warn('sweep_session_missing', { orderCode: order.orderCode })
          if (await releaseOrder(order.id)) released++
        } else {
          failed++
          console.error('sweep_order_failed', { orderCode: order.orderCode, error })
        }
      }
    }

    console.log('sweep', { checked: stuck.length, paid, released, stillOpen, failed })
    return Response.json({ checked: stuck.length, paid, released, stillOpen, failed })
  } catch (error) {
    return errorResponse(error, 'GET /api/cron/sweep')
  }
}
