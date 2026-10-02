import 'server-only'

import { formatCents } from '@/lib/money'
import { getOrderByCode } from '@/lib/orders'
import { formatPt } from '@/lib/weeks'

const FROM = 'Dawg Treats <orders@dawgtreats.shop>'

type Sent = { id: string }

// Resend's REST API is one POST; the SDK would only wrap fetch.
async function send(message: {
  to: string
  subject: string
  text: string
}): Promise<Sent | null> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('email_skipped', { reason: 'no RESEND_API_KEY', to: message.to })
    return null
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, ...message }),
  })

  if (!response.ok) {
    throw new Error(`Resend refused the message (${response.status}): ${await response.text()}`)
  }
  return (await response.json()) as Sent
}

function confirmationText(order: NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>): string {
  const { order: o, lines, slot } = order
  const day = formatPt(slot.startsAt, { weekday: 'long', month: 'long', day: 'numeric' })
  const from = formatPt(slot.startsAt, { hour: 'numeric', minute: '2-digit' })
  const to = formatPt(slot.endsAt, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const items = lines.map((l) => `  ${l.quantity} x ${l.name}  ${formatCents(l.unitPriceCents * l.quantity)}`)

  return [
    `Thanks ${o.name}! Your cookies are paid for.`,
    '',
    `Order code: ${o.orderCode}`,
    '',
    ...items,
    `  Total: ${formatCents(o.totalCents)}`,
    '',
    `Pick up ${day}, ${from}-${to}.`,
    'Show this code when you arrive.',
    '',
    `Track it: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/order/${o.orderCode}`,
    '',
    'Reply to this email if something comes up.',
    'All sales are final. Pickup only.',
  ].join('\n')
}

// Never throws into the webhook: the order is already paid, so a failed email is
// a logged problem to chase, not a reason to tell Stripe the payment failed.
export async function sendConfirmation(orderCode: string): Promise<boolean> {
  try {
    const order = await getOrderByCode(orderCode)
    if (!order) {
      console.error('email_failed', { orderCode, reason: 'order not found' })
      return false
    }

    const sent = await send({
      to: order.order.email,
      subject: `Dawg Treats order ${order.order.orderCode}`,
      text: confirmationText(order),
    })

    console.log('email_sent', { orderCode, messageId: sent?.id ?? null })
    return sent !== null
  } catch (error) {
    console.error('email_failed', { orderCode, error })
    return false
  }
}
