import { claimGuestOrders, currentAccount, redirectTo, supabaseServer } from '@/lib/auth'

// Where Google sends people back. Only relative paths, so this cannot bounce them off-site.
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

  if (!code) return redirectTo('/?signin=failed')

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth callback]', error.message)
    return redirectTo('/?signin=failed')
  }

  const account = await currentAccount()
  if (account) {
    const claimed = await claimGuestOrders(account)
    if (claimed > 0) console.log('orders_claimed', { accountId: account.id, claimed })
  }

  return redirectTo(next)
}
