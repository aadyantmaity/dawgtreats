import { z } from 'zod'

import { currentAccount, updateAccount } from '@/lib/auth'
import { DomainError, errorResponse, parseBody } from '@/lib/errors'
import { LIMITS, phoneDigits } from '@/lib/validation'

const patchSchema = z.object({
  name: z.string().trim().max(LIMITS.nameMax, `Name must be ${LIMITS.nameMax} characters or fewer`),
  phone: z
    .string()
    .transform(phoneDigits)
    .refine((digits) => digits === '' || digits.length === 10, 'Enter a 10-digit phone number'),
})

export async function PATCH(request: Request) {
  try {
    const account = await currentAccount()
    if (!account) throw new DomainError('Sign in first', 404)

    const patch = await parseBody(request, patchSchema)
    const saved = await updateAccount(account.id, {
      name: patch.name || null,
      phone: patch.phone || null,
    })
    return Response.json({ name: saved.name, phone: saved.phone })
  } catch (error) {
    return errorResponse(error, 'PATCH /api/me')
  }
}
