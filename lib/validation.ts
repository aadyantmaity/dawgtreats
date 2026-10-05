import { z } from 'zod'

import { formatCents } from '@/lib/money'

export const LIMITS = {
  nameMax: 60,
  descriptionMax: 200,
  priceMaxCents: 10000,
  quantityMax: 1000,
  perFlavorMax: 24,
  perOrderMax: 24,
  messageMax: 500,
} as const

const MESSAGES = {
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
  phoneRequired: 'Phone number is required',
  phoneFormat: 'Enter a 10-digit phone number',
  messageRequired: 'Say something first',
  messageTooLong: `Keep it to ${LIMITS.messageMax} characters or fewer`,
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

export const eventSchema = z.object({
  name: z.enum(EVENTS),
  visitorId: z.string().trim().min(8).max(64),
  detail: z.string().trim().max(60).optional(),
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

// Stored as digits, so every number looks the same. The form shows (425) 515-4457.
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
  email: z.email(MESSAGES.emailFormat).max(120, 'That email address is too long'),
  phone: phoneSchema,
}

export const checkoutSchema = z.object({
  ...contact,
  pickupSlotId: z.uuid('Choose a pickup time'),
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
  rating: z
    .union([z.int().min(1).max(5), z.literal(0), z.null()])
    .transform((r) => (r === 0 ? null : r)),
  message: z
    .string()
    .trim()
    .min(1, MESSAGES.messageRequired)
    .max(LIMITS.messageMax, MESSAGES.messageTooLong),
  name: z.string().trim().max(LIMITS.nameMax, MESSAGES.nameTooLong).transform((n) => n || null),
})

export function messageError(value: string): string | null {
  if (!value.trim()) return MESSAGES.messageRequired
  return value.trim().length > LIMITS.messageMax ? MESSAGES.messageTooLong : null
}
