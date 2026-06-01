import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAnyPageAccess } from "@/lib/supabase/auth-server"
import { normalizeThreadsAccountAssignment } from "@/lib/threads-employees"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer"])
  if (auth.response) return auth.response

  const { id } = await params
  const body = await request.json()
  const supabase = createServerClient()
  let payload
  try {
    payload = await normalizeThreadsAccountAssignment(supabase, body)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ungültige Mitarbeiter-Zuordnung." },
      { status: 400 }
    )
  }
  const { data, error } = await supabase
    .from("threads_accounts")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer"])
  if (auth.response) return auth.response

  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from("threads_accounts").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
