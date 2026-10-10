import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DomainError, errorResponse } from '@/lib/errors'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const captured = vi.mocked(Sentry.captureException)

beforeEach(() => {
  captured.mockClear()
})

describe('what reaches Sentry', () => {
  // "Snickerdoodle sold out" is the route working, not a fault. Reporting those buries
  // the real faults under noise until nobody reads the alerts.
  it('stays quiet about an expected refusal', () => {
    const response = errorResponse(new DomainError('Snickerdoodle just sold out', 409), 'test')

    expect(response.status).toBe(409)
    expect(captured).not.toHaveBeenCalled()
  })

  // A route that throws used to return a tidy 500 and tell nobody, which is how the
  // analytics insert failed for a day without anyone noticing.
  it('reports anything unexpected, with the route that threw', () => {
    const boom = new Error('column "device" does not exist')

    const response = errorResponse(boom, 'POST /api/events')

    expect(response.status).toBe(500)
    expect(captured).toHaveBeenCalledWith(boom, { tags: { context: 'POST /api/events' } })
  })

  it('keeps the message a customer sees free of the fault', async () => {
    const response = errorResponse(new Error('connect ECONNREFUSED 10.0.0.1:5432'), 'test')

    expect(await response.json()).toEqual({ error: 'Something went wrong. Please try again.' })
  })
})
