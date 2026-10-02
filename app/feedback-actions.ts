'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { DomainError } from '@/lib/errors'
import { callerIp, checkLimit } from '@/lib/limits'
import { askFor, leaveReview } from '@/lib/reviews'
import { requestSchema, reviewSchema } from '@/lib/validation'

// Server actions get no Request object, so the address comes from the incoming headers.
async function limited(name: 'review' | 'request'): Promise<boolean> {
  const list = await headers()
  const ip = callerIp(new Request('http://localhost', { headers: list }))
  const { ok } = await checkLimit(name === 'review' ? 'review' : 'request', ip)
  return !ok
}

export type ActionResult = { ok: true } | { ok: false; error: string }

function failed(error: unknown): ActionResult {
  if (error instanceof DomainError) return { ok: false, error: error.message }
  console.error('feedback_failed', { error })
  return { ok: false, error: 'Something went wrong. Try again.' }
}

export async function submitReview(orderCode: string, form: unknown): Promise<ActionResult> {
  try {
    if (await limited('review')) return { ok: false, error: 'Too many tries. Wait a minute.' }
    const parsed = reviewSchema.parse(form)
    await leaveReview(orderCode, parsed)
    revalidatePath(`/order/${orderCode}`)
    return { ok: true }
  } catch (error) {
    return failed(error)
  }
}

export async function submitRequest(form: unknown): Promise<ActionResult> {
  try {
    if (await limited('request')) return { ok: false, error: 'Too many tries. Wait a minute.' }
    const parsed = requestSchema.parse(form)
    await askFor(parsed)
    return { ok: true }
  } catch (error) {
    return failed(error)
  }
}
