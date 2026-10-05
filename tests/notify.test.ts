import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/notify/route'
import { currentAccount } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyRequests } from '@/lib/db/schema'
import { countWaiting, listWaiting, markNotified } from '@/lib/notify'

import { resetDatabase } from './helpers'

// The only mock here: the route asks who is signed in, and a real session would mean
// standing up Supabase. Everything else runs against the database.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, currentAccount: vi.fn() }
})

const signedInAs = vi.mocked(currentAccount)

function ask(body: unknown) {
  return POST(
    new Request('http://localhost/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

const rows = () => db.select().from(notifyRequests)

beforeEach(async () => {
  await resetDatabase()
  signedInAs.mockResolvedValue(null)
})

describe('asking to be told when a batch opens', () => {
  it('keeps the address', async () => {
    const response = await ask({ email: 'buyer@uw.edu' })

    expect(response.status).toBe(201)
    expect(await rows()).toMatchObject([{ email: 'buyer@uw.edu', notifiedAt: null }])
  })

  it('stores one row for the same person asking twice, so they get one email', async () => {
    await ask({ email: 'twice@uw.edu' })
    const second = await ask({ email: 'twice@uw.edu' })

    expect(second.status).toBe(201)
    expect(await rows()).toHaveLength(1)
  })

  it('treats a differently typed address as the same person', async () => {
    await ask({ email: 'Mixed@UW.edu' })
    await ask({ email: '  mixed@uw.edu ' })

    expect(await rows()).toHaveLength(1)
    expect((await rows())[0].email).toBe('mixed@uw.edu')
  })

  it('refuses something that is not an address, and keeps nothing', async () => {
    const response = await ask({ email: 'not-an-address' })

    expect(response.status).toBe(400)
    expect(await rows()).toHaveLength(0)
  })
})

describe('the waiting list', () => {
  it('drops someone once they have been told, so they are not told again', async () => {
    await ask({ email: 'first@uw.edu' })
    await ask({ email: 'second@uw.edu' })
    expect(await countWaiting()).toBe(2)

    const waiting = await listWaiting()
    await markNotified([waiting[0].id])

    expect(await countWaiting()).toBe(1)
    expect((await listWaiting()).map((row) => row.email)).toEqual(['second@uw.edu'])
  })
})

describe('someone who is already signed in', () => {
  it('is added by their own address, not one the request carried', async () => {
    signedInAs.mockResolvedValue({ email: 'mine@uw.edu' } as Awaited<ReturnType<typeof currentAccount>>)

    const response = await ask({ email: 'someone.else@uw.edu' })

    expect(response.status).toBe(201)
    expect((await rows()).map((row) => row.email)).toEqual(['mine@uw.edu'])
  })

  it('needs no address in the request at all', async () => {
    signedInAs.mockResolvedValue({ email: 'mine@uw.edu' } as Awaited<ReturnType<typeof currentAccount>>)

    const response = await ask({})

    expect(response.status).toBe(201)
    expect((await rows()).map((row) => row.email)).toEqual(['mine@uw.edu'])
  })
})
