import type Stripe from 'stripe'

import { alertStrandedPayment, announcePaidOrder } from '@/lib/email'
import { errorResponse } from '@/lib/errors'
import { forgetEvent, markPaid, recordEvent, releaseOrder } from '@/lib/orders'
import { verifyWebhook } from '@/lib/payments'

const SETTLED = new Set<Stripe.Event['type']>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
])

// A card settles while the customer is still on the page, so the completed session is
// already paid. A method that takes days reports the same event unpaid and pays later.
async function recordPayment(session: Stripe.Checkout.Session, orderId: string) {
  const intent = session.payment_intent
  const paymentIntentId = typeof intent === 'string' ? intent : (intent?.id ?? session.id)
  const amountCents = session.amount_total ?? 0
  const result = await markPaid(orderId, { paymentIntentId, amountCents })

  // Only the call that flipped the order sends mail, so a Stripe retry cannot send the
  // confirmation twice.
  if (result === 'paid' && session.metadata?.orderCode) {
    await announcePaidOrder(session.metadata.orderCode)
  }
  if (result === 'no-longer-pending') {
    await alertStrandedPayment({
      orderCode: session.metadata?.orderCode ?? null,
      status: 'not pending',
      paymentIntentId,
      amountCents,
    })
  }
  return result
}

// Stripe is the source of truth for payment: the browser redirect never marks an order paid.
export async function POST(request: Request) {
  const body = await request.text()

  try {
    const event = verifyWebhook(body, request.headers.get('stripe-signature'))

    // The mark goes down first so two deliveries of one event cannot both be handled, and
    // comes back up if the handling fails, so Stripe's retry is not answered with silence.
    if (!(await recordEvent(event.id, event.type))) {
      return Response.json({ received: true, alreadyHandled: true })
    }

    try {
      return await handle(event)
    } catch (error) {
      await forgetEvent(event.id)
      throw error
    }
  } catch (error) {
    return errorResponse(error, 'POST /api/webhooks/stripe')
  }
}

async function handle(event: Stripe.Event) {
    const ends =
      SETTLED.has(event.type) ||
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'

    if (!ends) return Response.json({ received: true, ignored: event.type })

    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId
    if (!orderId) {
      console.error('[stripe webhook] session without an orderId', { eventId: event.id })
      return Response.json({ received: true, ignored: 'no orderId' })
    }

    if (SETTLED.has(event.type)) {
      // The cookies are not released until the money is actually taken. A session that
      // finished unpaid comes back later as succeeded or failed.
      if (session.payment_status !== 'paid') {
        console.log('checkout_awaiting_payment', {
          orderCode: session.metadata?.orderCode ?? null,
          paymentStatus: session.payment_status,
        })
        return Response.json({ received: true, awaitingPayment: true })
      }
      return Response.json({ received: true, result: await recordPayment(session, orderId) })
    }

    const acted = await releaseOrder(orderId)
    return Response.json({ received: true, acted })
}
