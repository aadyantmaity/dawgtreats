import { recordEvent } from '@/lib/analytics'
import { errorResponse, parseBody } from '@/lib/errors'
import { callerIp, checkLimit, tooMany } from '@/lib/limits'
import { eventSchema } from '@/lib/validation'
import { getOrderableWeek } from '@/lib/weeks'

// Counting must never slow a page down, so nothing here is returned to the browser.
export async function POST(request: Request) {
  const limit = await checkLimit('events', callerIp(request))
  if (!limit.ok) return tooMany('Too many events.', limit.retryAfterSeconds)

  try {
    const input = await parseBody(request, eventSchema)
    const week = await getOrderableWeek()
    await recordEvent({
      name: input.name,
      visitorId: input.visitorId,
      weekId: week?.id ?? null,
      detail: input.detail ?? null,
    })
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error, 'POST /api/events')
  }
}
