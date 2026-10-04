import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['customer', 'admin'])
export const weekStatus = pgEnum('week_status', ['draft', 'open', 'closed'])
export const orderStatus = pgEnum('order_status', [
  'pending',
  'paid',
  'ready',
  'picked_up',
  'expired',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  supabaseUid: uuid('supabase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  phone: text('phone'),
  role: userRole('role').notNull().default('customer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const flavors = pgTable('flavors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  imageUrl: text('image_url'),
  allergens: text('allergens'),
  mayContain: text('may_contain'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// What visitors do before an order exists. A visitor id is a random string held for
// one browser session, so steps can be counted per person without naming anyone.
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  visitorId: text('visitor_id').notNull(),
  weekId: uuid('week_id'),
  detail: text('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const weeks = pgTable('weeks', {
  id: uuid('id').primaryKey().defaultRandom(),
  pickupWeekendStart: date('pickup_weekend_start').notNull().unique(),
  ordersCloseAt: timestamp('orders_close_at', { withTimezone: true }).notNull(),
  status: weekStatus('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const batchItems = pgTable(
  'batch_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    flavorId: uuid('flavor_id')
      .notNull()
      .references(() => flavors.id, { onDelete: 'restrict' }),
    quantityTotal: integer('quantity_total').notNull(),
    quantityRemaining: integer('quantity_remaining').notNull(),
  },
  (t) => [
    unique('batch_items_week_flavor_key').on(t.weekId, t.flavorId),
    check('batch_items_quantity_remaining_check', sql`${t.quantityRemaining} >= 0`),
  ],
)

export const pickupSlots = pgTable(
  'pickup_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weekId: uuid('week_id')
      .notNull()
      .references(() => weeks.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    capacity: integer('capacity').notNull().default(5),
    bookedCount: integer('booked_count').notNull().default(0),
  },
  (t) => [check('pickup_slots_booked_count_check', sql`${t.bookedCount} <= ${t.capacity}`)],
)

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderCode: text('order_code').notNull().unique(),
  weekId: uuid('week_id')
    .notNull()
    .references(() => weeks.id, { onDelete: 'restrict' }),
  pickupSlotId: uuid('pickup_slot_id')
    .notNull()
    .references(() => pickupSlots.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  status: orderStatus('status').notNull().default('pending'),
  totalCents: integer('total_cents').notNull(),
  stripeSessionId: text('stripe_session_id').unique(),
  reservedUntil: timestamp('reserved_until', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  // Set when the pickup-day reminder goes out, so a retry cannot send it twice.
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  flavorId: uuid('flavor_id')
    .notNull()
    .references(() => flavors.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
})

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const stripeEvents = pgTable('stripe_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  stripeEventId: text('stripe_event_id').notNull().unique(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
})

// One form for everything a customer wants to say: how the cookies were, what they
// want baked next, or both. A rating is optional because a flavor idea needs none.
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rating: integer('rating'),
    message: text('message').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('rating_range', sql`${table.rating} is null or ${table.rating} between 1 and 5`)],
)
