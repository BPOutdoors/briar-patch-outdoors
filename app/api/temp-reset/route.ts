import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: users } = await supabase.auth.admin.listUsers()
  const user = users?.users?.[0]
  if (!user) return NextResponse.json({ error: 'No user found' })

  // Reset password
  const { error: resetError } = await supabase.auth.admin.updateUserById(user.id, {
    password: 'BriarPatch2024!',
    email_confirm: true,
  })
  if (resetError) return NextResponse.json({ resetError: resetError.message })

  // Test sign-in with anon key
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: user.email!,
    password: 'BriarPatch2024!',
  })

  return NextResponse.json({
    email: user.email,
    emailConfirmed: user.email_confirmed_at,
    resetError: resetError ?? null,
    signInSuccess: !!signInData.session,
    signInError: signInError?.message ?? null,
  })
}
