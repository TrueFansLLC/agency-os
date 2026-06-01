import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminUser } from "@/lib/supabase/auth-server"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — list all employees (role = 'employee')
export async function GET() {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = adminClient()
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const employees = users
    .filter(u => u.user_metadata?.role === "employee")
    .map(u => ({
      id:            u.id,
      email:         u.email,
      name:          u.user_metadata?.name ?? u.email,
      allowed_pages: (u.user_metadata?.allowed_pages ?? []) as string[],
      created_at:    u.created_at,
      last_sign_in:  u.last_sign_in_at,
    }))

  return NextResponse.json(employees)
}

// PATCH — update allowed_pages for a user
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const { userId, allowed_pages } = await request.json()
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const supabase = adminClient()
  const { data: { user }, error: fetchErr } = await supabase.auth.admin.getUserById(userId)
  if (fetchErr || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { ...user.user_metadata, allowed_pages },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — remove a user
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const supabase = adminClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
