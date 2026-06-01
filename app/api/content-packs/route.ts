import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

const PACK_TYPES = ["starter", "daily", "reusable"]

export async function GET() {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("content_packs")
    .select("id,name,creator,pack_type,status,drive_folder_url,notes,created_at,updated_at,assets:content_pack_assets(asset_id)")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    packs: (data ?? []).map(pack => ({ ...pack, asset_count: pack.assets.length })),
  })
}

export async function POST(request: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const creator = typeof body.creator === "string" && body.creator !== "all" ? body.creator : null
  const packType = typeof body.pack_type === "string" ? body.pack_type : "starter"
  const assetIds = Array.isArray(body.asset_ids)
    ? body.asset_ids.filter((id: unknown): id is string => typeof id === "string")
    : []

  if (!name || !assetIds.length || !PACK_TYPES.includes(packType)) {
    return NextResponse.json({ error: "name, asset_ids[] and a valid pack_type are required" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: pack, error: packError } = await supabase
    .from("content_packs")
    .insert({ name, creator, pack_type: packType, status: "draft" })
    .select("id,name,creator,pack_type,status,created_at")
    .single()
  if (packError) return NextResponse.json({ error: packError.message }, { status: 500 })

  const { error: assetsError } = await supabase
    .from("content_pack_assets")
    .insert(assetIds.map((assetId: string, position: number) => ({ pack_id: pack.id, asset_id: assetId, position })))
  if (assetsError) {
    await supabase.from("content_packs").delete().eq("id", pack.id)
    return NextResponse.json({ error: assetsError.message }, { status: 500 })
  }

  await supabase
    .from("content_assets")
    .update({ status: "assigned", updated_at: new Date().toISOString() })
    .in("id", assetIds)
    .in("status", ["saved", "ready"])

  return NextResponse.json({ ...pack, asset_count: assetIds.length }, { status: 201 })
}
