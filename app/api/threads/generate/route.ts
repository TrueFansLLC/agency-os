import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { creatorRefUrls } from "@/lib/creator-refs"
import { isAdminUser, isTokenAuthorized } from "@/lib/supabase/auth-server"

export const maxDuration = 60

const TOKEN  = process.env.THREADS_GENERATE_TOKEN ?? ""
const FAL_KEY = process.env.FAL_KEY ?? ""
const SEEDREAM_EDIT = "fal-ai/bytedance/seedream/v4.5/edit"
const MAX_REFERENCE_IMAGE_LENGTH = 2_500_000
const IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,/

async function canGenerate(request: Request) {
  return isTokenAuthorized(request, TOKEN) || await isAdminUser()
}

async function withSavedAssets(
  supabase: ReturnType<typeof createServerClient>,
  generations: Record<string, unknown>[]
) {
  const ids = generations.map(generation => generation.id).filter((id): id is string => typeof id === "string")
  if (!ids.length) return generations

  const { data: assets } = await supabase
    .from("content_assets")
    .select("id,generation_id,status")
    .in("generation_id", ids)
  const saved = new Map((assets ?? []).map(asset => [asset.generation_id, asset]))
  return generations.map(generation => {
    const asset = saved.get(generation.id as string)
    return { ...generation, saved_asset_id: asset?.id ?? null, asset_status: asset?.status ?? null }
  })
}

// ── Generate variants for a creator (one per prompt) ──────────────
export async function POST(request: Request) {
  if (!await canGenerate(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!FAL_KEY) return NextResponse.json({ error: "FAL_KEY missing" }, { status: 500 })

  const body        = await request.json().catch(() => ({} as Record<string, unknown>))
  const creator     = typeof body.creator === "string" ? body.creator.trim() : ""
  const prompts     = Array.isArray(body.prompts)
    ? body.prompts.filter((prompt: unknown): prompt is string => typeof prompt === "string").map((prompt: string) => prompt.trim()).filter(Boolean)
    : []
  const sourceLabel = typeof body.source_label === "string" ? body.source_label.trim() || null : null
  const referenceImage = typeof body.reference_image_data_url === "string" ? body.reference_image_data_url : null
  if (!creator || !prompts.length) return NextResponse.json({ error: "creator + prompts[] required" }, { status: 400 })
  if (prompts.length > 10) return NextResponse.json({ error: "maximum 10 variants per batch" }, { status: 400 })
  if (referenceImage && (!IMAGE_DATA_URL.test(referenceImage) || referenceImage.length > MAX_REFERENCE_IMAGE_LENGTH)) {
    return NextResponse.json({ error: "reference image must be a compressed JPEG, PNG or WebP under 2.5 MB" }, { status: 400 })
  }

  const refs = creatorRefUrls(creator).slice(referenceImage ? -9 : -10)
  if (!refs.length) return NextResponse.json({ error: `no reference images for creator '${creator}'` }, { status: 400 })
  const imageUrls = referenceImage ? [...refs, referenceImage] : refs

  const supabase = createServerClient()
  const batchId  = crypto.randomUUID()
  const headers  = { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" }

  const rows: Record<string, unknown>[] = []
  for (const prompt of prompts) {
    const r = await fetch(`https://queue.fal.run/${SEEDREAM_EDIT}`, {
      method: "POST", headers,
      body: JSON.stringify({ prompt, image_urls: imageUrls, image_size: "portrait_4_3", num_images: 1, enable_safety_checker: true }),
    })
    const d = await r.json().catch(() => ({}))
    rows.push({
      batch_id:         batchId,
      creator,
      source_label:     sourceLabel,
      prompt,
      status:           d.request_id ? "generating" : "failed",
      fal_status_url:   d.status_url ?? null,
      fal_response_url: d.response_url ?? null,
    })
  }

  const { error } = await supabase.from("threads_generations").insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ batch_id: batchId, submitted: rows.length })
}

// ── Poll a batch: update finished generations, return current state ─
export async function GET(request: Request) {
  const url = new URL(request.url)
  if (!await canGenerate(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const batchId = url.searchParams.get("batch_id")

  const supabase = createServerClient()
  const headers  = { Authorization: `Key ${FAL_KEY}` }
  if (!batchId) {
    const { data, error } = await supabase.from("threads_generations")
      .select("id,batch_id,creator,prompt,image_url,status,source_label,created_at")
      .order("created_at", { ascending: false })
      .limit(40)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ generations: await withSavedAssets(supabase, data ?? []) })
  }

  const { data: gens } = await supabase.from("threads_generations").select("*").eq("batch_id", batchId)
  for (const g of gens ?? []) {
    if (g.status !== "generating" || !g.fal_status_url) continue
    const st = await (await fetch(g.fal_status_url, { headers })).json().catch(() => ({}))
    if (st.status === "COMPLETED" && g.fal_response_url) {
      const rd       = await (await fetch(g.fal_response_url, { headers })).json().catch(() => ({}))
      const imageUrl = rd.images?.[0]?.url ?? null
      await supabase.from("threads_generations")
        .update({ image_url: imageUrl, status: imageUrl ? "pending" : "failed", updated_at: new Date().toISOString() })
        .eq("id", g.id)
    } else if (st.status === "FAILED") {
      await supabase.from("threads_generations")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", g.id)
    }
  }

  const { data: updated } = await supabase.from("threads_generations")
    .select("id,batch_id,creator,prompt,image_url,status,source_label,created_at").eq("batch_id", batchId).order("created_at")
  return NextResponse.json({ batch_id: batchId, generations: await withSavedAssets(supabase, updated ?? []) })
}
