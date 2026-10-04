import 'server-only'

import { timingSafeEqual } from 'node:crypto'

import { createServerClient } from '@supabase/ssr'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'

import { db } from '@/lib/db'
import { DomainError } from '@/lib/errors'
import { orders, users } from '@/lib/db/schema'

export type Account = typeof users.$inferSelect

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase is not configured')
  return { url, key }
}

// The scheduled jobs carry a shared secret rather than a session. Compared in constant
// time so a wrong token cannot be found one character at a time.
export function authorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const offered = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!secret || !offered) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(offered)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function supabaseServer() {
  const store = await cookies()
  const { url, key } = config()

  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (written) => {
        try {
          for (const { name, value, options } of written) store.set(name, value, options)
        } catch {
          // Server components cannot set cookies. The callback route and middleware do that instead.
        }
      },
    },
  })
}

// Google verifies this email. That is the only reason it is safe to claim orders with it.
export async function syncAccount(identity: {
  supabaseUid: string
  email: string
  name: string | null
}): Promise<Account> {
  const [byUid] = await db.select().from(users).where(eq(users.supabaseUid, identity.supabaseUid))
  if (byUid) {
    if (byUid.email === identity.email) return byUid
    const [updated] = await db
      .update(users)
      .set({ email: identity.email })
      .where(eq(users.id, byUid.id))
      .returning()
    return updated
  }

  const [byEmail] = await db.select().from(users).where(eq(users.email, identity.email))
  if (byEmail) {
    const [linked] = await db
      .update(users)
      .set({ supabaseUid: identity.supabaseUid })
      .where(eq(users.id, byEmail.id))
      .returning()
    return linked
  }

  const [created] = await db
    .insert(users)
    .values({ supabaseUid: identity.supabaseUid, email: identity.email, name: identity.name })
    .returning()
  return created
}

// Guest orders join an account only on an exact, verified email match. Phone numbers at
// checkout are unverified, so they are never used to claim an order.
export async function claimGuestOrders(account: Account): Promise<number> {
  const claimed = await db
    .update(orders)
    .set({ userId: account.id })
    .where(and(isNull(orders.userId), sql`lower(${orders.email}) = lower(${account.email})`))
    .returning({ id: orders.id })
  return claimed.length
}

export async function currentAccount(): Promise<Account | null> {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email) return null

  const name =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null
  return syncAccount({ supabaseUid: user.id, email: user.email, name })
}

// A non-admin gets false and the page 404s, never "forbidden": no reason to advertise
// that an admin screen exists. This never creates an account; signing in does that.
export async function viewerIsAdmin(): Promise<boolean> {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) return false

  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.supabaseUid, uid))
  return row?.role === 'admin'
}

export async function currentAdmin(): Promise<Account | null> {
  const account = await currentAccount()
  return account?.role === 'admin' ? account : null
}

export async function setRole(email: string, role: 'customer' | 'admin'): Promise<Account> {
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(sql`lower(${users.email}) = lower(${email})`)
    .returning()
  if (!updated) throw new DomainError(`No account for ${email}. They must sign in once first.`)
  return updated
}

export async function updateAccount(
  accountId: string,
  patch: { name?: string | null; phone?: string | null },
): Promise<Account> {
  const [updated] = await db.update(users).set(patch).where(eq(users.id, accountId)).returning()
  return updated
}
