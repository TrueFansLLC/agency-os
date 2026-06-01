import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

const MODEL_PRICE_USD: Record<string, number> = {
  seedream: 0.04,
  nano_banana_pro: 0.15,
}

type Generation = {
  id: string
  batch_id: string
  generation_job_id: string | null
  creator: string
  source_label: string | null
  prompt: string
  image_url: string | null
  status: string
  created_at: string
  updated_at: string
  fal_queue_status: string | null
  error_message: string | null
  generation_model: string
  recreation_strategy: string
  retry_of_id: string | null
  reference_storage_path: string | null
  qa_status: string
  qa_score: number | null
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function jobStatus(generations: Generation[]) {
  const generating = generations.filter(generation => generation.status === "generating").length
  const failed = generations.filter(generation => generation.status === "failed").length
  const reviewRequired = generations.filter(generation => generation.qa_status === "review_required").length
  if (generating) return "generating"
  if (failed === generations.length) return "failed"
  if (failed || reviewRequired) return "attention"
  return "completed"
}

export async function GET() {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("threads_generations")
    .select("id,batch_id,generation_job_id,creator,source_label,prompt,image_url,status,created_at,updated_at,fal_queue_status,error_message,generation_model,recreation_strategy,retry_of_id,reference_storage_path,qa_status,qa_score")
    .order("created_at", { ascending: false })
    .limit(600)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const generations = (data ?? []) as Generation[]
  const generationIds = generations.map(generation => generation.id)
  const [reviewResult, assetResult] = generationIds.length
    ? await Promise.all([
      supabase.from("generation_reviews").select("generation_id,verdict").in("generation_id", generationIds),
      supabase.from("content_assets").select("generation_id,status").in("generation_id", generationIds),
    ])
    : [{ data: [] }, { data: [] }]

  const reviews = new Map((reviewResult.data ?? []).map(review => [review.generation_id, review]))
  const assets = new Map((assetResult.data ?? []).map(asset => [asset.generation_id, asset]))
  const grouped = new Map<string, Generation[]>()
  for (const generation of generations) {
    const jobId = generation.generation_job_id ?? generation.batch_id
    grouped.set(jobId, [...(grouped.get(jobId) ?? []), generation])
  }

  const jobs = [...grouped.entries()].map(([id, rows]) => {
    const modelCounts = rows.reduce<Record<string, number>>((counts, generation) => {
      counts[generation.generation_model] = (counts[generation.generation_model] ?? 0) + 1
      return counts
    }, {})
    const activeBatchIds = unique(rows
      .filter(generation => generation.status === "generating")
      .map(generation => generation.batch_id))
    const failedRetryable = rows.filter(generation => generation.status === "failed" && generation.reference_storage_path)
    return {
      id,
      status: jobStatus(rows),
      created_at: rows[rows.length - 1]?.created_at ?? rows[0]?.created_at,
      updated_at: rows[0]?.updated_at,
      creators: unique(rows.map(generation => generation.creator)),
      source_labels: unique(rows.map(generation => generation.source_label).filter((label): label is string => Boolean(label))),
      total: rows.length,
      generated: rows.filter(generation => Boolean(generation.image_url)).length,
      generating: rows.filter(generation => generation.status === "generating").length,
      failed: rows.filter(generation => generation.status === "failed").length,
      retryable_failed: failedRetryable.length,
      review_required: rows.filter(generation => generation.qa_status === "review_required").length,
      reviewed: rows.filter(generation => reviews.has(generation.id)).length,
      saved: rows.filter(generation => assets.has(generation.id)).length,
      active_batch_ids: activeBatchIds,
      models: modelCounts,
      estimated_fal_cost_usd: rows.reduce((sum, generation) => sum + (MODEL_PRICE_USD[generation.generation_model] ?? 0), 0),
      generations: rows.map(generation => ({
        id: generation.id,
        batch_id: generation.batch_id,
        creator: generation.creator,
        source_label: generation.source_label,
        prompt: generation.prompt,
        image_url: generation.image_url,
        status: generation.status,
        created_at: generation.created_at,
        fal_queue_status: generation.fal_queue_status,
        error_message: generation.error_message,
        generation_model: generation.generation_model,
        recreation_strategy: generation.recreation_strategy,
        retry_of_id: generation.retry_of_id,
        qa_status: generation.qa_status,
        qa_score: generation.qa_score,
        can_retry: Boolean(generation.reference_storage_path),
        review: reviews.get(generation.id) ?? null,
        saved_asset: assets.get(generation.id) ?? null,
      })),
    }
  })
  const allRows = jobs.flatMap(job => job.generations)

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    jobs,
    active_batch_ids: unique(jobs.flatMap(job => job.active_batch_ids)),
    creators: unique(generations.map(generation => generation.creator)).sort(),
    summary: {
      jobs: jobs.length,
      images: generations.length,
      active: jobs.filter(job => job.status === "generating").length,
      attention: jobs.filter(job => job.status === "attention" || job.status === "failed").length,
      completed: jobs.filter(job => job.status === "completed").length,
      failed_images: allRows.filter(generation => generation.status === "failed").length,
      review_required: allRows.filter(generation => generation.qa_status === "review_required").length,
      estimated_fal_cost_usd: jobs.reduce((sum, job) => sum + job.estimated_fal_cost_usd, 0),
    },
  })
}
