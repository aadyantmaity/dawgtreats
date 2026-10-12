import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE, POST } from '@/app/api/notify/route'
import { POST as oneClick } from '@/app/api/notify/unsubscribe/route'
import { currentAccount } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyRequests } from '@/lib/db/schema'
import { countWaiting, isWaiting, listWaiting, markNotified, removeByToken } from '@/lib/notify'

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

const drop = () => DELETE(new Request('http://localhost/api/notify', { method: 'DELETE' }))

beforeEach(async () => {
  await resetDatabase()
  signedInAs.mockResolvedValue(null)
})

describe('asking to be told when a batch opens', () => {
  it('keeps the address', async () => {
    const response = await ask({ email: 'buyer@uw.edu' })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ ok: true, already: false })
    expect(await rows()).toMatchObject([{ email: 'buyer@uw.edu', notifiedAt: null }])
  })

  it('stores one row for the same person asking twice, so they get one email', async () => {
    await ask({ email: 'twice@uw.edu' })
    const second = await ask({ email: 'twice@uw.edu' })

    // 200 and `already`, not 201: the page says "you are already on the list" rather than
    // "you are on the list", which reads as a refusal to someone who knows they asked.
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ ok: true, already: true })
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

describe('taking yourself back off the list', () => {
  it('forgets a signed-in address, and says nothing is waiting', async () => {
    signedInAs.mockResolvedValue({ email: 'mine@uw.edu' } as Awaited<ReturnType<typeof currentAccount>>)
    await ask({})
    expect(await isWaiting('mine@uw.edu')).toBe(true)

    expect((await drop()).status).toBe(200)

    expect(await rows()).toHaveLength(0)
    expect(await isWaiting('mine@uw.edu')).toBe(false)
  })

  it('refuses a stranger, so nobody can clear a list they cannot read', async () => {
    signedInAs.mockResolvedValue(null)
    await ask({ email: 'someone@uw.edu' })

    expect((await drop()).status).toBe(401)
    expect(await rows()).toHaveLength(1)
  })

  // The link in an email cannot ask for a session, so the token is the whole proof.
  it('forgets an address by the token in its email', async () => {
    signedInAs.mockResolvedValue(null)
    await ask({ email: 'reader@uw.edu' })
    const [row] = await listWaiting()

    expect(await removeByToken(row.token)).toBe('reader@uw.edu')
    expect(await rows()).toHaveLength(0)
  })

  it('ignores a token that is wrong, and keeps everyone on', async () => {
    signedInAs.mockResolvedValue(null)
    await ask({ email: 'reader@uw.edu' })

    expect(await removeByToken('not-a-real-token')).toBeNull()
    expect(await rows()).toHaveLength(1)
  })

  it('gives every row its own token', async () => {
    signedInAs.mockResolvedValue(null)
    await ask({ email: 'one@uw.edu' })
    await ask({ email: 'two@uw.edu' })

    const tokens = (await listWaiting()).map((row) => row.token)
    expect(new Set(tokens).size).toBe(2)
    expect(tokens.every((token) => token.length > 0)).toBe(true)
  })

  it('answers a mail client that unsubscribes on its own', async () => {
    signedInAs.mockResolvedValue(null)
    await ask({ email: 'reader@uw.edu' })
    const [row] = await listWaiting()

    const response = await oneClick(
      new Request(`http://localhost/api/notify/unsubscribe?t=${row.token}`, { method: 'POST' }),
    )

    expect(response.status).toBe(204)
    expect(await rows()).toHaveLength(0)
  })
})

describe('asking again after being told', () => {
  // Without this, the second batch never reaches anyone who was told about the first.
  it('puts someone back on the list', async () => {
    signedInAs.mockResolvedValue(null)
    await ask({ email: 'again@uw.edu' })
    await markNotified((await listWaiting()).map((row) => row.id))
    expect(await countWaiting()).toBe(0)

    await ask({ email: 'again@uw.edu' })

    expect(await countWaiting()).toBe(1)
    expect(await rows()).toHaveLength(1)
  })
})
