import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

const BUCKET = "content-assets"
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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
