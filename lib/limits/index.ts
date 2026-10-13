import 'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { reportIssue } from '@/lib/errors'

// Vercel sets this itself and strips what the caller sent, unlike x-forwarded-for,
// whose left-most entry a caller can forge. Null means nothing here names the caller.
export function callerIp(request: Request): string | null {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ??
    null
  )
}

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? new Redis({ url, token }) : null
})()

function limiter(name: string, limit: number, window: `${number} ${'s' | 'm'}`) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `dawgtreats:${name}`,
    analytics: false,
  })
}

// Reserving holds real cookies for 30 minutes, so this is the expensive one to leave
// open: a loop could keep a whole week sold out without ever paying for anything.
const limiters = {
  checkout: limiter('checkout', 5, '10 m'),
  lookup: limiter('lookup', 20, '1 m'),
  // An unauthenticated public write, so a spam box without a limit.
  feedback: limiter('feedback', 5, '10 m'),
  // One visit fires four of these at most. The ceiling only stops a flood.
  events: limiter('events', 40, '10 m'),
  // An unauthenticated public write, the same shape as feedback.
  notify: limiter('notify', 5, '10 m'),
  // Changing a pickup time is a public write guarded only by the order code.
  slot: limiter('slot', 10, '10 m'),
} as const

export type LimitName = keyof typeof limiters

let reportedMissingCaller = false

export async function checkLimit(
  name: LimitName,
  key: string | null,
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  // An unnamed caller counts against nobody. One shared bucket would spend the whole
  // site's allowance on the first few requests and then refuse every customer at once.
  if (!key) {
    // Every request would report, so the first one carries the news and the log keeps
    // the rest. A flood of identical events costs the quota the real faults need.
    if (!reportedMissingCaller) {
      reportedMissingCaller = true
      reportIssue('rate_limit_without_caller', { name })
    } else {
      console.error('rate_limit_without_caller', { name })
    }
    return { ok: true, retryAfterSeconds: 0 }
  }

  const rate = limiters[name]
  // Nothing configured (local dev, tests): let the request through rather than block
  // every customer because a side service is missing.
  if (!rate) return { ok: true, retryAfterSeconds: 0 }

  try {
    const { success, reset } = await rate.limit(key)
    return { ok: success, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
  } catch (error) {
    console.error('rate_limit_unavailable', { name, error })
    return { ok: true, retryAfterSeconds: 0 }
  }
}

export function tooMany(message: string, retryAfterSeconds: number): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )
}
