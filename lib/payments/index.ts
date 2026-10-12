import 'server-only'

import Stripe from 'stripe'

import { DomainError } from '@/lib/errors'

// Stripe refuses an expiry under 30 minutes away, so the session outlives the hold by a minute.
const SESSION_MINUTES = 31

export type CheckoutLine = { name: string; quantity: number; unitPriceCents: number }

// A missing key is my problem, not the customer's: they get a sentence they can act on,
// and the reason goes to the log where someone can fix it.
const PAYMENT_UNAVAILABLE = 'Payment is down for a moment. Nothing was charged. Try again shortly.'

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('stripe_misconfigured', { missing: 'STRIPE_SECRET_KEY' })
    throw new DomainError(PAYMENT_UNAVAILABLE, 503)
  }
  return new Stripe(key)
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
}

// Stripe sends the customer back here, so this allows only our own origins: a forged
// Origin header must not land them on someone else's page after paying.
export function returnOrigin(requested: string | null): string {
  if (!requested) return siteUrl()
  try {
    const url = new URL(requested)
    const allowed =
      url.origin === siteUrl() ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.vercel.app')
    return allowed ? url.origin : siteUrl()
  } catch {
    return siteUrl()
  }
}

export async function createCheckoutSession(order: {
  id: string
  orderCode: string
  email: string
  lines: CheckoutLine[]
  origin?: string | null
}): Promise<{ sessionId: string; url: string }> {
  const origin = returnOrigin(order.origin ?? null)

  const session = await client().checkout.sessions.create({
    mode: 'payment',
    // Cards only, whatever the Stripe dashboard turns on. A method that settles later
    // reports the checkout finished before the money arrives, and the cookies are gone.
    allowed_payment_method_types: ['card'],
    customer_email: order.email,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
    // The webhook needs to find the order again, whichever way the session ends.
    metadata: { orderId: order.id, orderCode: order.orderCode },
    line_items: order.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: line.unitPriceCents,
        product_data: { name: line.name },
      },
    })),
    success_url: `${origin}/order/${order.orderCode}?paid=1`,
    cancel_url: `${origin}/order/${order.orderCode}`,
  })

  if (!session.url) {
    console.error('stripe_session_without_url', { sessionId: session.id })
    throw new DomainError(PAYMENT_UNAVAILABLE, 502)
  }
  return { sessionId: session.id, url: session.url }
}

export function verifyWebhook(body: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('stripe_misconfigured', { missing: 'STRIPE_WEBHOOK_SECRET' })
    throw new DomainError(PAYMENT_UNAVAILABLE, 503)
  }
  if (!signature) throw new DomainError('Missing Stripe signature', 400)

  try {
    return client().webhooks.constructEvent(body, signature, secret)
  } catch {
    throw new DomainError('That webhook signature does not match', 400)
  }
}

// Used by the sweep when a webhook never arrived.
export async function getSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return client().checkout.sessions.retrieve(sessionId)
}
