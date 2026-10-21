import { existsSync } from 'node:fs'

import { asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { flavors, orders, weeks } from '@/lib/db/schema'
import { setRole } from '@/lib/auth'
import { listFeedback } from '@/lib/feedback'
import { DomainError } from '@/lib/errors'
import { sendLastCall, sendOpenNotice } from '@/lib/email'
import { createFlavor, listFlavors, moveFlavor, updateFlavor, type Flavor } from '@/lib/flavors'
import { countWaiting, listWaiting, listWaitingWithoutOrder, markNotified } from '@/lib/notify'
import {
  addSlot,
  DEFAULT_CAPACITY,
  PICKUP_DAYS,
  type PickupDay,
  deleteSlot,
  findSlotAt,
  getMenu,
  getWeekInventory,
  listSlots,
  setBatchQuantities,
} from '@/lib/inventory'
import { WEEKDAY_CENTS, formatCents, parsePriceCents } from '@/lib/money'
import { LIMITS, flavorSchema, quantitySchema } from '@/lib/validation'
import {
  closeWeek,
  createWeek,
  deleteWeek,
  formatClosesAt,
  formatPickupWeekend,
  formatPt,
  getOrderableWeek,
  isWeekdayPickup,
  listWeeks,
  openWeek,
  upcomingWeekend,
  type Week,
} from '@/lib/weeks'

const HELP = `Dawg Treats admin

  npm run admin -- <command> [args]        add --week=YYYY-MM-DD to target another weekend

Weeks
  weeks                                    every week, newest first
  week                                     this week's flavors, quantities and slots
  week:new                                 create the upcoming week
  week:open [--quiet]                      open it, and tell the waiting list unless --quiet
  week:close                               close it
  week:delete                              delete it (draft with no orders only)

Flavors
  flavors                                  the whole menu
  flavor:add <name> <price> [description]  add a flavor, price in dollars
  flavor:edit <name> [--name=] [--price=] [--description=] [--image=] [--allergens=] [--may-contain=]
                                           --image is a file in public/, e.g. flavors/chocolate-chip.jpg
                                           --allergens adds to wheat, eggs, milk and honey, e.g. "soy"
                                           --may-contain is what a packet warns about, e.g. "peanuts"
  flavor:move <name> <place>               move it to that place on the menu, counting from 1
  flavor:off <name>                        hide from the menu
  flavor:on <name>                         show again

This week
  qty <flavor> <count>                     how many to bake
  slots:add <day> <from> <to> [--cap=]     one pickup window. Day is sat, sun, or mon to thu
                                           for an evening collected the same day, +50c
  slots:rm <day> <from>                    remove a window
  orders                                   every order for this week, with status and total

Pickup day
  admin:add <email>                        let this account open /pickup
  admin:rm <email>                         take that away

Feedback
  feedback                                 what people said and what they want baked

Waiting list
  notify                                   who asked to be told when a batch opens
  notify:send [--again] [--note=]           tell them the open week is open, once each
                                           --again also tells the people already told
                                           --note= puts one line at the top of the email
  notify:nudge [--yes] [--to=] [--note=]   last call to everyone on the list with nothing
                                           coming this weekend. Prints who, and sends
                                           nothing until --yes
                                           --to= sends one copy there and nobody else
                                           --skip= leaves these addresses out, comma separated
                                           --note= puts one line under the headline

Test data
  seed                                     flavors, quantities and slots for the upcoming week
  reset --yes                              delete every week and flavor that has no orders
`

const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--')) ?? 'help'
const positional = args.filter((a) => !a.startsWith('--') && a !== command)
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

// Resend takes two messages a second. Going faster earns a 429, which costs that address
// its email until someone runs the command again.
const SEND_GAP_MS = 600

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// The CLI reads .env.local, where the site URL is the dev server. That address is dead on
// the phone of everyone on the list, so refuse the send instead of mailing a dead link.
function requireLiveLinks() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  if (!/^https:\/\//.test(site)) {
    fail(`NEXT_PUBLIC_SITE_URL is "${site || 'unset'}", so every link in the email is dead. Run it again as: NEXT_PUBLIC_SITE_URL=https://dawgtreats.shop npm run admin -- ${command}`)
  }
}

// Opening a week and telling the list are the same moment, so both commands end here.
async function tellTheWaitingList(
  week: { id: string; pickupWeekendStart: string; ordersCloseAt: Date },
  { again = false, note }: { again?: boolean; note?: string } = {},
) {
  const waiting = await listWaiting(again)
  // Nobody to tell is not a send, so opening a week on a dev machine still works.
  if (waiting.length === 0) return { told: 0, waiting: 0, dropped: [] }

  requireLiveLinks()

  // Read once, not once per address: the menu is the same for everyone on the list. A
  // flavor with nothing left is not news, so it is left out.
  const menu = (await getMenu(week.id)).filter((item) => item.remaining !== 0)
  const dropped: string[] = []
  let told = 0

  // Paced sending looks like a hung command, and stopping it half way is how the list
  // gets told twice.
  console.log(`Telling ${waiting.length}, about ${Math.ceil((waiting.length * SEND_GAP_MS) / 1000)}s. Let it finish.`)

  for (const [index, row] of waiting.entries()) {
    if (index > 0) await pause(SEND_GAP_MS)
    // One address at a time, so a refused one cannot cost the rest their email.
    if (!(await sendOpenNotice(row.email, week, row.token, menu, note))) {
      dropped.push(row.email)
      continue
    }
    // Marked the moment it lands. Marking the whole batch at the end means a crash
    // part way through mails everyone again on the next run.
    await markNotified([row.id])
    told++
  }

  return { told, waiting: waiting.length, dropped }
}

// Says which addresses got nothing, by name: a count alone reads as a success when most
// of the list was dropped. The next run tries them again, because they stay unmarked.
function reportSend({ told, waiting, dropped }: { told: number; waiting: number; dropped: string[] }, none: string) {
  if (waiting === 0) return console.log(none)
  console.log(`Told ${told} of ${waiting}.`)
  if (dropped.length === 0) return
  console.log(`\n${dropped.length} got nothing. Run the command again to retry them:`)
  for (const email of dropped) console.log(`  ${email}`)
}

function fail(message: string): never {
  throw new DomainError(message, 400)
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

// `after` reads a bare end time as the afternoon: "slots:add sat 12:00 3:00" means 3pm, not 3am.
function parseTime(input: string, after?: string): string {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(input.trim())
  if (!match) fail(`"${input}" isn't a time. Try 12:00, 1:30pm or 14:00.`)
  let hour = Number(match[1])
  const minute = match[2] ?? '00'
  const suffix = match[3]?.toLowerCase()
  if (suffix === 'pm' && hour !== 12) hour += 12
  if (suffix === 'am' && hour === 12) hour = 0
  if (hour > 23 || (minute !== '00' && minute !== '30')) {
    fail(`Windows start and end on the hour or half hour, so "${input}" won't work.`)
  }

  let time = `${String(hour).padStart(2, '0')}:${minute}`
  if (after && !suffix && hour < 12 && minutesOf(time) < minutesOf(after)) {
    time = `${String(hour + 12).padStart(2, '0')}:${minute}`
  }
  return time
}

const DAY_NAMES: Record<PickupDay, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  sat: 'Saturday',
  sun: 'Sunday',
}

function parseDay(input: string): PickupDay {
  const day = input.toLowerCase()
  const match = (Object.keys(PICKUP_DAYS) as PickupDay[]).find((name) => day.startsWith(name))
  if (match) return match
  return fail('Pickup is Mon, Tue, Wed or Thu in the evening, or Sat or Sun')
}

async function targetWeek(): Promise<Week> {
  const weekend = flag('week') ?? upcomingWeekend().pickupWeekendStart
  const [week] = await db.select().from(weeks).where(eq(weeks.pickupWeekendStart, weekend))
  if (!week) fail(`No week for ${formatPickupWeekend(weekend)}. Run: npm run admin -- week:new`)
  return week
}

async function findFlavor(name: string): Promise<Flavor> {
  const all = await listFlavors()
  const needle = name.toLowerCase()
  const exact = all.filter((f) => f.name.toLowerCase() === needle)
  const matches = exact.length ? exact : all.filter((f) => f.name.toLowerCase().includes(needle))
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) fail(`No flavor matches "${name}". Run: npm run admin -- flavors`)
  return fail(`"${name}" matches ${matches.length} flavors: ${matches.map((f) => f.name).join(', ')}`)
}

function requirePrice(input: string): number {
  const cents = parsePriceCents(input)
  if (cents === null) fail(`"${input}" isn't a price. Try 3.50.`)
  const parsed = flavorSchema.shape.priceCents.safeParse(cents)
  if (!parsed.success) fail(parsed.error.issues[0].message)
  return cents
}

function slotLine(slot: { startsAt: Date; endsAt: Date; bookedCount: number; capacity: number; orderCount: number }) {
  const time = (at: Date) => formatPt(at, { hour: 'numeric', minute: '2-digit' })
  const day = formatPt(slot.startsAt, { weekday: 'short' })
  const orders = slot.orderCount > 0 ? ` · ${slot.orderCount} order${slot.orderCount === 1 ? '' : 's'}` : ''
  // A weekday window costs more to collect from, so the list says which ones do.
  const fee = isWeekdayPickup(slot.startsAt) ? ` · weekday +${formatCents(WEEKDAY_CENTS)}` : ''
  const past = slot.endsAt.getTime() <= Date.now() ? ' · past' : ''
  return `  ${day} ${time(slot.startsAt)}–${time(slot.endsAt)}   ${slot.bookedCount}/${slot.capacity} booked${orders}${fee}${past}`
}

async function showWeek(week: Week) {
  const [inventory, slots] = await Promise.all([getWeekInventory(week.id), listSlots(week.id)])
  const cookies = inventory.reduce((sum, row) => sum + row.quantityTotal, 0)

  console.log(`\n${formatPickupWeekend(week.pickupWeekendStart)}  [${week.status}]`)
  console.log(`Orders close ${formatClosesAt(week.ordersCloseAt)}\n`)

  console.log(`Quantities (${cookies} cookies)`)
  if (inventory.length === 0) console.log('  no flavors yet')
  for (const row of inventory) {
    const sold = row.sold > 0 ? ` · ${row.sold} sold` : ''
    const inactive = row.active ? '' : ' (inactive)'
    console.log(`  ${String(row.quantityTotal).padStart(4)}  ${row.name}${inactive}  ${formatCents(row.priceCents)}${sold}`)
  }

  const pickups = slots.reduce((sum, slot) => sum + slot.capacity, 0)
  console.log(`\nPickup windows (${slots.length} · ${pickups} pickups max)`)
  if (slots.length === 0) console.log('  no windows yet')
  for (const slot of slots) console.log(slotLine(slot))
  console.log()
}

function imagePath(value: string): string | null {
  const image = value.trim()
  if (!image) return null
  if (image.startsWith('http://') || image.startsWith('https://')) return image
  const path = image.startsWith('/') ? image : `/${image}`
  if (!existsSync(`public${path}`)) fail(`No file at public${path}`)
  return path
}

const commands: Record<string, () => Promise<void>> = {
  async help() {
    console.log(HELP)
  },

  async weeks() {
    const all = await listWeeks()
    if (all.length === 0) return console.log('No weeks yet. Run: npm run admin -- week:new')
    for (const week of all) {
      console.log(
        `${week.pickupWeekendStart}  ${week.status.padEnd(6)}  ${String(week.cookieTotal).padStart(4)} cookies  ` +
          `${week.flavorCount} flavors  ${week.slotCount} slots  · closes ${formatClosesAt(week.ordersCloseAt)}`,
      )
    }
  },

  async week() {
    await showWeek(await targetWeek())
  },

  async 'week:new'() {
    const week = await createWeek()
    console.log(`Created ${formatPickupWeekend(week.pickupWeekendStart)} as a draft.`)
    await showWeek(week)
  },

  async 'week:open'() {
    const week = await openWeek((await targetWeek()).id)
    console.log(`${formatPickupWeekend(week.pickupWeekendStart)} is open. Orders close ${formatClosesAt(week.ordersCloseAt)}.`)

    if (args.includes('--quiet')) return console.log('Nobody told: --quiet.')
    reportSend(await tellTheWaitingList(week), 'Nobody was waiting.')
  },

  async 'week:close'() {
    const week = await closeWeek((await targetWeek()).id)
    console.log(`${formatPickupWeekend(week.pickupWeekendStart)} is closed.`)
  },

  async 'week:delete'() {
    const week = await deleteWeek((await targetWeek()).id)
    console.log(`Deleted ${formatPickupWeekend(week.pickupWeekendStart)}.`)
  },

  async notify() {
    const waiting = await listWaiting()
    console.log(`${waiting.length} waiting, of ${await countWaiting()} never told.`)
    for (const row of waiting) console.log(`  ${row.email}`)
  },

  async 'notify:send'() {
    const week = await getOrderableWeek()
    if (!week) fail('No week is open. Run: npm run admin -- week:open')

    const again = args.includes('--again')
    reportSend(await tellTheWaitingList(week, { again, note: flag('note') }), 'Nobody is waiting.')
  },

  async 'notify:nudge'() {
    const week = await getOrderableWeek()
    if (!week) fail('No week is open, so a last call has nothing to point at.')
    requireLiveLinks()

    // A sold-out flavor is not news, and a last call with nothing left to sell is spam.
    const menu = (await getMenu(week.id)).filter((item) => item.remaining !== 0)
    if (menu.length === 0) fail('Everything is sold out, so there is nothing to last-call.')

    const note = flag('note')
    const to = flag('to')

    // One copy to one address, for a look at the message before the list gets it. The
    // token is the real one when that address is on the list, so the test also proves
    // the unsubscribe link works.
    if (to) {
      const token = (await listWaiting(true)).find((row) => row.email.toLowerCase() === to.toLowerCase())?.token
      if (!token) console.log(`${to} is not on the list, so the unsubscribe link is a dead token.`)
      const sent = await sendLastCall(to, week, token ?? 'preview', menu, note)
      return console.log(sent ? `Sent one to ${to}.` : `${to} got nothing. Check the Resend key.`)
    }

    // Named by hand, for the week someone asks to be left out of this one send.
    const skip = new Set((flag('skip') ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
    const all = await listWaitingWithoutOrder(week.id)
    const waiting = all.filter((row) => !skip.has(row.email.toLowerCase()))
    if (all.length === 0) return console.log('Everyone on the list already ordered this week.')

    // A misspelled address in --skip silently mails someone who asked to be left out, so
    // every name that matched nothing is reported before anything is sent.
    const unmatched = [...skip].filter((email) => !all.some((row) => row.email.toLowerCase() === email))
    if (unmatched.length > 0) fail(`--skip names ${unmatched.join(', ')}, which nobody on the list matches. Check the spelling.`)
    if (waiting.length === 0) return console.log('Everyone left on the list was skipped.')
    if (skip.size > 0) console.log(`Skipping ${skip.size}: ${[...skip].join(', ')}\n`)

    // Nothing here marks a row, so a second run mails the same people again. The list is
    // printed and the send waits for --yes, because that is the only guard there is.
    if (!args.includes('--yes')) {
      console.log(`${waiting.length} would get a last call:`)
      for (const row of waiting) console.log(`  ${row.email}`)
      return console.log('\nNothing sent. Run it again with --yes.')
    }

    console.log(`Telling ${waiting.length}, about ${Math.ceil((waiting.length * SEND_GAP_MS) / 1000)}s. Let it finish.`)
    const dropped: string[] = []
    let told = 0
    for (const [index, row] of waiting.entries()) {
      if (index > 0) await pause(SEND_GAP_MS)
      if (await sendLastCall(row.email, week, row.token, menu, note)) told++
      else dropped.push(row.email)
    }
    reportSend({ told, waiting: waiting.length, dropped }, 'Nobody is waiting.')
  },

  async flavors() {
    const all = await listFlavors()
    if (all.length === 0) return console.log('No flavors yet. Run: npm run admin -- flavor:add "Snickerdoodle" 3.00')
    for (const [index, flavor] of all.entries()) {
      // Numbered, because that number is what flavor:move takes. Only the ones on the
      // menu have a place on it.
      const place = flavor.active ? `${index + 1}.`.padStart(3) : ' off'
      console.log(`${place} ${formatCents(flavor.priceCents).padStart(7)}  ${flavor.name}${flavor.description ? `  — ${flavor.description}` : ''}`)
    }
  },

  async 'flavor:add'() {
    const [name, price, description] = positional
    if (!name || !price) fail('Usage: flavor:add <name> <price> [description]')
    const input = flavorSchema.safeParse({ name, description: description ?? '', priceCents: requirePrice(price) })
    if (!input.success) fail(input.error.issues[0].message)
    const flavor = await createFlavor(input.data)
    console.log(`Added ${flavor.name} at ${formatCents(flavor.priceCents)}.`)
  },

  async 'flavor:edit'() {
    const flavor = await findFlavor(positional[0] ?? fail('Usage: flavor:edit <name> [--name=] [--price=] [--description=] [--image=] [--allergens=] [--may-contain=]'))
    const price = flag('price')
    const patch = {
      ...(flag('name') ? { name: flag('name')! } : {}),
      ...(flag('description') !== undefined ? { description: flag('description') || null } : {}),
      ...(price ? { priceCents: requirePrice(price) } : {}),
      ...(flag('image') !== undefined ? { imageUrl: imagePath(flag('image')!) } : {}),
      ...(flag('allergens') !== undefined ? { allergens: flag('allergens') || null } : {}),
      ...(flag('may-contain') !== undefined ? { mayContain: flag('may-contain') || null } : {}),
    }
    if (Object.keys(patch).length === 0) {
      fail('Nothing to change. Pass --name=, --price=, --description=, --image=, --allergens= or --may-contain=')
    }
    const updated = await updateFlavor(flavor.id, patch)
    console.log(`Updated ${updated.name}: ${formatCents(updated.priceCents)}${updated.description ? ` — ${updated.description}` : ''}`)
  },

  async 'flavor:move'() {
    const [name, place] = positional
    if (!name || !place) fail('Usage: flavor:move <name> <place>')
    const position = Number(place)
    if (!Number.isInteger(position)) fail('The place is a whole number, counting from 1.')
    const flavor = await findFlavor(name)
    const ordered = await moveFlavor(flavor.id, position)
    console.log(`Moved ${flavor.name} to ${position}. The menu now reads:`)
    for (const [index, item] of ordered.filter((item) => item.active).entries()) {
      console.log(`${`${index + 1}.`.padStart(3)} ${item.name}`)
    }
  },

  async 'flavor:off'() {
    const flavor = await updateFlavor((await findFlavor(positional[0] ?? fail('Usage: flavor:off <name>'))).id, { active: false })
    console.log(`${flavor.name} is off the menu.`)
  },

  async 'flavor:on'() {
    const flavor = await updateFlavor((await findFlavor(positional[0] ?? fail('Usage: flavor:on <name>'))).id, { active: true })
    console.log(`${flavor.name} is back on the menu.`)
  },

  async 'admin:add'() {
    const account = await setRole(positional[0] ?? fail('Usage: admin:add <email>'), 'admin')
    console.log(`${account.email} can now open /pickup.`)
  },

  async 'admin:rm'() {
    const account = await setRole(positional[0] ?? fail('Usage: admin:rm <email>'), 'customer')
    console.log(`${account.email} can no longer open /pickup.`)
  },

  async feedback() {
    const all = await listFeedback()
    if (all.length === 0) return console.log('\nNothing yet.')

    const rated = all.filter((f) => f.rating !== null)
    const average = rated.length
      ? ` · ${(rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length).toFixed(1)} average from ${rated.length}`
      : ''
    console.log(`\n${all.length} message${all.length === 1 ? '' : 's'}${average}\n`)
    for (const item of all) {
      const stars = item.rating
        ? '*'.repeat(item.rating).padEnd(LIMITS.ratingMax, '.')
        : ' '.repeat(LIMITS.ratingMax)
      console.log(`  ${stars}  ${item.name ?? 'anonymous'}`)
      console.log(`         ${item.message}`)
    }
  },

  async qty() {
    const [name, count] = positional
    if (!name || count === undefined) fail('Usage: qty <flavor> <count>')
    const quantity = quantitySchema.safeParse(Number(count))
    if (!quantity.success) fail(quantity.error.issues[0].message)

    const week = await targetWeek()
    const flavor = await findFlavor(name)
    await setBatchQuantities(week.id, [{ flavorId: flavor.id, quantity: quantity.data }])
    console.log(`${flavor.name}: ${quantity.data} for ${formatPickupWeekend(week.pickupWeekendStart)}.`)
  },

  async 'slots:add'() {
    const [dayInput, fromInput, toInput] = positional
    if (!dayInput || !fromInput || !toInput) fail('Usage: slots:add <mon|tue|wed|thu|sat|sun> <from> <to> [--cap=]')
    const day = parseDay(dayInput)
    const week = await targetWeek()

    const from = parseTime(fromInput)
    const to = parseTime(toInput, from)
    if (minutesOf(to) <= minutesOf(from)) fail(`${toInput} is not after ${fromInput}`)

    const capInput = flag('cap')
    const cap = capInput === undefined ? undefined : Number(capInput)
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) {
      fail('--cap is a whole number of pickups, 1 or more')
    }

    await addSlot(week.id, day, from, to, cap)
    const held = cap ?? (PICKUP_DAYS[day] < 0 ? DEFAULT_CAPACITY.evening : DEFAULT_CAPACITY.weekend)
    console.log(`Added ${DAY_NAMES[day]} ${from}\u2013${to}, ${held} pickups.`)
  },

  async 'slots:rm'() {
    const [dayInput, timeInput] = positional
    if (!dayInput || !timeInput) fail('Usage: slots:rm <day> <from>')
    const day = parseDay(dayInput)
    const week = await targetWeek()
    await deleteSlot(await findSlotAt(week.id, day, parseTime(timeInput)))
    console.log(`Removed the ${DAY_NAMES[day]} window starting ${timeInput}.`)
  },

  async seed() {
    const demo = [
      { name: 'Brown butter choc chip', description: 'Sea salt, dark chocolate, crisp edges.', priceCents: 350, quantity: 24 },
      { name: 'Snickerdoodle', description: 'Cinnamon sugar, soft centre.', priceCents: 300, quantity: 18 },
      // The layout tests sell this one out, which is the only way to render the sold-out
      // half of the menu: a flavor with no batch at all never reaches the menu.
      { name: 'Oatmeal raisin', description: 'Chewy, with a lot of cinnamon.', priceCents: 300, quantity: 6 },
    ]
    const existing = await listFlavors()
    for (const item of demo) {
      if (existing.some((f) => f.name.toLowerCase() === item.name.toLowerCase())) continue
      await createFlavor({ name: item.name, description: item.description, priceCents: item.priceCents })
      console.log(`Added ${item.name}.`)
    }

    const weekend = upcomingWeekend().pickupWeekendStart
    const [found] = await db.select().from(weeks).where(eq(weeks.pickupWeekendStart, weekend))
    const week = found ?? (await createWeek())
    if (!found) console.log(`Created ${formatPickupWeekend(week.pickupWeekendStart)}.`)

    for (const item of demo) {
      const flavor = await findFlavor(item.name)
      await setBatchQuantities(week.id, [{ flavorId: flavor.id, quantity: item.quantity }])
    }
    // One window a day, not a row of half hours. The evenings are left out: a seeded week
    // is for looking at, and a same-day window you did not ask for would charge for itself.
    for (const [day, from, to] of [
      ['sat', '12:00', '14:00'],
      ['sun', '14:00', '15:00'],
    ] as const) {
      try {
        await addSlot(week.id, day, from, to)
      } catch (error) {
        if (!(error instanceof DomainError)) throw error
      }
    }
    await showWeek(week)
    console.log('Ready. Open it with: npm run admin -- week:open')
  },

  async reset() {
    if (!args.includes('--yes')) fail('This deletes weeks and flavors. Re-run with --yes if you mean it.')

    const deletedWeeks = await db
      .delete(weeks)
      .where(sql`not exists (select 1 from orders o where o.week_id = "weeks"."id")`)
      .returning({ weekend: weeks.pickupWeekendStart })
    const deletedFlavors = await db
      .delete(flavors)
      .where(sql`not exists (select 1 from order_items i where i.flavor_id = "flavors"."id")`)
      .returning({ name: flavors.name })
    const [{ kept }] = await db.select({ kept: sql<number>`count(*)::int` }).from(orders)

    console.log(`Deleted ${deletedWeeks.length} week(s) and ${deletedFlavors.length} flavor(s).`)
    if (kept > 0) console.log(`Kept everything attached to ${kept} order(s).`)
  },

  async orders() {
    const week = await targetWeek()
    const rows = await db
      .select({ code: orders.orderCode, name: orders.name, status: orders.status, totalCents: orders.totalCents })
      .from(orders)
      .where(eq(orders.weekId, week.id))
      .orderBy(asc(orders.createdAt))
    if (rows.length === 0) return console.log(`No orders yet for ${formatPickupWeekend(week.pickupWeekendStart)}.`)
    for (const row of rows) {
      console.log(`${row.code}  ${row.status.padEnd(9)}  ${formatCents(row.totalCents).padStart(8)}  ${row.name}`)
    }
  },
}

async function main() {
  const run = commands[command]
  if (!run) {
    console.error(`Unknown command "${command}".\n`)
    console.log(HELP)
    process.exit(1)
  }
  await run()
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    if (error instanceof DomainError) {
      console.error(`\n${error.message}\n`)
      process.exit(1)
    }
    console.error(error)
    process.exit(1)
  })
