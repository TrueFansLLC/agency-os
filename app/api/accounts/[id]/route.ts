import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// ── PATCH /api/accounts/[id] ──────────────────────────────────────
// Handles both edit and archive. Send only the fields to update.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient()
  const { id } = await params
  const body = await request.json()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Handle creator update
  if (body.creatorName !== undefined) {
    const { data: creator } = await supabase
      .from("creators")
      .upsert({ name: body.creatorName.trim() }, { onConflict: "name" })
      .select("id")
      .single()
    if (creator) updates.creator_id = creator.id
  }

  // Handle market update
  if (body.market !== undefined) {
    const { data: market } = await supabase
      .from("markets")
      .upsert({ name: body.market.trim() }, { onConflict: "name" })
      .select("id")
      .single()
    if (market) updates.market_id = market.id
  }

  if (body.username          !== undefined) updates.username          = body.username
  if (body.fbUsername        !== undefined) updates.fb_username       = body.fbUsername || null
  if (body.status            !== undefined) updates.status            = body.status
  if (body.connectionStatus  !== undefined) updates.connection_status = body.connectionStatus
  if (body.dataSource        !== undefined) updates.data_source       = body.dataSource
  if (body.performanceLabel  !== undefined) updates.performance_label = body.performanceLabel
  if (body.notes             !== undefined) updates.notes             = body.notes
  if (body.archived          !== undefined) updates.archived          = body.archived

  const { error } = await supabase
    .from("instagram_accounts")
    .update(updates)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
