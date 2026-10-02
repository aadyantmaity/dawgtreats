import 'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Vercel sets this itself and strips what the caller sent, unlike x-forwarded-for,
// whose left-most entry a caller can forge.
export function callerIp(request: Request): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ??
    'local'
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
} as const

export type LimitName = keyof typeof limiters

export async function checkLimit(
  name: LimitName,
  key: string,
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
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
