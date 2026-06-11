import { createClient } from '@supabase/supabase-js'

// Fallback placeholders prevent "supabaseUrl is required" during Next.js static
// build analysis. At runtime the real env vars are always present.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
)
