import 'server-only'

import { reportIssue } from '@/lib/errors'
import type { MenuItem } from '@/lib/inventory'
import { formatCents } from '@/lib/money'
import { getOrderByCode } from '@/lib/orders'
import { EMAIL_BACKDROP, PALETTE } from '@/lib/palette'
import { PICKUP_PLACE, formatClosesAt, formatPt } from '@/lib/weeks'

const INBOX = 'orders@dawgtreats.shop'
const FROM = `Dawg Treats <${INBOX}>`
// Mail to the inbox forwards to a real person, so alerts need no extra address.
const OWNER = process.env.OWNER_EMAIL ?? INBOX

// The sentence that sets what a customer is owed. Every message has to say the same
// thing, so a change in the policy is a change in one place.
const TERMS = 'Pickup only. No refunds or cancellations.'

type Sent = { id: string }

// Resend's REST API is one POST call. The SDK would only wrap fetch.
async function send(message: {
  to: string
  subject: string
  text: string
  html?: string
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

// "12:00 PM-12:30 PM PDT" breaks across two lines on a narrow phone, and it breaks after
// the dash, which reads as two times. Both ends share a meridiem, so one of them goes.
function pickupTimeTight(slot: { startsAt: Date; endsAt: Date }): string {
  const from = formatPt(slot.startsAt, { hour: 'numeric', minute: '2-digit' })
  const to = formatPt(slot.endsAt, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  const meridiem = from.slice(-2)
  return to.startsWith(from.replace(` ${meridiem}`, '')) || !to.includes(meridiem)
    ? `${from}\u2013${to}`
    : `${from.replace(` ${meridiem}`, '')}\u2013${to}`
}

function pickupWindow(slot: { startsAt: Date; endsAt: Date }): string {
  return `${pickupDay(slot)}, ${pickupTime(slot)}`
}

// Mail clients drop a stylesheet and most of modern CSS, so every rule here is inline
// and the layout is tables. A flavor name can hold an ampersand, so nothing reaches the
// markup unescaped.
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
// Gmail drops @font-face, and a picture of the name only appears for someone whose
// client fetches remote images, which many will not. So the name is text, and the
// fallback after it is what most people actually read.
const DISPLAY = "'Shantell Sans',Georgia,'Times New Roman',serif"
const SHANTELL_WOFF2 =
  'https://fonts.gstatic.com/s/shantellsans/v13/FeUaS0pCoLIo-lcdY7kjvNoQqWVWB0qWpl29ajppTuUTu_kJKmHesPOL-maYi4xZeHCNQ09eBlmv2QcUzJ39-rAISYSiTFixwv0TijRMagQ.woff2'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// The preheader is what a phone shows under the subject. Without one it shows the first
// words of the markup instead.
function shell(parts: { title: string; preheader: string; body: string }): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(parts.title)}</title>
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
@font-face{font-family:'Shantell Sans';font-style:normal;font-weight:600;font-display:swap;src:url(${SHANTELL_WOFF2}) format('woff2')}
/* The paper is already a warm off-white and the bar is already dark. A client that
   inverts both gets a negative of a design that has its own dark part. */
:root{color-scheme:light;supported-color-schemes:light}
</style>
</head>
<body bgcolor="${EMAIL_BACKDROP}" style="margin:0;padding:0;background-color:${EMAIL_BACKDROP};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(parts.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${EMAIL_BACKDROP}" style="background-color:${EMAIL_BACKDROP};padding:24px 12px;">
<tr><td align="center" bgcolor="${EMAIL_BACKDROP}" style="background-color:${EMAIL_BACKDROP};">
<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${PALETTE.white}" style="width:100%;max-width:560px;background-color:${PALETTE.white};border:1px solid ${PALETTE.linen};border-radius:18px;overflow:hidden;font-family:${SANS};">
${parts.body}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`
}

// The code is what someone holds up at the table, so it is the one thing that is big.
function codeBlock(label: string, orderCode: string): string {
  return `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:16px 22px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${PALETTE.ivory}" style="background-color:${PALETTE.ivory};border-radius:14px;">
    <tr><td align="center" bgcolor="${PALETTE.ivory}" style="background-color:${PALETTE.ivory};border-radius:14px;padding:18px;">
      <div style="font-family:${SANS};font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${PALETTE.pebble};">${escapeHtml(label)}</div>
      <div style="font-family:${DISPLAY};font-size:42px;letter-spacing:.1em;color:${PALETTE.ink};padding-top:4px;">${escapeHtml(orderCode)}</div>
    </td></tr>
  </table>
</td></tr>`
}

function linkButton(href: string, label: string): string {
  return `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:16px 22px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
    <td align="center" bgcolor="${PALETTE.ink}" style="border-radius:999px;">
      <a href="${escapeHtml(href)}" style="display:block;padding:13px 20px;font-family:${SANS};font-size:16px;font-weight:600;color:${PALETTE.ivory};text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr></table>
</td></tr>`
}

// Each fact on its own line: these are read at a door, not in a chair.
function footerLines(lines: string[]): string {
  return `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:16px 22px 22px;font-family:${SANS};font-size:13px;line-height:1.6;color:${PALETTE.pebble};">
  ${lines.map((line) => escapeHtml(line)).join('<br>')}
</td></tr>`
}

// A greeting uses the name someone is called, not the one they typed on a form.
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

// Every link in every message starts here. A trailing slash on the env var would
// otherwise double the one that follows it.
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
}

function orderLink(orderCode: string): string {
  return `${siteUrl()}/order/${orderCode}`
}

function confirmationText(order: NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>): string {
  const { order: o, lines, slot } = order
  const items = lines.map((l) => `  ${l.quantity} x ${l.name}  ${formatCents(l.unitPriceCents * l.quantity)}`)
  if (o.pickupFeeCents > 0) items.push(`  Weekday pickup  +${formatCents(o.pickupFeeCents)}`)
  if (o.freeCookieCount > 0) items.push(`  ${freeCookieLine(o.freeCookieCount)}`)

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
    'Need another time? Change it on your order page.',
    '',
    `Your order: ${orderLink(o.orderCode)}`,
    '',
    'Reply here if something comes up.',
    TERMS,
  ].join('\n')
}

// Charged on top of the cookies, so it is a row of its own rather than folded into one of
// them: the items have to add up to the total a reader can see.
function feeRow(feeCents: number): string {
  if (feeCents === 0) return ''
  return `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:8px 0;font-size:15px;color:${PALETTE.taupe};">Weekday pickup +${formatCents(feeCents)}</td></tr>`
}

// Free cookies cost nothing, so they are never a money line: the receipt says what is in
// the bag beyond what was paid for, and the total stays the total.
export function freeCookieLine(count: number): string {
  return count === 1
    ? 'Free cookie - a surprise flavor, in the bag'
    : `${count} free cookies - surprise flavors, in the bag`
}

function confirmationHtml(order: NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>): string {
  const { order: o, lines, slot } = order
  const items = lines
    .map(
      (l) => `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:8px 0;border-bottom:1px solid ${PALETTE.linen};font-size:16px;color:${PALETTE.ink};">
      ${l.quantity} &times; ${escapeHtml(l.name)}
      <div style="font-size:15px;color:${PALETTE.taupe};padding-top:2px;">${formatCents(l.unitPriceCents * l.quantity)}</div>
    </td></tr>`,
    )
    .join('')

  return shell({
    title: `Dawg Treats order ${o.orderCode}`,
    preheader: `${o.orderCode} · pick up ${pickupDay(slot)}`,
    body: `
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:22px 22px 0;font-size:16px;line-height:1.5;color:${PALETTE.ink};">Thanks ${escapeHtml(firstName(o.name))}, your cookies are paid for.</td></tr>
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:14px 22px 0;">
  <div style="font-family:${DISPLAY};font-size:22px;line-height:1.35;color:${PALETTE.ink};">${escapeHtml(pickupDay(slot))}</div>
  <div style="font-family:${DISPLAY};font-size:22px;line-height:1.35;color:${PALETTE.ink};">${escapeHtml(pickupTimeTight(slot))}</div>
  <div style="font-size:16px;color:${PALETTE.taupe};padding-top:4px;">${escapeHtml(PICKUP_PLACE)}</div>
  <div style="font-size:15px;color:${PALETTE.pebble};padding-top:8px;">Need another time? Change it on your order page.</div>
</td></tr>
${codeBlock('Show this at pickup', o.orderCode)}
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:18px 22px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    ${items}
    ${feeRow(o.pickupFeeCents)}
    ${o.freeCookieCount > 0 ? `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:8px 0;font-size:15px;color:${PALETTE.sage700};">${escapeHtml(freeCookieLine(o.freeCookieCount))}</td></tr>` : ''}
    <tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:10px 0;font-size:16px;font-weight:600;color:${PALETTE.ink};">Total ${formatCents(o.totalCents)}</td></tr>
  </table>
</td></tr>
${linkButton(orderLink(o.orderCode), 'Your order')}
${footerLines([
  TERMS,
  '',
  'Reply here if something comes up.',
])}`,
  })
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
      html: confirmationHtml(order),
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
  // Reported before the send, so the worst outcome on the site is on the record even
  // when Resend is the thing that is down.
  reportIssue('stranded_payment', details)
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
    return sent !== null
  } catch (error) {
    reportIssue('stranded_payment_alert_failed', { ...details, error })
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

function reminderHtml(order: NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>): string {
  const { order: o, lines, slot } = order
  const items = lines.map((l) => `${l.quantity} &times; ${escapeHtml(l.name)}`).join('<br>')

  return shell({
    title: `Dawg Treats pickup today ${o.orderCode}`,
    preheader: `${pickupTime(slot)} · ${o.orderCode}`,
    body: `
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:22px 22px 0;">
  <div style="font-family:${DISPLAY};font-size:22px;line-height:1.35;color:${PALETTE.ink};">Today</div>
  <div style="font-family:${DISPLAY};font-size:22px;line-height:1.35;color:${PALETTE.ink};">${escapeHtml(pickupTimeTight(slot))}</div>
  <div style="font-size:16px;color:${PALETTE.taupe};padding-top:6px;">${escapeHtml(PICKUP_PLACE)}</div>
</td></tr>
${codeBlock('Show this at the table', o.orderCode)}
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:16px 22px 0;font-size:16px;line-height:1.5;color:${PALETTE.taupe};">${items}</td></tr>
${linkButton(orderLink(o.orderCode), 'Your order')}
${footerLines(['Come any time in the window.', TERMS])}`,
  })
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
      html: reminderHtml(order),
    })

    console.log('reminder_sent', { orderCode, messageId: sent?.id ?? null })
    return sent !== null
  } catch (error) {
    console.error('reminder_failed', { orderCode, error })
    return false
  }
}

type NotifiableWeek = { pickupWeekendStart: string; ordersCloseAt: Date }
export type OpenNoticeItem = Pick<MenuItem, 'name' | 'priceCents' | 'imageUrl'>

// A picture in an email needs a whole address, and the menu stores a path.
function absolute(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${siteUrl()}/${path.replace(/^\//, '')}`
}

// The price sits under the name, not across from it: a long name and a price in one row
// are squeezed together on a phone, where most of these are read.
function menuRow(item: OpenNoticeItem, last: boolean, note = ''): string {
  const photo = item.imageUrl
    ? `<img src="${escapeHtml(absolute(item.imageUrl))}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:12px;border:0;object-fit:cover;">`
    : ''
  return `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:12px 0;${last ? '' : `border-bottom:1px solid ${PALETTE.linen};`}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
    ${photo ? `<td width="64" valign="middle" bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding-right:14px;">${photo}</td>` : ''}
    <td valign="middle" bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};font-family:${SANS};font-size:16px;line-height:1.35;color:${PALETTE.ink};">
      ${escapeHtml(item.name)}
      <div style="font-size:15px;color:${PALETTE.taupe};padding-top:2px;">${formatCents(item.priceCents)}${note ? ` &middot; ${escapeHtml(note)}` : ''}</div>
    </td>
  </tr></table>
</td></tr>`
}

function openNoticeHtml(week: NotifiableWeek, menu: OpenNoticeItem[], stop: string, note?: string): string {
  const site = siteUrl()
  return shell({
    title: 'New menu this week',
    preheader: note ?? `Orders close ${formatClosesAt(week.ordersCloseAt)}`,
    body: `
${note ? `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:18px 22px 0;font-family:${SANS};font-size:15px;line-height:1.45;color:${PALETTE.taupe};">${escapeHtml(note)}</td></tr>` : ''}
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:18px 22px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${menu.map((item, index) => menuRow(item, index === menu.length - 1)).join('')}</table>
</td></tr>
${linkButton(site, 'Order')}
${footerLines([
  `Orders close ${formatClosesAt(week.ordersCloseAt)}.`,
  `${PICKUP_PLACE}.`,
  TERMS,
])}
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:0 22px 22px;font-family:${SANS};font-size:13px;color:${PALETTE.pebble};">
  <a href="${escapeHtml(stop)}" style="color:${PALETTE.pebble};">Stop these emails</a>
</td></tr>`,
  })
}

function openNoticeText(week: NotifiableWeek, menu: OpenNoticeItem[], stop: string, note?: string): string {
  const site = siteUrl()
  return [
    ...(note ? [note, ''] : []),
    ...menu.flatMap((item) => [`  ${item.name}`, `  ${formatCents(item.priceCents)}`, '']),
    `Order: ${site}`,
    '',
    `Orders close ${formatClosesAt(week.ordersCloseAt)}.`,
    `${PICKUP_PLACE}.`,
    TERMS,
    '',
    `Stop these emails: ${stop}`,
  ].join('\n')
}

// Sent once, to someone who asked to be told. Never throws: one bad address must not
// stop the rest of the list.
export async function sendOpenNotice(
  email: string,
  week: NotifiableWeek,
  token: string,
  menu: OpenNoticeItem[] = [],
  note?: string,
): Promise<boolean> {
  const site = siteUrl()
  const stop = `${site}/notify/unsubscribe?t=${encodeURIComponent(token)}`
  try {
    const sent = await send({
      to: email,
      subject: 'New menu this week',
      html: openNoticeHtml(week, menu, stop, note),
      // A mail client reads these to offer its own unsubscribe button, which stops
      // someone reporting the message as spam to get the same result.
      headers: {
        'List-Unsubscribe': `<${site}/api/notify/unsubscribe?t=${encodeURIComponent(token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      text: openNoticeText(week, menu, stop, note),
    })
    console.log('open_notice_sent', { messageId: sent?.id ?? null })
    return sent !== null
  } catch (error) {
    console.error('open_notice_failed', { error })
    return false
  }
}

export type LastCallItem = OpenNoticeItem & { remaining: number | null }

// "Closes Thu, Oct 15" is a date the reader has to work out. "Closes tomorrow" is not,
// and a last call is only worth sending while one of these words is still true.
function closesWhen(ordersCloseAt: Date): string {
  const day = (at: Date) => formatPt(at, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const now = new Date()
  const close = day(ordersCloseAt)
  if (close === day(now)) return 'tonight'
  if (close === day(new Date(now.getTime() + 86_400_000))) return 'tomorrow'
  return `on ${formatPt(ordersCloseAt, { weekday: 'long' })}`
}

// How many are left is the whole reason to open this message, so it sits with the price.
function leftNote(remaining: number | null): string {
  if (remaining === null) return ''
  return remaining === 1 ? '1 left' : `${remaining} left`
}

function lastCallHtml(week: NotifiableWeek, menu: LastCallItem[], stop: string, note?: string): string {
  const site = siteUrl()
  const when = closesWhen(week.ordersCloseAt)
  return shell({
    title: `Orders close ${when}`,
    preheader: note ?? `Orders close ${formatClosesAt(week.ordersCloseAt)}`,
    body: `
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:22px 22px 0;">
  <div style="font-family:${DISPLAY};font-size:22px;line-height:1.35;color:${PALETTE.ink};">Orders close ${escapeHtml(when)}</div>
  <div style="font-size:16px;color:${PALETTE.taupe};padding-top:4px;">${escapeHtml(formatClosesAt(week.ordersCloseAt))}</div>
</td></tr>
${note ? `<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:14px 22px 0;font-family:${SANS};font-size:16px;line-height:1.5;color:${PALETTE.ink};">${escapeHtml(note)}</td></tr>` : ''}
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:14px 22px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${menu
    .map((item, index) => menuRow(item, index === menu.length - 1, leftNote(item.remaining)))
    .join('')}</table>
</td></tr>
${linkButton(site, 'Order before it closes')}
${footerLines([
  `${PICKUP_PLACE}.`,
  TERMS,
])}
<tr><td bgcolor="${PALETTE.white}" style="background-color:${PALETTE.white};padding:0 22px 22px;font-family:${SANS};font-size:13px;color:${PALETTE.pebble};">
  <a href="${escapeHtml(stop)}" style="color:${PALETTE.pebble};">Stop these emails</a>
</td></tr>`,
  })
}

function lastCallText(week: NotifiableWeek, menu: LastCallItem[], stop: string, note?: string): string {
  const site = siteUrl()
  return [
    `Orders close ${closesWhen(week.ordersCloseAt)}, ${formatClosesAt(week.ordersCloseAt)}.`,
    '',
    ...(note ? [note, ''] : []),
    ...menu.flatMap((item) => {
      const left = leftNote(item.remaining)
      return [`  ${item.name}`, `  ${formatCents(item.priceCents)}${left ? ` - ${left}` : ''}`, '']
    }),
    `Order: ${site}`,
    '',
    `${PICKUP_PLACE}.`,
    TERMS,
    '',
    `Stop these emails: ${stop}`,
  ].join('\n')
}

// The second and last message of the week, for someone on the list with nothing coming.
// Never throws: one bad address must not stop the rest of the list.
export async function sendLastCall(
  email: string,
  week: NotifiableWeek,
  token: string,
  menu: LastCallItem[],
  note?: string,
): Promise<boolean> {
  const site = siteUrl()
  const stop = `${site}/notify/unsubscribe?t=${encodeURIComponent(token)}`
  try {
    const sent = await send({
      to: email,
      subject: `Last call - orders close ${closesWhen(week.ordersCloseAt)}`,
      html: lastCallHtml(week, menu, stop, note),
      headers: {
        'List-Unsubscribe': `<${site}/api/notify/unsubscribe?t=${encodeURIComponent(token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      text: lastCallText(week, menu, stop, note),
    })
    console.log('last_call_sent', { messageId: sent?.id ?? null })
    return sent !== null
  } catch (error) {
    console.error('last_call_failed', { error })
    return false
  }
}
