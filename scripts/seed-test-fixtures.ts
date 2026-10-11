import { randomUUID } from 'node:crypto'

import postgres from 'postgres'

// States the layout tests need that no CLI command can reach. The menu only shows a
// flavor as sold out when a real batch has nothing left, and `setBatchQuantities` always
// sets what is left to what was made. An order needs a Stripe round trip to reach `paid`.
// A separate file for the same reason as reset-test-db.ts: it must never be reachable
// from the admin CLI that points at the live database.
const SOLD_OUT_FLAVOR = 'Oatmeal raisin'
const ORDER_CODE = 'TEST'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('refusing to write fixtures to a database that is not local')

async function main() {
  const sql = postgres(url!, { max: 1 })

  const emptied = await sql`
    update batch_items set quantity_remaining = 0
     where flavor_id = (select id from flavors where name = ${SOLD_OUT_FLAVOR})
     returning id
  `
  if (emptied.length === 0) throw new Error(`${SOLD_OUT_FLAVOR} has no batch to empty; did the seed run?`)

  const [week] = await sql`select id from weeks order by created_at desc limit 1`
  const [slot] = await sql`select id from pickup_slots where week_id = ${week.id} order by starts_at limit 1`
  const [flavor] = await sql`select id, price_cents from flavors order by created_at limit 1`
  if (!slot || !flavor) throw new Error('the week has no slot or the menu has no flavor; did week:open run?')

  // One slot booked solid, so the picker renders a full chip. Nothing else in the fixtures
  // books a slot, so that state had never been drawn.
  const [filled] = await sql`
    update pickup_slots set booked_count = capacity
     where id = (select id from pickup_slots where week_id = ${week.id} order by starts_at desc limit 1)
     returning id
  `
  if (!filled) throw new Error('the week has no slot to fill; did week:open run?')

  const id = randomUUID()
  await sql`delete from orders where order_code = ${ORDER_CODE}`
  await sql`
    insert into orders (id, order_code, week_id, pickup_slot_id, name, email, phone, status, total_cents, paid_at)
    values (${id}, ${ORDER_CODE}, ${week.id}, ${slot.id}, 'Test Person', 'test@example.com', '2065550000', 'paid', ${flavor.price_cents * 3}, now())
  `
  await sql`
    insert into order_items (order_id, flavor_id, quantity, unit_price_cents)
    values (${id}, ${flavor.id}, 3, ${flavor.price_cents})
  `

  await sql.end()
  console.log(`${SOLD_OUT_FLAVOR} is sold out, one slot is full, and order ${ORDER_CODE} is paid.`)
}
main()
