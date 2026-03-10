import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anonKey)

// Server-side with service key for full access
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  return createClient(url, serviceKey)
}
