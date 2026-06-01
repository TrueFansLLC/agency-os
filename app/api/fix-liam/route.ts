import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// TEMPORARY one-off: restore Liam's dashboard access. Remove after use.
const TOKEN = "Lm5Fix9Wq2Zx7Rb4Nc8Vd1Hf6Yg3Sk0"
const EMAIL = "liambulut@gmail.com"

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get("t") !== TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServerClient()

  let target: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null
  for (let page = 1; page <= 15 && !target; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    target = data.users.find(u => u.email?.toLowerCase() === EMAIL) ?? null
    if (!data.users.length) break
  }

  if (!target) return NextResponse.json({ found: false, message: "Liam user not found — needs a fresh invite" })

  const before = target.user_metadata ?? {}
  const { error: upErr } = await supabase.auth.admin.updateUserById(target.id, {
    user_metadata: { ...before, role: "admin" },
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ found: true, email: target.email, new_role: "admin", before })
}
