"use client"

import Image from "next/image"
import Link from "next/link"
import { type ChangeEvent, useCallback, useEffect, useState } from "react"

type Generation = {
  id: string
  batch_id: string
  creator: string
  prompt: string
  image_url: string | null
  status: string
  source_label: string | null
  created_at: string
  saved_asset_id: string | null
  asset_status: string | null
  fal_queue_status: string | null
  error_message: string | null
  generation_model: "seedream" | "nano_banana_pro"
  recreation_strategy: RecreationStrategy
  can_retry: boolean
  qa_status: "pending" | "passed" | "review_required" | "failed" | "skipped"
  qa_score: number | null
  qa_summary: string | null
}

type ReferenceImage = {
  id: string
  name: string
  dataUrl: string
  imageSize: string
  imageSizeLabel: string
}

type RecreationStrategy = "exact" | "subtle_outfit_variations" | "different_outfits"

const CREATORS = ["Cathy", "Neyla", "Romina"]
const MAX_REFERENCE_IMAGE_LENGTH = 2_500_000
const MODEL_PRICE_PER_IMAGE: Record<Generation["generation_model"], number> = {
  seedream: 0.04,
  nano_banana_pro: 0.15,
}
const STATUS_STYLE: Record<string, string> = {
  generating: "border-amber-700 bg-amber-900/30 text-amber-300",
  pending: "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  failed: "border-red-800 bg-red-900/30 text-red-300",
}

function statusLabel(status: string) {
  if (status === "generating") return "Generating"
  if (status === "pending") return "Generated"
  if (status === "failed") return "Failed"
  return status
}

function generationModelLabel(model: Generation["generation_model"]) {
  return model === "nano_banana_pro" ? "Nano Banana Pro Quality" : "Seedream 4.5 Fast"
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function qualityLabel(status: Generation["qa_status"]) {
  if (status === "passed") return "QA passed"
  if (status === "review_required") return "Review required"
  if (status === "pending") return "Checking fidelity..."
  if (status === "failed") return "Manual review"
  return null
}

function qualityStyle(status: Generation["qa_status"]) {
  if (status === "passed") return "border-emerald-700 bg-emerald-900/30 text-emerald-300"
  if (status === "review_required") return "border-amber-700 bg-amber-900/30 text-amber-300"
  return "border-gray-700 bg-gray-800 text-gray-300"
}

function recreationStrategyDescription(strategy: RecreationStrategy) {
  if (strategy === "subtle_outfit_variations") {
    return "Keep the pose and scene fixed, but change one or two wardrobe details such as color, fabric or pattern."
  }
  if (strategy === "different_outfits") {
    return "Keep the pose and scene fixed, but create a clearly different platform-safe outfit for each variant."
  }
  return "Generate repeated attempts of the same screenshot: same pose, same scene and the same outfit."
}

function buildRecreatePrompt(
  creator: string,
  extraInstructions: string,
  strategy: RecreationStrategy,
  variantIndex: number,
  variantCount: number
) {
  const wardrobeInstruction = strategy === "subtle_outfit_variations"
    ? `Create variant ${variantIndex + 1} of ${variantCount} as an intentional subtle wardrobe variation. Keep the garment category, silhouette, fit and at least the same coverage as Figure 1. Change one or two wardrobe attributes such as color, material, pattern or styling detail. Make this variant visibly distinct from the other variants.`
    : strategy === "different_outfits"
      ? `Create variant ${variantIndex + 1} of ${variantCount} with an intentionally different complete outfit. Keep at least the same coverage as Figure 1. Change the garment type, color and styling while keeping the outfit realistic and platform-safe. Make this variant clearly distinct from the other variants.`
      : "Preserve the clothing from Figure 1 exactly: the same garment type, color, cut, sleeves, neckline, material, fit and coverage. Do not redesign, simplify, replace or add clothing items."

  return [
    "Figure 1 is the only scene blueprint.",
    `Figures 2, 3 and 4 are identity-only reference images of ${creator}.`,
    `Recreate Figure 1 as a new realistic smartphone photo featuring ${creator}.`,
    "Replace only the person's identity with the identity shown in Figures 2, 3 and 4.",
    "Preserve Figure 1 exactly wherever possible: the same pose, body position, camera placement, camera angle, lens distance, crop, framing, setting, background, lighting and overall composition.",
    wardrobeInstruction,
    "Do not copy clothing, pose, framing or background elements from Figures 2, 3 and 4. Use those figures only for the creator identity.",
    "Do not add accessories or visual elements that are absent from Figure 1.",
    extraInstructions ? `Additional requested adjustment: ${extraInstructions}` : "",
  ].filter(Boolean).join(" ")
}

function detectImageSize(width: number, height: number) {
  const ratio = width / height
  if (ratio <= 0.68) return { imageSize: "portrait_16_9", imageSizeLabel: "Portrait 9:16" }
  if (ratio <= 0.9) return { imageSize: "portrait_4_3", imageSizeLabel: "Portrait 3:4" }
  if (ratio <= 1.15) return { imageSize: "square_hd", imageSizeLabel: "Square" }
  if (ratio <= 1.5) return { imageSize: "landscape_4_3", imageSizeLabel: "Landscape 4:3" }
  return { imageSize: "landscape_16_9", imageSizeLabel: "Landscape 16:9" }
}

async function compressReferenceImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Please upload a JPEG, PNG or WebP screenshot.")
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = document.createElement("img")
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("The screenshot could not be read."))
      image.src = objectUrl
    })

    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.86)
    if (dataUrl.length > MAX_REFERENCE_IMAGE_LENGTH) {
      throw new Error("The screenshot is still too large after compression. Please crop it and upload it again.")
    }
    return { dataUrl, ...detectImageSize(image.naturalWidth, image.naturalHeight) }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function AIToolsPage() {
  const [mode, setMode] = useState<"prompt" | "reference">("prompt")
  const [creator, setCreator] = useState("Cathy")
  const [generationModel, setGenerationModel] = useState<Generation["generation_model"]>("seedream")
  const [label, setLabel] = useState("")
  const [prompt, setPrompt] = useState("")
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [variants, setVariants] = useState(2)
  const [recreationStrategy, setRecreationStrategy] = useState<RecreationStrategy>("exact")
  const [batchIds, setBatchIds] = useState<string[]>([])
  const [active, setActive] = useState<Generation[]>([])
  const [recent, setRecent] = useState<Generation[]>([])
  const [error, setError] = useState("")
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [submissionProgress, setSubmissionProgress] = useState("")
  const [savingAssetIds, setSavingAssetIds] = useState<string[]>([])
  const [selectedGenerationIds, setSelectedGenerationIds] = useState<string[]>([])
  const [retryingGenerationIds, setRetryingGenerationIds] = useState<string[]>([])
  const [premiumCostConfirmed, setPremiumCostConfirmed] = useState(false)

  useEffect(() => {
    setPremiumCostConfirmed(false)
  }, [generationModel, mode, referenceImages.length, variants])

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true)
    const response = await fetch("/api/threads/generate")
    const data = await response.json().catch(() => ({}))
    setLoadingRecent(false)
    if (!response.ok) {
      setError(data.error ?? "Could not load recent generations.")
      return
    }
    setRecent(data.generations ?? [])
  }, [])

  const pollBatches = useCallback(async (ids: string[]) => {
    const responses = await Promise.all(ids.map(async id => {
      const response = await fetch(`/api/threads/generate?batch_id=${encodeURIComponent(id)}`)
      const data = await response.json().catch(() => ({}))
      return { response, data }
    }))
    const failed = responses.find(({ response }) => !response.ok)
    if (failed) {
      setError(failed.data.error ?? "Could not update the batch.")
      setBatchIds([])
      return
    }

    const generations = responses.flatMap(({ data }) => (data.generations ?? []) as Generation[])
    setActive(generations)
    if (generations.length && generations.every(generation => generation.status !== "generating")) {
      setBatchIds([])
      await loadRecent()
      setActive([])
    }
  }, [loadRecent])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(() => {
    if (!batchIds.length) return
    void pollBatches(batchIds)
    const timer = window.setInterval(() => void pollBatches(batchIds), 3000)
    return () => window.clearInterval(timer)
  }, [batchIds, pollBatches])

  useEffect(() => {
    if (batchIds.length || !recent.some(generation => generation.status === "generating")) return
    const timer = window.setInterval(() => void loadRecent(), 5000)
    return () => window.clearInterval(timer)
  }, [batchIds.length, loadRecent, recent])

  async function handleGenerate() {
    const cleanPrompt = prompt.trim()
    if (mode === "prompt" && !cleanPrompt) return
    if (mode === "reference" && !referenceImages.length) return
    const imageCount = mode === "reference" ? referenceImages.length * variants : variants
    if (generationModel === "nano_banana_pro" && imageCount > 1 && !premiumCostConfirmed) return
    setSubmitting(true)
    setError("")
    setActive([])
    setSubmissionProgress("")

    const jobs = mode === "reference" ? referenceImages : [null]
    const submittedBatchIds: string[] = []

    for (const [index, referenceImage] of jobs.entries()) {
      setSubmissionProgress(jobs.length > 1 ? `Submitting ${index + 1} of ${jobs.length}...` : "")
      const response = await fetch("/api/threads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator,
          source_label: [label.trim(), referenceImage?.name].filter(Boolean).join(" · "),
          prompts: mode === "prompt"
            ? Array.from({ length: variants }, () => cleanPrompt)
            : Array.from({ length: variants }, (_, variantIndex) => buildRecreatePrompt(creator, cleanPrompt, recreationStrategy, variantIndex, variants)),
          reference_image_data_url: referenceImage?.dataUrl,
          image_size: referenceImage?.imageSize,
          generation_model: generationModel,
          recreation_strategy: mode === "reference" ? recreationStrategy : "exact",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error ?? `Generation ${index + 1} could not be started.`)
        break
      }
      submittedBatchIds.push(data.batch_id)
    }

    setSubmitting(false)
    setSubmissionProgress("")
    setBatchIds(submittedBatchIds)
  }

  async function handleRetry(generation: Generation, retryModel: Generation["generation_model"]) {
    setRetryingGenerationIds(current => [...current, generation.id])
    setError("")
    const response = await fetch("/api/threads/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retry_generation_id: generation.id,
        generation_model: retryModel,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setRetryingGenerationIds(current => current.filter(id => id !== generation.id))
    if (!response.ok) {
      setError(data.error ?? "The generation could not be retried.")
      return
    }
    setActive([])
    setBatchIds([data.batch_id])
  }

  async function handleReferenceImage(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 10 - referenceImages.length))
    event.target.value = ""
    if (!files.length) return

    setProcessingImage(true)
    setError("")
    try {
      const prepared: ReferenceImage[] = []
      for (const file of files) {
        prepared.push({ id: crypto.randomUUID(), name: file.name, ...await compressReferenceImage(file) })
      }
      setReferenceImages(current => [...current, ...prepared])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The screenshot could not be processed.")
    } finally {
      setProcessingImage(false)
    }
  }

  async function handleSaveAsset(generationId: string) {
    await handleSaveAssets([generationId])
  }

  async function handleSaveAssets(generationIds: string[]) {
    if (!generationIds.length) return
    setSavingAssetIds(current => [...new Set([...current, ...generationIds])])
    setError("")
    const saved = new Map<string, { id: string; status: string }>()
    for (const generationId of generationIds) {
      const response = await fetch("/api/content-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generation_id: generationId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error ?? "One or more images could not be saved to the content library.")
        break
      }
      saved.set(generationId, data)
    }

    setSavingAssetIds(current => current.filter(id => !generationIds.includes(id)))
    setSelectedGenerationIds(current => current.filter(id => !saved.has(id)))
    const markSaved = (generation: Generation) => {
      const asset = saved.get(generation.id)
      return asset ? { ...generation, saved_asset_id: asset.id, asset_status: asset.status } : generation
    }
    setActive(current => current.map(markSaved))
    setRecent(current => current.map(markSaved))
  }

  const visible = active.length ? active : recent
  const selectableGenerationIds = visible
    .filter(generation => generation.image_url && !generation.saved_asset_id)
    .map(generation => generation.id)
  const canGenerate = mode === "prompt" ? Boolean(prompt.trim()) : Boolean(referenceImages.length)
  const totalImages = mode === "reference" ? referenceImages.length * variants : variants
  const modelPricePerImage = MODEL_PRICE_PER_IMAGE[generationModel]
  const estimatedFalCost = totalImages * modelPricePerImage
  const premiumBatchNeedsConfirmation = generationModel === "nano_banana_pro" && totalImages > 1

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">AI Image Generator</h1>
            <span className="text-xs px-2.5 py-1 rounded-full border border-violet-700 bg-violet-900/30 text-violet-300">
              {generationModelLabel(generationModel)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/quality-review" className="px-3 py-2 rounded-lg border border-violet-700 bg-violet-900/20 text-violet-300 hover:text-violet-200 hover:border-violet-500 text-xs">
              Open quality review
            </Link>
            <Link href="/content-bank" className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs">
              Open content bank
            </Link>
          </div>
        </div>
        <p className="text-gray-400 mt-1 text-sm">Create a new scene from a prompt or recreate a screenshot with your selected creator.</p>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-fit">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Input mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setMode("prompt"); setVariants(2) }}
                  className={`px-3 py-2.5 rounded-lg border text-sm transition-colors ${mode === "prompt" ? "border-violet-500 bg-violet-900/30 text-white" : "border-gray-700 bg-gray-950 text-gray-400 hover:text-white"}`}>
                  Write prompt
                </button>
                <button type="button" onClick={() => { setMode("reference"); setVariants(1) }}
                  className={`px-3 py-2.5 rounded-lg border text-sm transition-colors ${mode === "reference" ? "border-violet-500 bg-violet-900/30 text-white" : "border-gray-700 bg-gray-950 text-gray-400 hover:text-white"}`}>
                  Use screenshot
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Creator</label>
              <select value={creator} onChange={event => setCreator(event.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
                {CREATORS.map(option => <option key={option}>{option}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Generation mode</label>
              <select value={generationModel} onChange={event => setGenerationModel(event.target.value as Generation["generation_model"])}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
                <option value="seedream">Seedream 4.5 Fast</option>
                <option value="nano_banana_pro">Nano Banana Pro Quality</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                {generationModel === "nano_banana_pro"
                  ? "Use Quality mode for important recreations. It is slower and more expensive."
                  : "Use Fast mode for inexpensive testing and larger batches."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Label (optional)</label>
              <input value={label} onChange={event => setLabel(event.target.value)}
                placeholder="e.g. Neyla street account"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"/>
            </div>

            {mode === "reference" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Reference screenshot</label>
                {referenceImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {referenceImages.map(referenceImage => (
                      <div key={referenceImage.id} className="relative overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
                        <div className="relative aspect-[4/5]">
                          <Image src={referenceImage.dataUrl} alt={referenceImage.name} fill unoptimized className="object-contain"/>
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-gray-950/90 px-1.5 py-0.5 text-[10px] text-gray-300">{referenceImage.imageSizeLabel}</span>
                        <button type="button" onClick={() => setReferenceImages(current => current.filter(image => image.id !== referenceImage.id))}
                          className="absolute right-1.5 top-1.5 rounded-md border border-gray-700 bg-gray-950/90 px-1.5 py-0.5 text-[11px] text-gray-300 hover:text-white">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {referenceImages.length < 10 && (
                  <label className="block cursor-pointer rounded-lg border border-dashed border-gray-700 bg-gray-950 px-4 py-6 text-center hover:border-violet-500">
                    <span className="block text-sm text-gray-300">{processingImage ? "Preparing screenshots..." : referenceImages.length ? "Add more screenshots" : "Upload screenshots"}</span>
                    <span className="block text-xs text-gray-600 mt-1">JPEG, PNG or WebP · up to 10 images</span>
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => void handleReferenceImage(event)}
                      disabled={processingImage} className="hidden"/>
                  </label>
                )}
                <p className="text-xs text-gray-500 mt-1.5">The selected model recreates each screenshot separately with the selected creator. The creator references remain attached automatically.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{mode === "reference" ? "Extra instructions (optional)" : "Prompt"}</label>
              <textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={mode === "reference" ? 4 : 10}
                placeholder={mode === "reference" ? "Optional: describe anything you want to change." : "Describe one image: setting, outfit, pose, framing, lighting and phone-camera style."}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-y"/>
              {mode === "prompt" && <p className="text-xs text-gray-500 mt-1.5">Creator identity references are attached automatically.</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{mode === "reference" ? "Variants per screenshot" : "Variants"}</label>
              <select value={variants} onChange={event => setVariants(Number(event.target.value))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
                {[1, 2, 3, 4, 5, 6].map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            {mode === "reference" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Variation strategy</label>
                <select value={recreationStrategy} onChange={event => setRecreationStrategy(event.target.value as RecreationStrategy)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
                  <option value="exact">Exact recreation attempts</option>
                  <option value="subtle_outfit_variations">Subtle outfit variations</option>
                  <option value="different_outfits">Different outfits, same pose</option>
                </select>
                <p className="text-xs text-gray-500 mt-1.5">{recreationStrategyDescription(recreationStrategy)}</p>
              </div>
            )}

            {error && <p className="text-sm text-red-300 border border-red-900 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

            {submissionProgress && <p className="text-xs text-violet-300">{submissionProgress}</p>}

            <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">Estimated fal cost</p>
                <p className="text-sm font-medium text-white">{formatUsd(estimatedFalCost)}</p>
              </div>
              <p className="mt-1 text-[11px] text-gray-600">
                {totalImages} {totalImages === 1 ? "image" : "images"} × {formatUsd(modelPricePerImage)}. Excludes optional fidelity QA usage.
              </p>
            </div>

            {premiumBatchNeedsConfirmation && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-violet-900 bg-violet-950/30 px-3 py-2.5">
                <input type="checkbox" checked={premiumCostConfirmed} onChange={event => setPremiumCostConfirmed(event.target.checked)}
                  className="mt-0.5 accent-violet-500"/>
                <span className="text-xs text-violet-200">Confirm this premium Quality batch before generating {totalImages} images.</span>
              </label>
            )}

            <button onClick={() => void handleGenerate()} disabled={submitting || processingImage || Boolean(batchIds.length) || !canGenerate || (premiumBatchNeedsConfirmation && !premiumCostConfirmed)}
              className="w-full px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Starting..." : batchIds.length ? "Generating..." : `Generate ${totalImages} ${totalImages === 1 ? "image" : "images"}`}
            </button>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-white font-semibold">{active.length ? "Current batch" : "Recent images"}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{active.length ? "This page updates automatically while the image model is working." : "The last 40 generated variants."}</p>
            </div>
            <button onClick={() => void loadRecent()} disabled={loadingRecent || Boolean(batchIds.length)}
              className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs disabled:opacity-50">
              Refresh history
            </button>
          </div>

          {selectableGenerationIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2.5">
              <button type="button" onClick={() => setSelectedGenerationIds(selectableGenerationIds)}
                className="text-xs text-gray-400 hover:text-white">
                Select all unsaved
              </button>
              {selectedGenerationIds.length > 0 && (
                <>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-300">{selectedGenerationIds.length} selected</span>
                  <button type="button" onClick={() => void handleSaveAssets(selectedGenerationIds)}
                    disabled={savingAssetIds.length > 0}
                    className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50">
                    {savingAssetIds.length > 0 ? "Saving..." : "Save selected to library"}
                  </button>
                  <button type="button" onClick={() => setSelectedGenerationIds([])}
                    className="text-xs text-gray-500 hover:text-white">
                    Clear
                  </button>
                </>
              )}
            </div>
          )}

          {loadingRecent && !visible.length ? (
            <div className="border border-gray-800 bg-gray-900 rounded-xl p-8 text-sm text-gray-500">Loading images...</div>
          ) : !visible.length ? (
            <div className="border border-gray-800 bg-gray-900 rounded-xl p-8 text-center">
              <p className="text-white font-medium">No images generated yet</p>
              <p className="text-gray-500 text-sm mt-1">Choose a creator and generate the first batch.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map(generation => (
                <article key={generation.id} className={`overflow-hidden bg-gray-900 border rounded-xl ${selectedGenerationIds.includes(generation.id) ? "border-violet-500" : "border-gray-800"}`}>
                  <div className="aspect-[4/5] bg-gray-950 flex items-center justify-center relative">
                    {generation.image_url ? (
                      <Image src={generation.image_url} alt={`${generation.creator} generation`} fill unoptimized className="object-cover"/>
                    ) : (
                      <p className="text-sm text-gray-600 px-5 text-center">{generation.status === "failed" ? "Generation failed" : "Generating image..."}</p>
                    )}
                    {generation.image_url && !generation.saved_asset_id && (
                      <label className="absolute left-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-600 bg-gray-950/90">
                        <input type="checkbox" checked={selectedGenerationIds.includes(generation.id)}
                          onChange={() => setSelectedGenerationIds(current => current.includes(generation.id) ? current.filter(id => id !== generation.id) : [...current, generation.id])}
                          className="accent-violet-500"/>
                      </label>
                    )}
                  </div>
                  <div className="p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-white text-sm font-medium">{generation.creator}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[generation.status] ?? "border-gray-700 bg-gray-800 text-gray-300"}`}>
                        {statusLabel(generation.status)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{generationModelLabel(generation.generation_model)}</p>
                    {generation.recreation_strategy !== "exact" && (
                      <p className="mt-1 text-[11px] text-sky-300">
                        {generation.recreation_strategy === "subtle_outfit_variations" ? "Subtle outfit variation" : "Different outfit, same pose"}
                      </p>
                    )}
                    {generation.image_url && qualityLabel(generation.qa_status) && (
                      <div className="mt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${qualityStyle(generation.qa_status)}`}>
                            {qualityLabel(generation.qa_status)}
                          </span>
                          {typeof generation.qa_score === "number" && <span className="text-[11px] text-gray-500">{generation.qa_score}/100</span>}
                        </div>
                        {generation.qa_summary && <p className="mt-1.5 text-xs text-gray-500">{generation.qa_summary}</p>}
                      </div>
                    )}
                    {generation.source_label && <p className="text-xs text-violet-300 mt-1 truncate">{generation.source_label}</p>}
                    {generation.status === "generating" && (
                      <p className="text-xs text-amber-300 mt-2">
                        {generation.fal_queue_status === "COMPLETED"
                          ? "Finalizing image result..."
                          : generation.fal_queue_status === "IN_PROGRESS"
                            ? "The image model is rendering..."
                            : "Waiting in the fal queue..."}
                      </p>
                    )}
                    {generation.status === "failed" && (
                      <>
                        <p className="text-xs text-red-300 mt-2">{generation.error_message ?? "Generation failed. Upload the screenshot again and retry."}</p>
                        {generation.can_retry && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button type="button" onClick={() => void handleRetry(generation, generation.generation_model)}
                              disabled={retryingGenerationIds.includes(generation.id) || Boolean(batchIds.length)}
                              className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50">
                              {retryingGenerationIds.includes(generation.id) ? "Retrying..." : "Retry same mode"}
                            </button>
                            {generation.generation_model !== "nano_banana_pro" && (
                              <button type="button" onClick={() => void handleRetry(generation, "nano_banana_pro")}
                                disabled={retryingGenerationIds.includes(generation.id) || Boolean(batchIds.length)}
                                className="rounded-md border border-violet-700 bg-violet-900/30 px-2.5 py-1.5 text-xs text-violet-300 hover:border-violet-500 hover:text-violet-200 disabled:opacity-50">
                                Retry with Quality
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    <p className="text-xs text-gray-500 mt-2 line-clamp-3">{generation.prompt}</p>
                    {generation.image_url && (
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <a href={generation.image_url} target="_blank" rel="noreferrer"
                          className="text-xs text-violet-300 hover:text-violet-200">
                          Open full image
                        </a>
                        {generation.saved_asset_id ? (
                          <span className="text-xs text-emerald-300">✓ Saved to library</span>
                        ) : (
                          <button type="button" onClick={() => void handleSaveAsset(generation.id)}
                            disabled={savingAssetIds.includes(generation.id)}
                            className="text-xs text-gray-400 hover:text-white disabled:opacity-50">
                            {savingAssetIds.includes(generation.id) ? "Saving..." : "Save to library"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
