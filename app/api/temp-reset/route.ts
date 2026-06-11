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

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: 'BriarPatch2024!'
  })

  if (error) return NextResponse.json({ error: error.message })
  return NextResponse.json({ success: true, email: user.email, newPassword: 'BriarPatch2024!' })
}
