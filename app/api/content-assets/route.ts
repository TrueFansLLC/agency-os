import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

const BUCKET = "content-assets"
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const ASSET_STATUSES = ["saved", "ready", "assigned", "used", "archived"]
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

async function withSignedUrls(
  supabase: ReturnType<typeof createServerClient>,
  assets: Record<string, unknown>[]
) {
  const paths = assets.map(asset => asset.storage_path).filter((path): path is string => typeof path === "string")
  if (!paths.length) return assets

  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
  const signedUrls = new Map((data ?? []).map(item => [item.path, item.signedUrl]))
  return assets.map(asset => ({ ...asset, signed_preview_url: signedUrls.get(asset.storage_path as string) ?? null }))
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const { searchParams } = new URL(request.url)
  const creator = searchParams.get("creator")
  const status = searchParams.get("status")
  const supabase = createServerClient()
  let query = supabase
    .from("content_assets")
    .select("id,generation_id,creator,source,status,storage_path,source_url,source_label,prompt,used_at,created_at,updated_at,pack_assets:content_pack_assets(pack_id)")
    .order("created_at", { ascending: false })

  if (creator && creator !== "all") query = query.eq("creator", creator)
  if (status && status !== "all") query = query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assets: await withSignedUrls(supabase, data ?? []) })
}

export async function POST(request: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const generationId = typeof body.generation_id === "string" ? body.generation_id : ""
  if (!generationId) return NextResponse.json({ error: "generation_id required" }, { status: 400 })

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from("content_assets")
    .select("id,status,storage_path")
    .eq("generation_id", generationId)
    .maybeSingle()
  if (existing) return NextResponse.json(existing)

  const { data: generation, error: generationError } = await supabase
    .from("threads_generations")
    .select("id,creator,source_label,prompt,image_url,status")
    .eq("id", generationId)
    .maybeSingle()
  if (generationError) return NextResponse.json({ error: generationError.message }, { status: 500 })
  if (!generation?.image_url || generation.status !== "pending") {
    return NextResponse.json({ error: "generation is not ready to save" }, { status: 400 })
  }

  const imageResponse = await fetch(generation.image_url)
  if (!imageResponse.ok) return NextResponse.json({ error: "generated image could not be downloaded" }, { status: 502 })

  const contentType = imageResponse.headers.get("content-type")?.split(";")[0] ?? ""
  const extension = EXTENSION[contentType]
  if (!extension) return NextResponse.json({ error: "generated image type is not supported" }, { status: 415 })

  const image = await imageResponse.arrayBuffer()
  if (image.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: "generated image exceeds the 15 MB storage limit" }, { status: 413 })

  const month = new Date().toISOString().slice(0, 7)
  const storagePath = `${generation.creator.toLowerCase()}/${month}/${generation.id}.${extension}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, image, {
    contentType,
    upsert: false,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: asset, error: assetError } = await supabase
    .from("content_assets")
    .insert({
      generation_id: generation.id,
      creator: generation.creator,
      source: "generated",
      status: "saved",
      storage_path: storagePath,
      source_url: generation.image_url,
      source_label: generation.source_label,
      prompt: generation.prompt,
    })
    .select("id,status,storage_path")
    .single()
  if (assetError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: assetError.message }, { status: 500 })
  }

  return NextResponse.json(asset, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : []
  const status = typeof body.status === "string" ? body.status : ""
  if (!ids.length || !ASSET_STATUSES.includes(status)) {
    return NextResponse.json({ error: "ids[] and a valid status are required" }, { status: 400 })
  }

  const supabase = createServerClient()
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === "used") updates.used_at = new Date().toISOString()

  const { error } = await supabase.from("content_assets").update(updates).in("id", ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated: ids.length })
}
