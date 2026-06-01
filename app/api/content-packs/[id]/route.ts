import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

const PACK_STATUSES = ["draft", "ready", "exported", "used", "archived"]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const status = typeof body.status === "string" ? body.status : ""
  if (!PACK_STATUSES.includes(status)) {
    return NextResponse.json({ error: "valid status required" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("content_packs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,name,creator,pack_type,status,drive_folder_url,notes,created_at,updated_at")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
