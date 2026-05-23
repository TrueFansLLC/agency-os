import { createClient } from "@supabase/supabase-js"

// Browser-side client — uses the anon key (safe to expose)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
