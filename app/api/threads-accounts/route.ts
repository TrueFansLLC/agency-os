import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAnyPageAccess } from "@/lib/supabase/auth-server"
import { normalizeThreadsAccountAssignment } from "@/lib/threads-employees"

export async function GET(request: NextRequest) {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer"])
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const archived = searchParams.get("archived") === "1"
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("threads_accounts")
    .select("*")
    .eq("archived", archived)
    .order("creator")
    .order("username")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer"])
  if (auth.response) return auth.response

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
    .insert([payload])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
