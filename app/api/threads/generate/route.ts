import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { creatorRefUrls } from "@/lib/creator-refs"
import { isAdminUser, isTokenAuthorized } from "@/lib/supabase/auth-server"

export const maxDuration = 60

const TOKEN  = process.env.THREADS_GENERATE_TOKEN ?? ""
const FAL_KEY = process.env.FAL_KEY ?? ""
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""
const QA_MODEL = "claude-sonnet-4-6"
const BLUEPRINT_BUCKET = "generation-blueprints"
const MAX_REFERENCE_IMAGE_LENGTH = 2_500_000
const IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000
const STRICT_IDENTITY_REF_COUNT = 3
const MAX_RESULT_POLL_ATTEMPTS = 10
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMAGE_SIZES = new Set(["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9", "auto_2K", "auto_4K"])
const EMPTY_RESULT_ERROR = "fal completed without returning an image."
const SAFETY_FILTER_ERROR = "fal safety filter blocked this result. Use a less revealing screenshot or add a platform-safe coverage instruction and retry."
const MODELS = {
  seedream: "fal-ai/bytedance/seedream/v4.5/edit",
  nano_banana_pro: "fal-ai/nano-banana-pro/edit",
} as const
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
const NANO_ASPECT_RATIO: Record<string, string> = {
  square_hd: "1:1",
  square: "1:1",
  portrait_4_3: "3:4",
  portrait_16_9: "9:16",
  landscape_4_3: "4:3",
  landscape_16_9: "16:9",
}

type GenerationModel = keyof typeof MODELS
type RecreationStrategy = "exact" | "subtle_outfit_variations" | "different_outfits"

type GenerationRow = Record<string, unknown> & {
  id: string
  status: string
  creator?: string
  fal_status_url?: string | null
  fal_response_url?: string | null
  created_at?: string
  result_poll_attempts?: number
  reference_storage_path?: string | null
}

type QualityScores = {
  composition: number
  crop: number
  pose: number
  wardrobe: number
  background: number
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

async function toPublicGenerations(
  supabase: ReturnType<typeof createServerClient>,
  generations: Record<string, unknown>[]
) {
  return withSavedAssets(supabase, generations.map(generation => {
    const { reference_storage_path: referenceStoragePath, ...publicGeneration } = generation
    return { ...publicGeneration, can_retry: typeof referenceStoragePath === "string" }
  }))
}

function extractErrorValue(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    const parts = value.map(extractErrorValue).filter((part): part is string => Boolean(part))
    return parts.length ? parts.join(" ") : null
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return extractErrorValue(record.message) ?? extractErrorValue(record.detail) ?? extractErrorValue(record.error)
  }
  return null
}

function extractErrorMessage(data: Record<string, unknown>) {
  return extractErrorValue(data.detail) ?? extractErrorValue(data.error) ?? extractErrorValue(data.message)
}

function resultErrorMessage(data: Record<string, unknown>, httpStatus: number) {
  return extractErrorMessage(data) ?? (httpStatus >= 400
    ? `fal returned HTTP ${httpStatus} without an image.`
    : EMPTY_RESULT_ERROR)
}

function parseScore(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(typeof value === "number" ? value : Number(value) || 0)))
}

function parseQualityScores(value: unknown): QualityScores {
  const scores = value && typeof value === "object" ? value as Record<string, unknown> : {}
  return {
    composition: parseScore(scores.composition),
    crop: parseScore(scores.crop),
    pose: parseScore(scores.pose),
    wardrobe: parseScore(scores.wardrobe),
    background: parseScore(scores.background),
  }
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) throw new Error("QA model did not return JSON")
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
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
  if ([404, 409, 425, 429].includes(response.status) || response.status >= 500) return true
  return response.ok && !getCompletedImageUrl(data) && !hasSafetyFilteredImage(data) && !extractErrorMessage(data)
}

async function saveResultRetryState(
  supabase: ReturnType<typeof createServerClient>,
  generation: GenerationRow,
  result: Record<string, unknown>,
  falQueueStatus: string,
  httpStatus: number
) {
  const resultPollAttempts = (generation.result_poll_attempts ?? 0) + 1
  const attemptsExhausted = resultPollAttempts >= MAX_RESULT_POLL_ATTEMPTS
  await supabase.from("threads_generations")
    .update({
      status: attemptsExhausted ? "failed" : "generating",
      fal_queue_status: falQueueStatus,
      error_message: attemptsExhausted ? resultErrorMessage(result, httpStatus) : null,
      result_poll_attempts: resultPollAttempts,
      fal_result_http_status: httpStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", generation.id)
}

async function saveCompletedResult(
  supabase: ReturnType<typeof createServerClient>,
  generation: GenerationRow,
  result: Record<string, unknown>,
  falQueueStatus: string,
  httpStatus: number
) {
  const safetyFiltered = hasSafetyFilteredImage(result)
  const imageUrl = safetyFiltered ? null : getCompletedImageUrl(result)
  await supabase.from("threads_generations")
    .update({
      image_url: imageUrl,
      status: imageUrl ? "pending" : "failed",
      fal_queue_status: falQueueStatus,
      error_message: imageUrl ? null : safetyFiltered ? SAFETY_FILTER_ERROR : resultErrorMessage(result, httpStatus),
      result_poll_attempts: generation.result_poll_attempts ?? 0,
      fal_result_http_status: httpStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", generation.id)
  if (imageUrl) {
    try {
      const qualityReview = await reviewBlueprintFidelity(supabase, generation, imageUrl)
      await supabase.from("threads_generations")
        .update({ ...qualityReview, updated_at: new Date().toISOString() })
        .eq("id", generation.id)
    } catch (qualityError) {
      await supabase.from("threads_generations")
        .update({
          qa_status: "failed",
          qa_summary: qualityError instanceof Error ? qualityError.message.slice(0, 300) : "Automated QA could not run.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", generation.id)
    }
  }
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
        await saveCompletedResult(supabase, generation, result, "COMPLETED", resultResponse.status)
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
          await saveResultRetryState(supabase, generation, result, falQueueStatus, resultResponse.status)
          return
        }
        await saveCompletedResult(supabase, generation, result, falQueueStatus, resultResponse.status)
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

function parseGenerationModel(value: unknown): GenerationModel {
  return typeof value === "string" && value in MODELS
    ? value as GenerationModel
    : "seedream"
}

function parseGenerationJobId(value: unknown) {
  return typeof value === "string" && UUID.test(value) ? value : undefined
}

function parseRecreationStrategy(value: unknown): RecreationStrategy {
  if (value === "subtle_outfit_variations" || value === "different_outfits") return value
  return "exact"
}

function buildFalPayload(
  generationModel: GenerationModel,
  prompt: string,
  imageUrls: string[],
  imageSize: string
) {
  if (generationModel === "nano_banana_pro") {
    return {
      prompt,
      image_urls: imageUrls,
      aspect_ratio: NANO_ASPECT_RATIO[imageSize] ?? "auto",
      num_images: 1,
      output_format: "png",
      resolution: "1K",
      limit_generations: true,
    }
  }

  return {
    prompt,
    image_urls: imageUrls,
    image_size: imageSize,
    num_images: 1,
    enable_safety_checker: true,
  }
}

async function createBlueprintDataUrl(
  supabase: ReturnType<typeof createServerClient>,
  storagePath: string
) {
  const { data, error } = await supabase.storage.from(BLUEPRINT_BUCKET).download(storagePath)
  if (error || !data) throw new Error(error?.message ?? "blueprint could not be downloaded")
  if (data.size > MAX_REFERENCE_IMAGE_LENGTH) throw new Error("saved blueprint exceeds the 2.5 MB limit")
  const contentType = data.type || "image/jpeg"
  return `data:${contentType};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`
}

async function reviewBlueprintFidelity(
  supabase: ReturnType<typeof createServerClient>,
  generation: GenerationRow,
  imageUrl: string
) {
  if (!ANTHROPIC_KEY || !generation.reference_storage_path) {
    return { qa_status: "skipped", qa_score: null, qa_summary: null, qa_details: null }
  }

  const blueprint = await createBlueprintDataUrl(supabase, generation.reference_storage_path)
  const match = blueprint.match(IMAGE_DATA_URL)
  if (!match) throw new Error("saved blueprint could not be prepared for QA")
  const recreationStrategy = parseRecreationStrategy(generation.recreation_strategy)
  const wardrobeRule = recreationStrategy === "subtle_outfit_variations"
    ? "- wardrobe: evaluate whether the intentional subtle outfit variation keeps a comparable garment category, styling intent and at least the source coverage. Do not penalize a deliberate color, material or pattern change."
    : recreationStrategy === "different_outfits"
      ? "- wardrobe: evaluate whether the intentionally different outfit is complete, realistic, platform-safe and at least as covering as the source. Do not penalize a deliberate garment type or color change."
      : "- wardrobe: garment type, color, cut, sleeves, neckline, fit and coverage boundaries"

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: QA_MODEL,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } },
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: [
              "IMAGE 1 is the source blueprint. IMAGE 2 is a generated recreation.",
              "Evaluate only visual recreation fidelity. Do not identify or compare the people.",
              "Score each category from 0 to 100:",
              "- composition: camera placement, angle, lens distance and overall layout",
              "- crop: framing and which parts of the scene remain inside the image",
              "- pose: body position and selfie posture",
              wardrobeRule,
              "- background: setting, objects and lighting",
              'Return JSON only: {"scores":{"composition":0,"crop":0,"pose":0,"wardrobe":0,"background":0},"summary":"one short English sentence","notes":["up to three short English discrepancies"]}',
            ].join("\n"),
          },
        ],
      }],
    }),
  })
  const data = await response.json().catch(() => ({} as Record<string, unknown>))
  if (!response.ok) throw new Error(extractErrorMessage(data) ?? `QA returned HTTP ${response.status}`)
  const text = Array.isArray(data.content)
    ? data.content.map((block: unknown) => block && typeof block === "object" && "text" in block ? String(block.text) : "").join("\n")
    : ""
  const result = extractJsonObject(text)
  const scores = parseQualityScores(result.scores)
  const qaScore = recreationStrategy === "exact"
    ? Math.round(
      scores.composition * 0.2
      + scores.crop * 0.25
      + scores.pose * 0.15
      + scores.wardrobe * 0.3
      + scores.background * 0.1
    )
    : Math.round(
      scores.composition * 0.25
      + scores.crop * 0.3
      + scores.pose * 0.2
      + scores.wardrobe * 0.15
      + scores.background * 0.1
    )
  const wardrobeThreshold = recreationStrategy === "exact" ? 85 : 75
  const requiresReview = qaScore < 85 || scores.wardrobe < wardrobeThreshold || scores.crop < 80 || scores.pose < 75
  return {
    qa_status: requiresReview ? "review_required" : "passed",
    qa_score: qaScore,
    qa_summary: typeof result.summary === "string" ? result.summary.slice(0, 300) : null,
    qa_details: {
      recreation_strategy: recreationStrategy,
      scores,
      notes: Array.isArray(result.notes) ? result.notes.slice(0, 3).map(note => String(note).slice(0, 200)) : [],
    },
  }
}

async function storeBlueprint(
  supabase: ReturnType<typeof createServerClient>,
  creator: string,
  batchId: string,
  referenceImage: string
) {
  const match = referenceImage.match(IMAGE_DATA_URL)
  if (!match) throw new Error("reference image must be a compressed JPEG, PNG or WebP under 2.5 MB")

  const contentType = match[1]
  const extension = EXTENSION[contentType]
  const image = Buffer.from(match[2], "base64")
  if (!extension || image.byteLength > MAX_REFERENCE_IMAGE_LENGTH) {
    throw new Error("reference image must be a compressed JPEG, PNG or WebP under 2.5 MB")
  }

  const month = new Date().toISOString().slice(0, 7)
  const storagePath = `${creator.toLowerCase()}/${month}/${batchId}.${extension}`
  const { error } = await supabase.storage.from(BLUEPRINT_BUCKET).upload(storagePath, image, {
    contentType,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return storagePath
}

async function submitPrompts(
  supabase: ReturnType<typeof createServerClient>,
  input: {
    creator: string
    prompts: string[]
    sourceLabel: string | null
    imageSize: string
    generationModel: GenerationModel
    recreationStrategy: RecreationStrategy
    referenceStoragePath?: string | null
    referenceUrl?: string | null
    retryOfId?: string | null
    jobId?: string
  }
) {
  const refs = creatorRefUrls(input.creator).slice(input.referenceUrl ? -STRICT_IDENTITY_REF_COUNT : -10)
  if (!refs.length) throw new Error(`no reference images for creator '${input.creator}'`)

  // Strict recreation relies on explicit Figure roles: blueprint first, identity-only anchors after it.
  const imageUrls = input.referenceUrl ? [input.referenceUrl, ...refs] : refs
  const batchId = crypto.randomUUID()
  const jobId = input.jobId ?? batchId
  const headers = { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" }
  const rows: Record<string, unknown>[] = []

  for (const prompt of input.prompts) {
    const response = await fetch(`https://queue.fal.run/${MODELS[input.generationModel]}`, {
      method: "POST",
      headers,
      body: JSON.stringify(buildFalPayload(input.generationModel, prompt, imageUrls, input.imageSize)),
    })
    const data = await response.json().catch(() => ({} as Record<string, unknown>))
    rows.push({
      batch_id: batchId,
      generation_job_id: jobId,
      creator: input.creator,
      source_label: input.sourceLabel,
      prompt,
      status: data.request_id ? "generating" : "failed",
      fal_status_url: data.status_url ?? null,
      fal_response_url: data.response_url ?? null,
      error_message: data.request_id ? null : extractErrorMessage(data) ?? "fal rejected this generation request.",
      reference_storage_path: input.referenceStoragePath ?? null,
      image_size: input.imageSize,
      generation_model: input.generationModel,
      recreation_strategy: input.recreationStrategy,
      retry_of_id: input.retryOfId ?? null,
      qa_status: input.referenceStoragePath ? "pending" : "skipped",
    })
  }

  const { error } = await supabase.from("threads_generations").insert(rows)
  if (error) throw new Error(error.message)
  return { batch_id: batchId, generation_job_id: jobId, submitted: rows.length }
}

// ── Generate variants for a creator (one per prompt) ──────────────
export async function POST(request: Request) {
  if (!await canGenerate(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!FAL_KEY) return NextResponse.json({ error: "FAL_KEY missing" }, { status: 500 })

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const retryGenerationId = typeof body.retry_generation_id === "string" ? body.retry_generation_id : ""
  const generationJobId = parseGenerationJobId(body.generation_job_id)
  const generationModel = parseGenerationModel(body.generation_model)
  const recreationStrategy = parseRecreationStrategy(body.recreation_strategy)
  const supabase = createServerClient()

  if (retryGenerationId) {
    const { data: retryGeneration, error } = await supabase
      .from("threads_generations")
      .select("id,creator,source_label,prompt,reference_storage_path,image_size,generation_model,recreation_strategy")
      .eq("id", retryGenerationId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!retryGeneration?.reference_storage_path) {
      return NextResponse.json({ error: "This older generation has no saved blueprint. Upload its screenshot again." }, { status: 400 })
    }

    try {
      return NextResponse.json(await submitPrompts(supabase, {
        creator: retryGeneration.creator,
        prompts: [retryGeneration.prompt],
        sourceLabel: retryGeneration.source_label,
        imageSize: retryGeneration.image_size ?? "portrait_4_3",
        generationModel: typeof body.generation_model === "string"
          ? generationModel
          : parseGenerationModel(retryGeneration.generation_model),
        recreationStrategy: parseRecreationStrategy(retryGeneration.recreation_strategy),
        referenceStoragePath: retryGeneration.reference_storage_path,
        referenceUrl: await createBlueprintDataUrl(supabase, retryGeneration.reference_storage_path),
        retryOfId: retryGeneration.id,
        jobId: generationJobId,
      }))
    } catch (retryError) {
      return NextResponse.json({ error: retryError instanceof Error ? retryError.message : "Retry could not be started." }, { status: 500 })
    }
  }

  const creator = typeof body.creator === "string" ? body.creator.trim() : ""
  const prompts = Array.isArray(body.prompts)
    ? body.prompts.filter((prompt: unknown): prompt is string => typeof prompt === "string").map((prompt: string) => prompt.trim()).filter(Boolean)
    : []
  const sourceLabel = typeof body.source_label === "string" ? body.source_label.trim() || null : null
  const referenceImage = typeof body.reference_image_data_url === "string" ? body.reference_image_data_url : null
  const requestedImageSize = typeof body.image_size === "string" && IMAGE_SIZES.has(body.image_size)
    ? body.image_size
    : "portrait_4_3"
  if (!creator || !prompts.length) return NextResponse.json({ error: "creator + prompts[] required" }, { status: 400 })
  if (prompts.length > 10) return NextResponse.json({ error: "maximum 10 variants per batch" }, { status: 400 })
  if (referenceImage && (!IMAGE_DATA_URL.test(referenceImage) || referenceImage.length > MAX_REFERENCE_IMAGE_LENGTH * 1.5)) {
    return NextResponse.json({ error: "reference image must be a compressed JPEG, PNG or WebP under 2.5 MB" }, { status: 400 })
  }

  try {
    const batchId = crypto.randomUUID()
    const blueprintStoragePath = referenceImage ? await storeBlueprint(supabase, creator, batchId, referenceImage) : null
    return NextResponse.json(await submitPrompts(supabase, {
      creator,
      prompts,
      sourceLabel,
      imageSize: requestedImageSize,
      generationModel,
      recreationStrategy,
      referenceStoragePath: blueprintStoragePath,
      referenceUrl: referenceImage,
      jobId: generationJobId,
    }))
  } catch (generationError) {
    return NextResponse.json({ error: generationError instanceof Error ? generationError.message : "Generation could not be started." }, { status: 500 })
  }
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
      .select("id,batch_id,generation_job_id,creator,prompt,image_url,status,source_label,created_at,fal_queue_status,error_message,generation_model,recreation_strategy,fal_result_http_status,reference_storage_path,qa_status,qa_score,qa_summary,qa_details")
      .order("created_at", { ascending: false })
      .limit(40)
    return NextResponse.json({ generations: await toPublicGenerations(supabase, data ?? []) })
  }

  const { data: gens } = await supabase.from("threads_generations").select("*").eq("batch_id", batchId)
  await pollGeneratingRows(supabase, (gens ?? []) as GenerationRow[])

  const { data: updated } = await supabase.from("threads_generations")
    .select("id,batch_id,generation_job_id,creator,prompt,image_url,status,source_label,created_at,fal_queue_status,error_message,generation_model,recreation_strategy,fal_result_http_status,reference_storage_path,qa_status,qa_score,qa_summary,qa_details").eq("batch_id", batchId).order("created_at")
  return NextResponse.json({ batch_id: batchId, generations: await toPublicGenerations(supabase, updated ?? []) })
}
