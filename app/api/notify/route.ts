import { currentAccount } from '@/lib/auth'
import { errorResponse, parseBody } from '@/lib/errors'
import { callerIp, checkLimit, tooMany } from '@/lib/limits'
import { addNotifyRequest, removeNotifyRequest } from '@/lib/notify'
import { notifySchema } from '@/lib/validation'

export async function DELETE(request: Request) {
  const limit = await checkLimit('notify', callerIp(request))
  if (!limit.ok) return tooMany('Too many tries. Wait a few minutes.', limit.retryAfterSeconds)

  try {
    // Only a signed-in person can take an address off by name. Everyone else uses the
    // token in their email, which proves they can read that inbox.
    const account = await currentAccount()
    if (!account) return Response.json({ error: 'Sign in first.' }, { status: 401 })
    await removeNotifyRequest(account.email)
    return Response.json({ ok: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/notify')
  }
}

export async function POST(request: Request) {
  const limit = await checkLimit('notify', callerIp(request))
  if (!limit.ok) return tooMany('Too many tries. Wait a few minutes.', limit.retryAfterSeconds)

  try {
    // Taken from the session when there is one, so a signed-in person cannot add
    // somebody else's address by editing the request.
    const account = await currentAccount()
    const email = account ? account.email : (await parseBody(request, notifySchema)).email
    await addNotifyRequest(email)
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/notify')
  }
}
