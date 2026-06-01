import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser, requireAnyPageAccess } from "@/lib/supabase/auth-server"

export async function GET() {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer", "employees"])
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const body = await request.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("employees")
    .insert([body])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
