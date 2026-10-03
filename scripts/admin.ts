import { asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { flavors, orders, weeks } from '@/lib/db/schema'
import { setRole } from '@/lib/auth'
import { listFeedback } from '@/lib/feedback'
import { DomainError } from '@/lib/errors'
import { createFlavor, listFlavors, updateFlavor, type Flavor } from '@/lib/flavors'
import {
  addSlot,
  deleteSlot,
  findSlotAt,
  getWeekInventory,
  listSlots,
  setBatchQuantities,
} from '@/lib/inventory'
import { formatCents, parsePriceCents } from '@/lib/money'
import { flavorSchema, quantitySchema } from '@/lib/validation'
import {
  closeWeek,
  createWeek,
  deleteWeek,
  formatClosesAt,
  formatPickupWeekend,
  formatPt,
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
  week:open                                open it for orders
  week:close                               close it
  week:delete                              delete it (draft with no orders only)

Flavors
  flavors                                  the whole menu
  flavor:add <name> <price> [description]  add a flavor, price in dollars
  flavor:edit <name> [--name=] [--price=] [--description=]
  flavor:off <name>                        hide from the menu
  flavor:on <name>                         show again

This week
  qty <flavor> <count>                     how many to bake
  slots:add <sat|sun> <from> [to]          one slot, or every half hour up to "to"
  slots:rm <sat|sun> <time>                remove a slot
  orders                                   every order for this week, with status and total

Pickup day
  admin:add <email>                        let this account open /pickup
  admin:rm <email>                         take that away

Feedback
  feedback                                 what people said and what they want baked

Test data
  seed                                     flavors, quantities and slots for the upcoming week
  reset --yes                              delete every week and flavor that has no orders
`

const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--')) ?? 'help'
const positional = args.filter((a) => !a.startsWith('--') && a !== command)
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')

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
    fail(`Slots start on the hour or half hour, so "${input}" won't work.`)
  }

  let time = `${String(hour).padStart(2, '0')}:${minute}`
  if (after && !suffix && hour < 12 && minutesOf(time) < minutesOf(after)) {
    time = `${String(hour + 12).padStart(2, '0')}:${minute}`
  }
  return time
}

function parseDay(input: string): 'sat' | 'sun' {
  const day = input.toLowerCase()
  if (day.startsWith('sat')) return 'sat'
  if (day.startsWith('sun')) return 'sun'
  return fail('Pickup is Saturday or Sunday only')
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
  return `  ${day} ${time(slot.startsAt)}–${time(slot.endsAt)}   ${slot.bookedCount}/${slot.capacity} booked${orders}`
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

  console.log(`\nPickup slots (${slots.length} · ${slots.length * 5} pickups max)`)
  if (slots.length === 0) console.log('  no slots yet')
  for (const slot of slots) console.log(slotLine(slot))
  console.log()
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
  },

  async 'week:close'() {
    const week = await closeWeek((await targetWeek()).id)
    console.log(`${formatPickupWeekend(week.pickupWeekendStart)} is closed.`)
  },

  async 'week:delete'() {
    const week = await deleteWeek((await targetWeek()).id)
    console.log(`Deleted ${formatPickupWeekend(week.pickupWeekendStart)}.`)
  },

  async flavors() {
    const all = await listFlavors()
    if (all.length === 0) return console.log('No flavors yet. Run: npm run admin -- flavor:add "Snickerdoodle" 3.00')
    for (const flavor of all) {
      const state = flavor.active ? '    ' : 'off '
      console.log(`${state}${formatCents(flavor.priceCents).padStart(7)}  ${flavor.name}${flavor.description ? `  — ${flavor.description}` : ''}`)
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
    const flavor = await findFlavor(positional[0] ?? fail('Usage: flavor:edit <name> [--name=] [--price=] [--description=]'))
    const price = flag('price')
    const patch = {
      ...(flag('name') ? { name: flag('name')! } : {}),
      ...(flag('description') !== undefined ? { description: flag('description') || null } : {}),
      ...(price ? { priceCents: requirePrice(price) } : {}),
    }
    if (Object.keys(patch).length === 0) fail('Nothing to change. Pass --name=, --price= or --description=')
    const updated = await updateFlavor(flavor.id, patch)
    console.log(`Updated ${updated.name}: ${formatCents(updated.priceCents)}${updated.description ? ` — ${updated.description}` : ''}`)
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
      const stars = item.rating ? '*'.repeat(item.rating).padEnd(5, '.') : '     '
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
    if (!dayInput || !fromInput) fail('Usage: slots:add <sat|sun> <from> [to]')
    const day = parseDay(dayInput)
    const week = await targetWeek()

    const from = parseTime(fromInput)
    const to = toInput ? parseTime(toInput, from) : from
    if (minutesOf(to) < minutesOf(from)) fail(`${toInput} is before ${fromInput}`)

    const added: string[] = []
    const last = toInput ? minutesOf(to) - 30 : minutesOf(from)
    for (let m = minutesOf(from); m <= Math.max(minutesOf(from), last); m += 30) {
      const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      try {
        await addSlot(week.id, day, time)
        added.push(time)
      } catch (error) {
        if (!(error instanceof DomainError)) throw error
        console.log(`  skipped ${time}: ${error.message}`)
      }
    }
    console.log(`Added ${added.length} slot${added.length === 1 ? '' : 's'}: ${added.join(', ') || 'none'}`)
  },

  async 'slots:rm'() {
    const [dayInput, timeInput] = positional
    if (!dayInput || !timeInput) fail('Usage: slots:rm <sat|sun> <time>')
    const week = await targetWeek()
    await deleteSlot(await findSlotAt(week.id, parseDay(dayInput), parseTime(timeInput)))
    console.log(`Removed the ${parseDay(dayInput) === 'sat' ? 'Saturday' : 'Sunday'} ${timeInput} slot.`)
  },

  async seed() {
    const demo = [
      { name: 'Brown butter choc chip', description: 'Sea salt, dark chocolate, crisp edges.', priceCents: 350, quantity: 24 },
      { name: 'Snickerdoodle', description: 'Cinnamon sugar, soft centre.', priceCents: 300, quantity: 18 },
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
    for (const time of ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30']) {
      try {
        await addSlot(week.id, 'sat', time)
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
