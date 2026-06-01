import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAnyPageAccess } from "@/lib/supabase/auth-server"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer", "social", "employees"])
  if (auth.response) return auth.response

  const { id } = await params
  const body = await request.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("account_pairs")
    .update(body)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer", "social", "employees"])
  if (auth.response) return auth.response

  const { id } = await params
  const supabase = createServerClient()

  const { error } = await supabase
    .from("account_pairs")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
