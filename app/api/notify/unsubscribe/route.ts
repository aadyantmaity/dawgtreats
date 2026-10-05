import { errorResponse } from '@/lib/errors'
import { removeByToken } from '@/lib/notify'

// The address in the List-Unsubscribe header of an open notice. A mail client posts here
// on its own, with no page and no session, so the token in the query is the whole proof.
export async function POST(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('t')
    if (token) await removeByToken(token)
    // A token that is already gone is the outcome the sender wanted, so it is not an error.
    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error, 'POST /api/notify/unsubscribe')
  }
}
