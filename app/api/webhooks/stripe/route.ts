import { announcePaidOrder } from '@/lib/email'
import { errorResponse } from '@/lib/errors'
import { markPaid, recordEvent, releaseOrder } from '@/lib/orders'
import { verifyWebhook } from '@/lib/payments'

// Stripe is the source of truth for payment: the browser redirect never marks an order paid.
export async function POST(request: Request) {
  const body = await request.text()

  try {
    const event = verifyWebhook(body, request.headers.get('stripe-signature'))

    if (!(await recordEvent(event.id, event.type))) {
      return Response.json({ received: true, alreadyHandled: true })
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
      const session = event.data.object
      const orderId = session.metadata?.orderId
      if (!orderId) {
        console.error('[stripe webhook] session without an orderId', { eventId: event.id })
        return Response.json({ received: true, ignored: 'no orderId' })
      }

      if (event.type === 'checkout.session.completed') {
        const intent = session.payment_intent
        const paymentIntentId = typeof intent === 'string' ? intent : (intent?.id ?? session.id)
        const acted = await markPaid(orderId, {
          paymentIntentId,
          amountCents: session.amount_total ?? 0,
        })
        // Only the webhook that actually flipped the order sends mail, so a Stripe
        // retry cannot send the confirmation twice.
        const orderCode = session.metadata?.orderCode
        if (acted && orderCode) await announcePaidOrder(orderCode)
        return Response.json({ received: true, acted })
      }

      const acted = await releaseOrder(orderId)
      return Response.json({ received: true, acted })
    }

    return Response.json({ received: true, ignored: event.type })
  } catch (error) {
    return errorResponse(error, 'POST /api/webhooks/stripe')
  }
}
