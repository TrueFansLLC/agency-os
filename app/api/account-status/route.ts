import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

export async function GET() {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("account_pairs")
    .select("id, ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter, status, status_since, status_note")
    .order("status", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase
    .from("account_pairs")
    .update({ status: "active", status_since: null, status_note: null })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
