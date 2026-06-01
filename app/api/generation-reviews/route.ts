import { NextResponse, type NextRequest } from "next/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"
import { createServerClient } from "@/lib/supabase/server"

const BLUEPRINT_BUCKET = "generation-blueprints"
const VERDICTS = new Set(["approved", "usable", "rejected"])
const REASONS = new Set([
  "wrong_identity",
  "wrong_outfit",
  "wrong_crop",
  "wrong_pose",
  "wrong_background",
  "coverage_mismatch",
  "low_realism",
  "other",
])

type Review = {
  generation_id: string
  verdict: "approved" | "usable" | "rejected"
  reasons: string[]
  notes: string | null
  updated_at: string
}

function reviewStats(generations: Record<string, unknown>[]) {
  const stats = {
    total: generations.length,
    reviewed: 0,
    unreviewed: 0,
    approved: 0,
    usable: 0,
    rejected: 0,
    qa_passed: 0,
    qa_review_required: 0,
    by_model: {
      seedream: { total: 0, reviewed: 0, accepted: 0 },
      nano_banana_pro: { total: 0, reviewed: 0, accepted: 0 },
    },
  }

  for (const generation of generations) {
    const review = generation.review as Review | null
    const model = generation.generation_model === "nano_banana_pro" ? "nano_banana_pro" : "seedream"
    stats.by_model[model].total += 1
    if (generation.qa_status === "passed") stats.qa_passed += 1
    if (generation.qa_status === "review_required") stats.qa_review_required += 1
    if (!review) {
      stats.unreviewed += 1
      continue
    }

    stats.reviewed += 1
    stats.by_model[model].reviewed += 1
    stats[review.verdict] += 1
    if (review.verdict !== "rejected") stats.by_model[model].accepted += 1
  }

  return stats
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const creator = request.nextUrl.searchParams.get("creator")
  const supabase = createServerClient()
  let query = supabase
    .from("threads_generations")
    .select("id,creator,source_label,prompt,image_url,status,created_at,generation_model,qa_status,qa_score,qa_summary,qa_details,reference_storage_path,retry_of_id")
    .not("image_url", "is", null)
    .not("reference_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (creator && creator !== "all") query = query.eq("creator", creator)
  const { data: generations, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (generations ?? []).map(generation => generation.id)
  const paths = (generations ?? []).map(generation => generation.reference_storage_path)
  const [{ data: reviews }, { data: assets }, { data: signedUrls }] = await Promise.all([
    ids.length
      ? supabase.from("generation_reviews").select("generation_id,verdict,reasons,notes,updated_at").in("generation_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("content_assets").select("id,generation_id,status").in("generation_id", ids)
      : Promise.resolve({ data: [] }),
    paths.length
      ? supabase.storage.from(BLUEPRINT_BUCKET).createSignedUrls(paths, 60 * 60)
      : Promise.resolve({ data: [] }),
  ])

  const reviewByGeneration = new Map((reviews ?? []).map(review => [review.generation_id, review]))
  const assetByGeneration = new Map((assets ?? []).map(asset => [asset.generation_id, asset]))
  const signedUrlByPath = new Map((signedUrls ?? []).map(item => [item.path, item.signedUrl]))
  const items = (generations ?? []).map(generation => ({
    ...generation,
    blueprint_preview_url: signedUrlByPath.get(generation.reference_storage_path) ?? null,
    review: reviewByGeneration.get(generation.id) ?? null,
    saved_asset: assetByGeneration.get(generation.id) ?? null,
  }))

  return NextResponse.json({ generations: items, stats: reviewStats(items) })
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const generationId = typeof body.generation_id === "string" ? body.generation_id : ""
  const verdict = typeof body.verdict === "string" && VERDICTS.has(body.verdict) ? body.verdict : ""
  const reasons = Array.isArray(body.reasons)
    ? [...new Set(body.reasons.filter((reason: unknown): reason is string => typeof reason === "string" && REASONS.has(reason)))]
    : []
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null
  if (!generationId || !verdict) return NextResponse.json({ error: "generation_id and a valid verdict are required" }, { status: 400 })
  if (verdict === "rejected" && !reasons.length) return NextResponse.json({ error: "Choose at least one rejection reason." }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("generation_reviews")
    .upsert({
      generation_id: generationId,
      verdict,
      reasons: verdict === "rejected" ? reasons : [],
      notes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "generation_id" })
    .select("generation_id,verdict,reasons,notes,updated_at")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const generationId = typeof body.generation_id === "string" ? body.generation_id : ""
  if (!generationId) return NextResponse.json({ error: "generation_id required" }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from("generation_reviews").delete().eq("generation_id", generationId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
