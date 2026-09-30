import { z } from 'zod'

import { formatCents, parsePriceCents } from '@/lib/money'

export const LIMITS = {
  nameMax: 60,
  descriptionMax: 200,
  priceMaxCents: 10000,
  quantityMax: 1000,
  perFlavorMax: 24,
  perOrderMax: 24,
} as const

const MESSAGES = {
  nameRequired: 'Name is required',
  nameTooLong: `Name must be ${LIMITS.nameMax} characters or fewer`,
  descriptionTooLong: `Description must be ${LIMITS.descriptionMax} characters or fewer`,
  priceRequired: 'Price is required',
  priceFormat: 'Enter a price like 3.50',
  priceZero: 'Price must be more than $0',
  priceTooHigh: `Price must be ${formatCents(LIMITS.priceMaxCents)} or less`,
  quantityWhole: 'Quantities must be whole numbers',
  quantityTooHigh: `Quantities must be ${LIMITS.quantityMax} or fewer`,
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
})

export const quantitySchema = z
  .int(MESSAGES.quantityWhole)
  .min(0, 'Quantities can’t be negative')
  .max(LIMITS.quantityMax, MESSAGES.quantityTooHigh)

// Keystroke filters: return the value to keep, or null to reject the keystroke.
export function filterPriceInput(raw: string): string | null {
  const value = raw.replace(/^\$/, '')
  return /^\d{0,3}(\.\d{0,2})?$/.test(value) ? value : null
}

export function nameError(value: string): string | null {
  return value.trim() ? null : MESSAGES.nameRequired
}

export function priceError(value: string): string | null {
  if (!value.trim()) return MESSAGES.priceRequired
  const cents = parsePriceCents(value)
  if (cents === null) return MESSAGES.priceFormat
  if (cents < 1) return MESSAGES.priceZero
  if (cents > LIMITS.priceMaxCents) return MESSAGES.priceTooHigh
  return null
}

// An empty box means 0; the stepper puts the minimum back when the field is left.
export function quantityError(value: string, sold: number): string | null {
  const quantity = Number(value || '0')
  if (quantity > LIMITS.quantityMax) return MESSAGES.quantityTooHigh
  if (quantity < sold) return `Can’t go below ${sold}: that many are already sold or held`
  return null
}

const contact = {
  name: z.string().trim().min(1, 'Your name is required').max(LIMITS.nameMax, MESSAGES.nameTooLong),
  email: z.email('That email address does not look right').max(120, 'That email address is too long'),
  phone: z
    .string()
    .trim()
    .min(7, 'A phone number helps us find you at pickup')
    .max(20, 'That phone number is too long'),
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
