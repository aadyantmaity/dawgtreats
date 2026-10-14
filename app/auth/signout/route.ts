import { revalidatePath } from 'next/cache'

import { redirectTo, supabaseServer } from '@/lib/auth'

export async function POST() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  // Every page is rendered against whoever is signed in, so the whole tree goes, not
  // just the one being left.
  revalidatePath('/', 'layout')
  return redirectTo('/')
}
