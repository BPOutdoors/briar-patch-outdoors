import { createClient } from '@supabase/supabase-js'

// Lazy singleton — client is only created on first access, not at module load time.
// This prevents "supabaseUrl is required" errors during Next.js static build analysis.
let _client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getClient() as any)[prop]
  },
})
