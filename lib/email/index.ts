import 'server-only'

import { formatCents } from '@/lib/money'
import { getOrderByCode } from '@/lib/orders'
import { PICKUP_PLACE, formatPickupWeekend, formatPt } from '@/lib/weeks'

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
  headers?: Record<string, string>
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

// All three messages name the same pickup window, so they read it from one place.
function pickupDay(slot: { startsAt: Date }): string {
  return formatPt(slot.startsAt, { weekday: 'long', month: 'long', day: 'numeric' })
}

function pickupTime(slot: { startsAt: Date; endsAt: Date }): string {
  const from = formatPt(slot.startsAt, { hour: 'numeric', minute: '2-digit' })
  const to = formatPt(slot.endsAt, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return `${from}\u2013${to}`
}

function pickupWindow(slot: { startsAt: Date; endsAt: Date }): string {
  return `${pickupDay(slot)}, ${pickupTime(slot)}`
}

// A greeting uses the name someone is called, not the one they typed on a form.
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function orderLink(orderCode: string): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/order/${orderCode}`
}

function confirmationText(order: NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>): string {
  const { order: o, lines, slot } = order
  const items = lines.map((l) => `  ${l.quantity} x ${l.name}  ${formatCents(l.unitPriceCents * l.quantity)}`)

  return [
    `Thanks ${firstName(o.name)}, your cookies are paid for.`,
    '',
    `Order code: ${o.orderCode}`,
    '',
    ...items,
    `  Total: ${formatCents(o.totalCents)}`,
    '',
    'Pick up',
    pickupDay(slot),
    pickupTime(slot),
    PICKUP_PLACE,
    '',
    'Show this code when you arrive.',
    '',
    `Your order: ${orderLink(o.orderCode)}`,
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

  return [
    `${o.name} just ordered.`,
    '',
    `Code: ${o.orderCode}`,
    ...lines.map((l) => `  ${l.quantity} x ${l.name}`),
    `  Total: ${formatCents(o.totalCents)}`,
    '',
    `Picking up ${pickupWindow(slot)}.`,
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

// Stripe took the money and no order is holding cookies for it. Nothing automatic can
// put that right, because the cookies may already be sold, so a person decides.
export async function alertStrandedPayment(details: {
  orderCode: string | null
  status: string
  paymentIntentId: string
  amountCents: number
}): Promise<boolean> {
  try {
    const sent = await send({
      to: OWNER,
      subject: `Payment with no order to put it against (${details.orderCode ?? 'unknown'})`,
      text: [
        'Stripe reports this payment as taken, and the order is not waiting for it.',
        '',
        `Order code: ${details.orderCode ?? 'unknown'}`,
        `Order status: ${details.status}`,
        `Amount: ${formatCents(details.amountCents)}`,
        `Stripe payment: ${details.paymentIntentId}`,
        '',
        'Refund it in Stripe, or bake the cookies and mark the order paid by hand.',
      ].join('\n'),
    })
    console.error('stranded_payment', details)
    return sent !== null
  } catch (error) {
    console.error('stranded_payment_alert_failed', { ...details, error })
    return false
  }
}

// Both paths to a paid order end here, so neither can forget to tell someone.
export async function announcePaidOrder(orderCode: string): Promise<void> {
  await sendConfirmation(orderCode)
  await sendOwnerAlert(orderCode)
}

function reminderText(order: NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>): string {
  const { order: o, lines, slot } = order

  return [
    `Hey ${firstName(o.name)}, today's the day.`,
    '',
    pickupDay(slot),
    pickupTime(slot),
    PICKUP_PLACE,
    '',
    `Order code: ${o.orderCode}`,
    ...lines.map((l) => `  ${l.quantity} x ${l.name}`),
    '',
    'Show this code when you arrive.',
    '',
    `Your order: ${orderLink(o.orderCode)}`,
  ].join('\n')
}

// The caller already confirmed the order is paid or ready; this only guards against
// calling it on anything else. A failed send is logged and never thrown, so one bad
// address cannot stop the rest of the morning's reminders.
export async function sendReminder(orderCode: string): Promise<boolean> {
  try {
    const order = await getOrderByCode(orderCode)
    if (!order || (order.order.status !== 'paid' && order.order.status !== 'ready')) {
      console.error('reminder_failed', { orderCode, reason: 'not a paid order' })
      return false
    }

    const sent = await send({
      to: order.order.email,
      subject: `Dawg Treats pickup today - ${order.order.orderCode}`,
      text: reminderText(order),
    })

    console.log('reminder_sent', { orderCode, messageId: sent?.id ?? null })
    return sent !== null
  } catch (error) {
    console.error('reminder_failed', { orderCode, error })
    return false
  }
}

// Sent once, to someone who asked to be told. Never throws: one bad address must not
// stop the rest of the list.
export async function sendOpenNotice(
  email: string,
  week: { pickupWeekendStart: string },
  token: string,
): Promise<boolean> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const stop = `${site}/notify/unsubscribe?t=${encodeURIComponent(token)}`
  try {
    const sent = await send({
      to: email,
      subject: 'Dawg Treats is taking orders',
      // A mail client reads these to offer its own unsubscribe button, which stops
      // someone reporting the message as spam to get the same result.
      headers: {
        'List-Unsubscribe': `<${site}/api/notify/unsubscribe?t=${encodeURIComponent(token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      text: [
        'Ordering is open again.',
        '',
        `Pickup is ${formatPickupWeekend(week.pickupWeekendStart)}, at ${PICKUP_PLACE}.`,
        '',
        `Order here: ${site}`,
        '',
        'You asked to be told when a batch opened. This is the only reason I have your address.',
        `Stop these: ${stop}`,
      ].join('\n'),
    })
    console.log('open_notice_sent', { messageId: sent?.id ?? null })
    return sent !== null
  } catch (error) {
    console.error('open_notice_failed', { error })
    return false
  }
}
