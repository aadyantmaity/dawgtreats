'use server'

import { removeByToken } from '@/lib/notify'

export type UnsubscribeResult = { ok: true; email: string | null } | { ok: false; error: string }

export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  try {
    // A token already used is the outcome the reader wanted, so a second press still
    // reads as success. Only a missing token is worth refusing.
    if (!token) return { ok: false, error: 'That link is missing its code.' }
    return { ok: true, email: await removeByToken(token) }
  } catch (error) {
    console.error('unsubscribe_failed', { error })
    return { ok: false, error: 'Something went wrong. Try again.' }
  }
}
