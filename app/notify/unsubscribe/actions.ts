'use server'

import { removeByToken } from '@/lib/notify'

export type UnsubscribeResult = { ok: true; email: string | null } | { ok: false; error: string }

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  try {
    // A token already used is the outcome the reader wanted, so a second press still
    // reads as success. A token that was never one at all is a link the mail client cut
    // short, and telling that reader they are off the list would be a lie.
    if (!token) return { ok: false, error: 'That link is missing its code.' }
    if (!TOKEN.test(token)) {
      return {
        ok: false,
        error: 'That link looks cut short. Open it again from the email, or reply and I will take you off.',
      }
    }
    return { ok: true, email: await removeByToken(token) }
  } catch (error) {
    console.error('unsubscribe_failed', { error })
    return { ok: false, error: 'Something went wrong. Try again.' }
  }
}
