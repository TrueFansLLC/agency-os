import { createClient } from "@supabase/supabase-js"

// Server-side client — uses the service role key (never sent to the browser)
// Only import this file inside app/api/** routes or server components.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
