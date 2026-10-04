import 'server-only'

import { formatCents } from '@/lib/money'
import { getOrderByCode } from '@/lib/orders'
import { PICKUP_PLACE, formatPt } from '@/lib/weeks'

const INBOX = 'orders@dawgtreats.shop'
const FROM = `Dawg Treats <${INBOX}>`
// Mail to the inbox forwards to a real person, so alerts need no extra address.
const OWNER = process.env.OWNER_EMAIL ?? INBOX

type Sent = { id: string }

// Resend's REST API is one POST call. The SDK would only wrap fetch.
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
    `Thanks ${o.name}. Your cookies are paid for.`,
    '',
    `Order code: ${o.orderCode}`,
    '',
    ...items,
    `  Total: ${formatCents(o.totalCents)}`,
    '',
    `Pick up ${day}, ${from}-${to}.`,
    PICKUP_PLACE + '.',
    'Show this code when you arrive.',
    '',
    `Track it: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/order/${o.orderCode}`,
    '',
    'Reply here if something comes up.',
    'All sales are final. Pickup only.',
  ].join('\n')
}

// The order is already paid, so a failed email is a logged problem to chase, never
// a reason to tell Stripe the payment failed. This never throws into the webhook.
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

function ownerText(order: NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>): string {
  const { order: o, lines, slot } = order
  const day = formatPt(slot.startsAt, { weekday: 'long', month: 'long', day: 'numeric' })
  const from = formatPt(slot.startsAt, { hour: 'numeric', minute: '2-digit' })
  const to = formatPt(slot.endsAt, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

  return [
    `${o.name} just ordered.`,
    '',
    `Code: ${o.orderCode}`,
    ...lines.map((l) => `  ${l.quantity} x ${l.name}`),
    `  Total: ${formatCents(o.totalCents)}`,
    '',
    `Picking up ${day}, ${from}-${to}.`,
    o.phone ? `Phone: ${o.phone}` : `Email: ${o.email}`,
  ].join('\n')
}

// A missed alert is an inconvenience, never a reason to fail a paid order.
async function sendOwnerAlert(orderCode: string): Promise<boolean> {
  try {
    const order = await getOrderByCode(orderCode)
    if (!order) return false

    const cookies = order.lines.reduce((sum, l) => sum + l.quantity, 0)
    const sent = await send({
      to: OWNER,
      subject: `New order ${order.order.orderCode} - ${cookies} cookies`,
      text: ownerText(order),
    })
    console.log('owner_alert_sent', { orderCode, messageId: sent?.id ?? null })
    return sent !== null
  } catch (error) {
    console.error('owner_alert_failed', { orderCode, error })
    return false
  }
}

// Both paths to a paid order end here, so neither can forget to tell someone.
export async function announcePaidOrder(orderCode: string): Promise<void> {
  await sendConfirmation(orderCode)
  await sendOwnerAlert(orderCode)
}
