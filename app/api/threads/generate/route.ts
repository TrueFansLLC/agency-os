import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { creatorRefUrls } from "@/lib/creator-refs"
import { isTokenAuthorized } from "@/lib/supabase/auth-server"

export const maxDuration = 60

const TOKEN  = process.env.THREADS_GENERATE_TOKEN ?? ""
const FAL_KEY = process.env.FAL_KEY ?? ""
const SEEDREAM_EDIT = "fal-ai/bytedance/seedream/v4.5/edit"

// ── Generate variants for a creator (one per prompt) ──────────────
export async function POST(request: Request) {
  if (!isTokenAuthorized(request, TOKEN)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!FAL_KEY) return NextResponse.json({ error: "FAL_KEY missing" }, { status: 500 })

  const body        = await request.json().catch(() => ({} as Record<string, unknown>))
  const creator     = body.creator as string
  const prompts     = (body.prompts as string[]) ?? []
  const sourceLabel = (body.source_label as string) ?? null
  if (!creator || !prompts.length) return NextResponse.json({ error: "creator + prompts[] required" }, { status: 400 })

  const refs = creatorRefUrls(creator)
  if (!refs.length) return NextResponse.json({ error: `no reference images for creator '${creator}'` }, { status: 400 })

  const supabase = createServerClient()
  const batchId  = crypto.randomUUID()
  const headers  = { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" }

  const rows: Record<string, unknown>[] = []
  for (const prompt of prompts) {
    const r = await fetch(`https://queue.fal.run/${SEEDREAM_EDIT}`, {
      method: "POST", headers,
      body: JSON.stringify({ prompt, image_urls: refs, num_images: 1 }),
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
  if (!isTokenAuthorized(request, TOKEN)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const batchId = url.searchParams.get("batch_id")
  if (!batchId) return NextResponse.json({ error: "batch_id required" }, { status: 400 })

  const supabase = createServerClient()
  const headers  = { Authorization: `Key ${FAL_KEY}` }

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
    }
  }

  const { data: updated } = await supabase.from("threads_generations")
    .select("id,creator,prompt,image_url,status,source_label").eq("batch_id", batchId).order("created_at")
  return NextResponse.json({ batch_id: batchId, generations: updated ?? [] })
}
