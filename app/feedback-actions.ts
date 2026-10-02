'use server'

import { headers } from 'next/headers'

import { callerIp, checkLimit } from '@/lib/limits'
import { leaveFeedback } from '@/lib/feedback'
import { feedbackSchema } from '@/lib/validation'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function submitFeedback(form: unknown): Promise<ActionResult> {
  try {
    // Server actions get no Request object, so the address comes from the incoming headers.
    const ip = callerIp(new Request('http://localhost', { headers: await headers() }))
    const { ok } = await checkLimit('feedback', ip)
    if (!ok) return { ok: false, error: 'Thanks — that is plenty for now. Try again later.' }

    const parsed = feedbackSchema.safeParse(form)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

    await leaveFeedback(parsed.data)
    return { ok: true }
  } catch (error) {
    console.error('feedback_failed', { error })
    return { ok: false, error: 'Something went wrong. Try again.' }
  }
}
