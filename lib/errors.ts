import * as Sentry from '@sentry/nextjs'
import type { z } from 'zod'

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 502 | 503 = 409,
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
  // A DomainError is the answer to a question, not a fault: "snickerdoodle sold out" is
  // the route working. Only the unexpected ones are worth waking anyone for.
  if (error instanceof DomainError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error(`[${context}]`, error)
  // Without this a route that throws is invisible: the catch returns a tidy 500 and the
  // only trace is a log nobody reads. Analytics died for a day that way.
  Sentry.captureException(error, { tags: { context } })
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}

export function messageFromBody(data: unknown, fallback: string): string {
  return data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback
}
