import 'server-only'

import { and, desc, eq, gt, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { batchItems, pickupSlots, weeks } from '@/lib/db/schema'
import { DomainError } from '@/lib/errors'

const PT = 'America/Los_Angeles'

// One address, said the same way wherever a customer reads it.
export const PICKUP_PLACE = 'The Standard at Seattle, Midrise lobby'

export type Week = typeof weeks.$inferSelect

export type WeekSummary = Week & {
  cookieTotal: number
  flavorCount: number
  slotCount: number
}

function ptOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PT,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value)
  const wallAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'))
  return Math.round((wallAsUtc - at.getTime()) / 60000)
}

// Checks the offset twice so wall times near a DST switch land on the right side of it.
export function ptToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  const first = wall - ptOffsetMinutes(new Date(wall)) * 60000
  return new Date(wall - ptOffsetMinutes(new Date(first)) * 60000)
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function formatPt(at: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: PT, ...options }).format(at)
}

export function formatPickupWeekend(pickupWeekendStart: string): string {
  const sat = new Date(`${pickupWeekendStart}T12:00:00Z`)
  const sun = new Date(`${addDays(pickupWeekendStart, 1)}T12:00:00Z`)
  const day = (at: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(at)
  return `Sat ${day(sat)} or Sun ${day(sun)}`
}

// Both ends of a pickup window share a meridiem, and a chip on a 320px phone has room
// for one. "12:00 PM" and "12:30 PM" becomes "12:00-12:30 PM".
export function formatSlotRange(startsAt: Date, endsAt: Date): string {
  const time = (at: Date) => formatPt(at, { hour: 'numeric', minute: '2-digit' })
  const from = time(startsAt)
  const to = time(endsAt)
  const meridiem = from.slice(-3)
  return `${to.endsWith(meridiem) ? from.slice(0, -3) : from}\u2013${to}`
}

// "PDT" or "PST", whichever the pickup falls in. Said once, so no chip has to carry it.
export function ptZone(at: Date): string {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: PT, timeZoneName: 'short' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'PT'
  )
}

export function formatClosesAt(ordersCloseAt: Date): string {
  return formatPt(ordersCloseAt, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export async function listWeeks(): Promise<WeekSummary[]> {
  return db
    .select({
      id: weeks.id,
      pickupWeekendStart: weeks.pickupWeekendStart,
      ordersCloseAt: weeks.ordersCloseAt,
      status: weeks.status,
      createdAt: weeks.createdAt,
      cookieTotal: sql<number>`coalesce((select sum(b.quantity_total) from batch_items b where b.week_id = "weeks"."id"), 0)::int`,
      flavorCount: sql<number>`(select count(*) from batch_items b where b.week_id = "weeks"."id" and b.quantity_total > 0)::int`,
      slotCount: sql<number>`(select count(*) from pickup_slots s where s.week_id = "weeks"."id")::int`,
    })
    .from(weeks)
    .orderBy(desc(weeks.pickupWeekendStart))
}

// The week customers can order from: open, and before its Thursday cutoff.
export async function getOrderableWeek(): Promise<Week | null> {
  const [week] = await db
    .select()
    .from(weeks)
    .where(and(eq(weeks.status, 'open'), gt(weeks.ordersCloseAt, new Date())))
  return week ?? null
}

export async function getWeek(id: string): Promise<Week> {
  const [week] = await db.select().from(weeks).where(eq(weeks.id, id))
  if (!week) throw new DomainError('Week not found', 404)
  return week
}

function ordersCloseAtFor(pickupWeekendStart: string): Date {
  return ptToUtc(addDays(pickupWeekendStart, -2), '23:59')
}

// A weekday window costs more to collect from, whenever it was ordered. Read off the day
// the window falls on in PT rather than held on the row: 8pm PT is three in the morning
// UTC the next day, so a window's own timestamp disagrees about which day it is on.
export function isWeekdayPickup(startsAt: Date): boolean {
  const day = formatPt(startsAt, { weekday: 'short' })
  return day === 'Mon' || day === 'Tue' || day === 'Wed' || day === 'Thu' || day === 'Fri'
}

// How much of a window has to be left for it to still be worth starting a pickup. It only
// applies to a window being collected today: a window on a later day is a pre-order, and the
// week's Thursday cutoff is what closes those.
export const PICKUP_LEAD_MINUTES = 60

// Whether a window can still be chosen. Today's window closes an hour before it ends, so
// nobody books a pickup they cannot reach and nothing arrives with no notice. A window on a
// later date is unaffected, which is why a weekend window is never caught by this: orders
// close on Thursday, so a Saturday window is never today while anyone can still order.
export function isPickupBookable(startsAt: Date, endsAt: Date, now = new Date()): boolean {
  const date = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: PT }).format(at)
  if (date(startsAt) !== date(now)) return true
  return endsAt.getTime() - now.getTime() >= PICKUP_LEAD_MINUTES * 60_000
}

// The next Saturday whose Thursday 11:59pm PT cutoff is still ahead. From Friday on, that's next week.
export function upcomingWeekend(now = new Date()): { pickupWeekendStart: string; ordersCloseAt: Date } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: PT }).format(now)
  const [y, m, d] = today.split('-').map(Number)
  const daysToSaturday = (6 - new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 7) % 7

  let pickupWeekendStart = addDays(today, daysToSaturday)
  if (ordersCloseAtFor(pickupWeekendStart) <= now) pickupWeekendStart = addDays(pickupWeekendStart, 7)
  return { pickupWeekendStart, ordersCloseAt: ordersCloseAtFor(pickupWeekendStart) }
}

export async function createWeek(): Promise<Week> {
  const { pickupWeekendStart, ordersCloseAt } = upcomingWeekend()
  const [week] = await db
    .insert(weeks)
    .values({ pickupWeekendStart, ordersCloseAt })
    .onConflictDoNothing({ target: weeks.pickupWeekendStart })
    .returning()
  if (!week) {
    throw new DomainError(`The week of ${formatPickupWeekend(pickupWeekendStart)} already exists`)
  }
  return week
}

export async function openWeek(id: string): Promise<Week> {
  return db.transaction(async (tx) => {
    const [week] = await tx.select().from(weeks).where(eq(weeks.id, id)).for('update')
    if (!week) throw new DomainError('Week not found', 404)
    // A week closed by hand can reopen while its cutoff is still ahead: closing early
    // is a judgement call, and a mistaken one needs a way back.
    if (week.status === 'open') throw new DomainError('This week is already open')
    if (week.ordersCloseAt.getTime() <= Date.now()) {
      throw new DomainError('The Thursday cutoff for this week has passed')
    }

    const [otherOpen] = await tx
      .select({ id: weeks.id })
      .from(weeks)
      .where(and(eq(weeks.status, 'open'), sql`${weeks.id} <> ${id}`))
    if (otherOpen) throw new DomainError('Another week is open. Close it first.')

    const [{ cookies }] = await tx
      .select({ cookies: sql<number>`coalesce(sum(${batchItems.quantityTotal}), 0)::int` })
      .from(batchItems)
      .where(eq(batchItems.weekId, id))
    const [{ slots }] = await tx
      .select({ slots: sql<number>`count(*)::int` })
      .from(pickupSlots)
      .where(eq(pickupSlots.weekId, id))
    if (cookies === 0) throw new DomainError('Set at least one flavor quantity before opening')
    if (slots === 0) throw new DomainError('Add at least one pickup slot before opening')

    const [opened] = await tx
      .update(weeks)
      .set({ status: 'open' })
      .where(and(eq(weeks.id, id), sql`${weeks.status} <> 'open'`))
      .returning()
    return opened
  })
}

export async function closeWeek(id: string): Promise<Week> {
  const [closed] = await db
    .update(weeks)
    .set({ status: 'closed' })
    .where(and(eq(weeks.id, id), eq(weeks.status, 'open')))
    .returning()
  if (closed) return closed

  const week = await getWeek(id)
  throw new DomainError(`Only an open week can be closed; this one is ${week.status}`)
}

// Admin CLI only.
export async function deleteWeek(id: string): Promise<Week> {
  const week = await getWeek(id)
  if (week.status !== 'draft') throw new DomainError(`Only a draft week can be deleted; this one is ${week.status}`)

  const [deleted] = await db
    .delete(weeks)
    .where(and(eq(weeks.id, id), eq(weeks.status, 'draft'), sql`not exists (select 1 from orders o where o.week_id = ${id})`))
    .returning()
  if (!deleted) throw new DomainError('This week has orders and can’t be deleted')
  return deleted
}
