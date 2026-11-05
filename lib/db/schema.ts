import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
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
  // One free cookie per account, redeemed whenever they like. Set the moment it is claimed,
  // in the same transaction that takes the order, so it cannot be claimed twice.
  freeCookieUsedAt: timestamp('free_cookie_used_at', { withTimezone: true }),
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
  // Where the flavor sits on the menu. Held apart from created_at so a flavor can be
  // moved without the row claiming it was added at a time it was not.
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// What visitors do before an order exists. A visitor id is a random string held for
// one browser session, so steps can be counted per person without naming anyone.
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  visitorId: text('visitor_id').notNull(),
  // 'phone' or 'desktop', and nothing finer. Enough to say where the traffic is without
  // keeping anything that describes a person. Null on the rows recorded before this.
  device: text('device'),
  weekId: uuid('week_id'),
  detail: text('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// People who arrived while ordering was shut. Held until a week opens and they are
// told, which is the only thing this address is ever used for.
export const notifyRequests = pgTable('notify_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  // An unsubscribe link in an email cannot ask the reader to sign in first, so the row
  // carries its own secret. The database fills it, which also covers the rows already here.
  token: text('token')
    .notNull()
    .unique()
    .default(sql`gen_random_uuid()::text`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
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
  // Charged for a same-day pickup, and nothing to do with the cookies, so it is kept off
  // order_items: a total reconstructs as the items plus this.
  pickupFeeCents: integer('pickup_fee_cents').notNull().default(0),
  // A cookie to put in the bag on pickup day, on the house. Nothing comes off the total,
  // so this is a note to whoever packs the order rather than a line of money.
  freeCookie: boolean('free_cookie').notNull().default(false),
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

// Resumes are small, rare and only ever read by the owner, so they ride in the row
// instead of in a storage bucket that nothing else on the site would use.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

export const jobApplications = pgTable('job_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  year: text('year').notNull(),
  major: text('major').notNull(),
  // Someone may apply for both roles, and each role asks its own question.
  roles: text('roles').array().notNull(),
  link: text('link').notNull(),
  productAnswer: text('product_answer'),
  engineeringAnswer: text('engineering_answer'),
  hoursPerWeek: integer('hours_per_week').notNull(),
  resumeName: text('resume_name').notNull(),
  resumeType: text('resume_type').notNull(),
  resume: bytea('resume').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
