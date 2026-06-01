import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const { email, name, allowed_pages } = await request.json()

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agency-os-q29n.vercel.app"
  const redirectTo = `${siteUrl}/auth/callback?next=/set-password`
  const metadata   = { name: name ?? email, role: "employee", allowed_pages: allowed_pages ?? ["posting-planer"] }

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: metadata })

  if (error) {
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existing = users.find(u => u.email === email)

    if (existing) {
      await supabase.auth.admin.deleteUser(existing.id)
      const { error: retryError } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: metadata })
      if (retryError) return NextResponse.json({ error: retryError.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
