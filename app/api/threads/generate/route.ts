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
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000
const STRICT_IDENTITY_REF_COUNT = 3
const MAX_RESULT_POLL_ATTEMPTS = 10
const IMAGE_SIZES = new Set(["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9", "auto_2K", "auto_4K"])
const EMPTY_RESULT_ERROR = "fal completed without returning an image."
const SAFETY_FILTER_ERROR = "fal safety filter blocked this result. Use a less revealing screenshot or add a platform-safe coverage instruction and retry."

type GenerationRow = Record<string, unknown> & {
  id: string
  status: string
  fal_status_url?: string | null
  fal_response_url?: string | null
  created_at?: string
  result_poll_attempts?: number
}

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

function extractErrorMessage(data: Record<string, unknown>) {
  if (typeof data.detail === "string") return data.detail
  if (typeof data.error === "string") return data.error
  if (data.error && typeof data.error === "object" && "message" in data.error) {
    return String(data.error.message)
  }
  return null
}

function hasSafetyFilteredImage(data: Record<string, unknown>) {
  return Array.isArray(data.has_nsfw_concepts) && data.has_nsfw_concepts.some(value => value === true)
}

function getCompletedImageUrl(data: Record<string, unknown>) {
  return Array.isArray(data.images) && typeof data.images[0]?.url === "string"
    ? data.images[0].url
    : null
}

function shouldRetryCompletedResult(response: Response, data: Record<string, unknown>) {
  if (response.status === 404 || response.status >= 500) return true
  return response.ok && !getCompletedImageUrl(data) && !hasSafetyFilteredImage(data) && !extractErrorMessage(data)
}

async function saveResultRetryState(
  supabase: ReturnType<typeof createServerClient>,
  generation: GenerationRow,
  result: Record<string, unknown>,
  falQueueStatus: string
) {
  const resultPollAttempts = (generation.result_poll_attempts ?? 0) + 1
  const attemptsExhausted = resultPollAttempts >= MAX_RESULT_POLL_ATTEMPTS
  await supabase.from("threads_generations")
    .update({
      status: attemptsExhausted ? "failed" : "generating",
      fal_queue_status: falQueueStatus,
      error_message: attemptsExhausted ? extractErrorMessage(result) ?? EMPTY_RESULT_ERROR : null,
      result_poll_attempts: resultPollAttempts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", generation.id)
}

async function saveCompletedResult(
  supabase: ReturnType<typeof createServerClient>,
  generation: GenerationRow,
  result: Record<string, unknown>,
  falQueueStatus: string
) {
  const safetyFiltered = hasSafetyFilteredImage(result)
  const imageUrl = safetyFiltered ? null : getCompletedImageUrl(result)
  await supabase.from("threads_generations")
    .update({
      image_url: imageUrl,
      status: imageUrl ? "pending" : "failed",
      fal_queue_status: falQueueStatus,
      error_message: imageUrl ? null : safetyFiltered ? SAFETY_FILTER_ERROR : extractErrorMessage(result) ?? EMPTY_RESULT_ERROR,
      result_poll_attempts: generation.result_poll_attempts ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", generation.id)
}

async function pollGeneratingRows(
  supabase: ReturnType<typeof createServerClient>,
  rows: GenerationRow[]
) {
  const headers = { Authorization: `Key ${FAL_KEY}` }
  await Promise.all(rows.map(async generation => {
    const refreshEmptyFailure = generation.status === "failed"
      && generation.fal_queue_status === "COMPLETED"
      && generation.error_message === EMPTY_RESULT_ERROR
      && generation.fal_response_url
    if (generation.status !== "generating" && !refreshEmptyFailure) return

    if (refreshEmptyFailure) {
      try {
        const resultResponse = await fetch(generation.fal_response_url as string, { headers })
        const result = await resultResponse.json().catch(() => ({} as Record<string, unknown>))
        await saveCompletedResult(supabase, generation, result, "COMPLETED")
      } catch {
        // Keep the original error if fal cannot be reached while enriching an old failure.
      }
      return
    }

    if (!generation.fal_status_url) {
      await supabase.from("threads_generations")
        .update({ status: "failed", error_message: "Missing queue status URL.", updated_at: new Date().toISOString() })
        .eq("id", generation.id)
      return
    }

    try {
      const statusResponse = await fetch(generation.fal_status_url, { headers })
      const queueStatus = await statusResponse.json().catch(() => ({} as Record<string, unknown>))
      const falQueueStatus = typeof queueStatus.status === "string" ? queueStatus.status : null
      if (falQueueStatus === "COMPLETED" && generation.fal_response_url) {
        const resultResponse = await fetch(generation.fal_response_url, { headers })
        const result = await resultResponse.json().catch(() => ({} as Record<string, unknown>))
        if (shouldRetryCompletedResult(resultResponse, result)) {
          await saveResultRetryState(supabase, generation, result, falQueueStatus)
          return
        }
        await saveCompletedResult(supabase, generation, result, falQueueStatus)
        return
      }

      if (falQueueStatus === "FAILED" || !statusResponse.ok) {
        await supabase.from("threads_generations")
          .update({
            status: "failed",
            fal_queue_status: falQueueStatus,
            error_message: extractErrorMessage(queueStatus) ?? "fal could not generate this image.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", generation.id)
        return
      }

      const timedOut = generation.created_at
        ? Date.now() - new Date(generation.created_at).getTime() > GENERATION_TIMEOUT_MS
        : false
      await supabase.from("threads_generations")
        .update({
          status: timedOut ? "failed" : "generating",
          fal_queue_status: falQueueStatus,
          error_message: timedOut ? "Generation timed out after 15 minutes. Please generate it again." : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generation.id)
    } catch {
      const timedOut = generation.created_at
        ? Date.now() - new Date(generation.created_at).getTime() > GENERATION_TIMEOUT_MS
        : false
      if (timedOut) {
        await supabase.from("threads_generations")
          .update({ status: "failed", error_message: "Generation timed out while checking fal. Please generate it again.", updated_at: new Date().toISOString() })
          .eq("id", generation.id)
      }
    }
  }))
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
  const requestedImageSize = typeof body.image_size === "string" && IMAGE_SIZES.has(body.image_size)
    ? body.image_size
    : "portrait_4_3"
  if (!creator || !prompts.length) return NextResponse.json({ error: "creator + prompts[] required" }, { status: 400 })
  if (prompts.length > 10) return NextResponse.json({ error: "maximum 10 variants per batch" }, { status: 400 })
  if (referenceImage && (!IMAGE_DATA_URL.test(referenceImage) || referenceImage.length > MAX_REFERENCE_IMAGE_LENGTH)) {
    return NextResponse.json({ error: "reference image must be a compressed JPEG, PNG or WebP under 2.5 MB" }, { status: 400 })
  }

  const refs = creatorRefUrls(creator).slice(referenceImage ? -STRICT_IDENTITY_REF_COUNT : -10)
  if (!refs.length) return NextResponse.json({ error: `no reference images for creator '${creator}'` }, { status: 400 })
  // Strict recreation relies on explicit Figure roles: blueprint first, identity-only anchors after it.
  const imageUrls = referenceImage ? [referenceImage, ...refs] : refs

  const supabase = createServerClient()
  const batchId  = crypto.randomUUID()
  const headers  = { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" }

  const rows: Record<string, unknown>[] = []
  for (const prompt of prompts) {
    const r = await fetch(`https://queue.fal.run/${SEEDREAM_EDIT}`, {
      method: "POST", headers,
      body: JSON.stringify({ prompt, image_urls: imageUrls, image_size: requestedImageSize, num_images: 1, enable_safety_checker: true }),
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
      error_message:    d.request_id ? null : extractErrorMessage(d) ?? "fal rejected this generation request.",
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
  if (!batchId) {
    const { data: recent, error } = await supabase.from("threads_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await pollGeneratingRows(supabase, (recent ?? []) as GenerationRow[])
    const { data } = await supabase.from("threads_generations")
      .select("id,batch_id,creator,prompt,image_url,status,source_label,created_at,fal_queue_status,error_message")
      .order("created_at", { ascending: false })
      .limit(40)
    return NextResponse.json({ generations: await withSavedAssets(supabase, data ?? []) })
  }

  const { data: gens } = await supabase.from("threads_generations").select("*").eq("batch_id", batchId)
  await pollGeneratingRows(supabase, (gens ?? []) as GenerationRow[])

  const { data: updated } = await supabase.from("threads_generations")
    .select("id,batch_id,creator,prompt,image_url,status,source_label,created_at,fal_queue_status,error_message").eq("batch_id", batchId).order("created_at")
  return NextResponse.json({ batch_id: batchId, generations: await withSavedAssets(supabase, updated ?? []) })
}
