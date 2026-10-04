import { addNotifyRequest } from '@/lib/notify'
import { errorResponse, parseBody } from '@/lib/errors'
import { callerIp, checkLimit, tooMany } from '@/lib/limits'
import { notifySchema } from '@/lib/validation'

export async function POST(request: Request) {
  const limit = await checkLimit('notify', callerIp(request))
  if (!limit.ok) return tooMany('Too many tries. Wait a few minutes.', limit.retryAfterSeconds)

  try {
    const { email } = await parseBody(request, notifySchema)
    await addNotifyRequest(email)
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/notify')
  }
}
