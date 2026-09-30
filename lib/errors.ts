import type { z } from 'zod'

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 409,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await request.json().catch(() => undefined)
  const result = schema.safeParse(body)
  if (!result.success) throw new DomainError(result.error.issues[0].message, 400)
  return result.data
}

export function errorResponse(error: unknown, context: string): Response {
  if (error instanceof DomainError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error(`[${context}]`, error)
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}
