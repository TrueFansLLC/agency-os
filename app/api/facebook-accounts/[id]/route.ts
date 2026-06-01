import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAnyPageAccess } from "@/lib/supabase/auth-server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAnyPageAccess(["social"])
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { id }   = await params
  const body     = await request.json()

  if (body.archived === true) {
    const { error } = await supabase
      .from("facebook_accounts")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  let creatorId: string | null = null
  if (body.creatorName?.trim()) {
    const { data: creator, error } = await supabase
      .from("creators")
      .upsert({ name: body.creatorName.trim() }, { onConflict: "name" })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    creatorId = creator.id
  }

  let marketId: string | null = null
  if (body.market?.trim()) {
    const { data: market, error } = await supabase
      .from("markets")
      .upsert({ name: body.market.trim() }, { onConflict: "name" })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    marketId = market.id
  }

  const handle = (body.pageHandle ?? "").trim().replace(/^@/, "")

  const { error } = await supabase
    .from("facebook_accounts")
    .update({
      page_handle:       handle || undefined,
      page_name:         body.pageName?.trim()   ?? undefined,
      creator_id:        creatorId               ?? undefined,
      market_id:         marketId                ?? undefined,
      status:            body.status             ?? undefined,
      connection_status: body.connectionStatus   ?? undefined,
      performance_label: body.performanceLabel   ?? undefined,
      notes:             body.notes              ?? undefined,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
