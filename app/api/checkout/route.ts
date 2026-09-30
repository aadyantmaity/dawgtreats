import { errorResponse, parseBody } from '@/lib/errors'
import { reserve } from '@/lib/orders'
import { checkoutSchema } from '@/lib/validation'

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, checkoutSchema)
    return Response.json(await reserve(input), { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/checkout')
  }
}
