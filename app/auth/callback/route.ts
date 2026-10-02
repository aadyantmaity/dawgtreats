import { NextResponse } from 'next/server'

import { claimGuestOrders, currentAccount, supabaseServer } from '@/lib/auth'

// Where Google sends people back. Only relative paths, so this cannot bounce them off-site.
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

  if (!code) return NextResponse.redirect(new URL('/?signin=failed', url.origin))

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth callback]', error.message)
    return NextResponse.redirect(new URL('/?signin=failed', url.origin))
  }

  const account = await currentAccount()
  if (account) {
    const claimed = await claimGuestOrders(account)
    if (claimed > 0) console.log('orders_claimed', { accountId: account.id, claimed })
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
