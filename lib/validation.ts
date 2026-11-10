import { z } from 'zod'

import { formatCents } from '@/lib/money'

export const LIMITS = {
  nameMax: 60,
  emailMax: 120,
  descriptionMax: 200,
  priceMaxCents: 10000,
  quantityMax: 1000,
  perFlavorMax: 24,
  perOrderMax: 24,
  messageMax: 500,
  ratingMax: 5,
  answerMax: 2000,
  linkMax: 300,
  majorMax: 80,
  hoursMin: 1,
  hoursMax: 40,
  resumeMaxBytes: 5 * 1024 * 1024,
} as const

export const RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

// Crockford's alphabet: no I, L, O or U, so a code read aloud is never mistyped. It lives
// here because the lookup form checks a typed code and lib/orders cannot reach the browser.
export const ORDER_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const MESSAGES = {
  nameRequired: 'Name is required',
  nameTooLong: `Name must be ${LIMITS.nameMax} characters or fewer`,
  descriptionTooLong: `Description must be ${LIMITS.descriptionMax} characters or fewer`,
  priceFormat: 'Enter a price like 3.50',
  priceZero: 'Price must be more than $0',
  priceTooHigh: `Price must be ${formatCents(LIMITS.priceMaxCents)} or less`,
  quantityWhole: 'Quantities must be whole numbers',
  quantityTooHigh: `Quantities must be ${LIMITS.quantityMax} or fewer`,
  emailRequired: 'Email is required',
  emailFormat: 'That email address does not look right',
  emailTooLong: 'That email address is too long',
  phoneRequired: 'Phone number is required',
  phoneFormat: 'Enter a 10-digit phone number',
  slotRequired: 'Pickup time is required',
  ratingRequired: 'Pick a rating first',
  ratingRange: 'A rating is one to five stars',
  messageTooLong: `Keep it to ${LIMITS.messageMax} characters or fewer`,
  roleRequired: 'Pick at least one role',
  answerRequired: 'This one needs an answer',
  answerTooLong: `Keep it to ${LIMITS.answerMax} characters or fewer`,
  linkRequired: 'A link is required',
  linkFormat: 'That link does not look right',
  majorRequired: 'Major is required',
  yearRequired: 'Year is required',
  hoursRange: `Hours must be between ${LIMITS.hoursMin} and ${LIMITS.hoursMax}`,
  resumeRequired: 'A resume is required',
  resumeType: 'Attach a PDF or a Word document',
  resumeTooBig: 'That resume is over 5 MB',
} as const

export const flavorSchema = z.object({
  name: z.string().trim().min(1, MESSAGES.nameRequired).max(LIMITS.nameMax, MESSAGES.nameTooLong),
  description: z
    .string()
    .trim()
    .max(LIMITS.descriptionMax, MESSAGES.descriptionTooLong)
    .transform((d) => d || null),
  priceCents: z
    .int(MESSAGES.priceFormat)
    .min(1, MESSAGES.priceZero)
    .max(LIMITS.priceMaxCents, MESSAGES.priceTooHigh),
  allergens: z
    .string()
    .trim()
    .max(LIMITS.descriptionMax, MESSAGES.descriptionTooLong)
    .transform((t) => t || null)
    .optional(),
  mayContain: z
    .string()
    .trim()
    .max(LIMITS.descriptionMax, MESSAGES.descriptionTooLong)
    .transform((t) => t || null)
    .optional(),
})

// Every event the site may count. The browser sends one of these names; the route
// accepts nothing else, so a spoofed body cannot invent a metric.
export const EVENTS = [
  'menu_viewed',
  'add_to_cart',
  'cart_viewed',
  'checkout_reached',
  'sold_out_wanted',
] as const

export type EventName = (typeof EVENTS)[number]

export const DEVICES = ['phone', 'desktop'] as const
export type Device = (typeof DEVICES)[number]

export const eventSchema = z.object({
  name: z.enum(EVENTS),
  visitorId: z.string().trim().min(8).max(64),
  detail: z.string().trim().max(60).optional(),
  device: z.enum(DEVICES).optional(),
})

export const moveSlotSchema = z.object({
  slotId: z.uuid(MESSAGES.slotRequired),
})

export const notifySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email(MESSAGES.emailFormat)),
})

// Three separate things can stop someone adding another cookie: the stock left, the
// cap per flavor and the cap per order. Whichever binds has to be the one named.
export function cartLimit(
  line: { quantity: number; remaining: number | null },
  cookiesInCart: number,
): { max: number; reached: string | null } {
  const stock = Math.min(line.remaining ?? LIMITS.perFlavorMax, LIMITS.perFlavorMax)
  const perOrder = line.quantity + Math.max(0, LIMITS.perOrderMax - cookiesInCart)
  const max = Math.min(stock, perOrder)

  if (line.quantity < max) return { max, reached: null }
  if (perOrder <= stock) return { max, reached: `${LIMITS.perOrderMax} cookies per order.` }
  if (line.remaining !== null && line.remaining < LIMITS.perFlavorMax) {
    return { max, reached: `Only ${line.remaining} left this week.` }
  }
  return { max, reached: `${LIMITS.perFlavorMax} of one flavor per order.` }
}

export const quantitySchema = z
  .int(MESSAGES.quantityWhole)
  .min(0, 'Quantities can’t be negative')
  .max(LIMITS.quantityMax, MESSAGES.quantityTooHigh)

export function nameError(value: string): string | null {
  return value.trim() ? null : MESSAGES.nameRequired
}

// Stored as digits, so every number looks the same. The form shows (425) 555-0142.
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

export function formatPhoneInput(raw: string): string {
  const digits = phoneDigits(raw).slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function formatPhone(stored: string): string {
  return formatPhoneInput(stored) || stored
}

export const phoneSchema = z
  .string()
  .transform(phoneDigits)
  .refine((digits) => digits.length === 10, MESSAGES.phoneFormat)

export function emailError(value: string): string | null {
  if (!value.trim()) return MESSAGES.emailRequired
  return z.email().safeParse(value.trim()).success ? null : MESSAGES.emailFormat
}

// Optional on the account page, required at checkout: it is how a missed pickup gets sorted out.
export function phoneError(value: string, required = true): string | null {
  const digits = phoneDigits(value)
  if (!digits) return required ? MESSAGES.phoneRequired : null
  return digits.length === 10 ? null : MESSAGES.phoneFormat
}

const contact = {
  name: z.string().trim().min(1, 'Your name is required').max(LIMITS.nameMax, MESSAGES.nameTooLong),
  email: z.email(MESSAGES.emailFormat).max(LIMITS.emailMax, MESSAGES.emailTooLong),
  phone: phoneSchema,
}

export const checkoutSchema = z.object({
  ...contact,
  pickupSlotId: z.uuid(MESSAGES.slotRequired),
  // Asked for rather than assumed: a free cookie nobody wanted still spends the one they
  // had. Optional, so a caller that never offers one does not have to say so. The server
  // checks the account actually has it to spend.
  freeCookie: z.boolean().optional(),
  items: z
    .array(
      z.object({
        flavorId: z.uuid('That flavor is no longer on the menu'),
        quantity: z
          .int('Quantities must be whole numbers')
          .min(1, 'Quantities must be at least 1')
          .max(LIMITS.perFlavorMax, `${LIMITS.perFlavorMax} of one flavor per order`),
      }),
    )
    .min(1, 'Your cart is empty')
    .refine(
      (items) => new Set(items.map((i) => i.flavorId)).size === items.length,
      'Each flavor can appear only once',
    )
    .refine(
      (items) => items.reduce((sum, i) => sum + i.quantity, 0) <= LIMITS.perOrderMax,
      `${LIMITS.perOrderMax} cookies per order, so there is enough to go around`,
    ),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

export const feedbackSchema = z.object({
  rating: z.int().min(1, MESSAGES.ratingRequired).max(LIMITS.ratingMax, MESSAGES.ratingRange),
  message: z.string().trim().max(LIMITS.messageMax, MESSAGES.messageTooLong),
  name: z.string().trim().max(LIMITS.nameMax, MESSAGES.nameTooLong).transform((n) => n || null),
})

export function messageError(value: string): string | null {
  return value.trim().length > LIMITS.messageMax ? MESSAGES.messageTooLong : null
}

// The form holds 0 for no stars picked, which the schema refuses. Naming it here keeps the
// browser and the server refusing the same thing in the same words.
export function ratingError(value: number): string | null {
  return value >= 1 && value <= LIMITS.ratingMax ? null : MESSAGES.ratingRequired
}

export const APPLICATION_YEARS = ['freshman', 'sophomore', 'junior', 'senior', 'other'] as const
export const APPLICATION_ROLES = ['product', 'engineering'] as const

const answer = z
  .string()
  .trim()
  .min(1, MESSAGES.answerRequired)
  .max(LIMITS.answerMax, MESSAGES.answerTooLong)

// The question a role asks is only required of someone who applied for that role, so the
// pair of answers is checked against the roles rather than on its own.
export const applicationSchema = z
  .object({
    name: z.string().trim().min(1, MESSAGES.nameRequired).max(LIMITS.nameMax, MESSAGES.nameTooLong),
    email: z.email(MESSAGES.emailFormat).max(LIMITS.emailMax, MESSAGES.emailTooLong),
    year: z.enum(APPLICATION_YEARS, MESSAGES.yearRequired),
    major: z.string().trim().min(1, MESSAGES.majorRequired).max(LIMITS.majorMax, MESSAGES.nameTooLong),
    roles: z.array(z.enum(APPLICATION_ROLES)).min(1, MESSAGES.roleRequired),
    link: z.url(MESSAGES.linkFormat).max(LIMITS.linkMax, MESSAGES.linkFormat),
    productAnswer: answer.nullable(),
    engineeringAnswer: answer.nullable(),
    hoursPerWeek: z
      .number()
      .int(MESSAGES.hoursRange)
      .min(LIMITS.hoursMin, MESSAGES.hoursRange)
      .max(LIMITS.hoursMax, MESSAGES.hoursRange),
  })
  .refine((input) => !input.roles.includes('product') || input.productAnswer !== null, {
    message: MESSAGES.answerRequired,
    path: ['productAnswer'],
  })
  .refine((input) => !input.roles.includes('engineering') || input.engineeringAnswer !== null, {
    message: MESSAGES.answerRequired,
    path: ['engineeringAnswer'],
  })

export type ApplicationInput = z.infer<typeof applicationSchema>

// A link pasted without a scheme is the common case, and the browser's url input accepts
// it only with one, so the form adds it before anything else looks at the value.
export function withScheme(link: string): string {
  const trimmed = link.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
