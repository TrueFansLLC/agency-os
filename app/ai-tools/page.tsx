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
}

type ReferenceImage = {
  id: string
  name: string
  dataUrl: string
}

const CREATORS = ["Cathy", "Neyla", "Romina"]
const MAX_REFERENCE_IMAGE_LENGTH = 2_500_000
const RECREATE_PROMPT = "Use the final input image as the visual scene reference. Recreate it as a new realistic smartphone photo featuring the same selected creator identity shown in the preceding identity reference images. Preserve the final reference image's pose, camera angle, crop, setting, lighting, outfit category and overall mood as closely as possible. Do not blend identities or retain the original person's facial features."
const STATUS_STYLE: Record<string, string> = {
  generating: "border-amber-700 bg-amber-900/30 text-amber-300",
  pending: "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  failed: "border-red-800 bg-red-900/30 text-red-300",
}

function statusLabel(status: string) {
  if (status === "generating") return "Generating"
  if (status === "pending") return "Ready"
  if (status === "failed") return "Failed"
  return status
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
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function AIToolsPage() {
  const [mode, setMode] = useState<"prompt" | "reference">("prompt")
  const [creator, setCreator] = useState("Cathy")
  const [label, setLabel] = useState("")
  const [prompt, setPrompt] = useState("")
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [variants, setVariants] = useState(2)
  const [batchIds, setBatchIds] = useState<string[]>([])
  const [active, setActive] = useState<Generation[]>([])
  const [recent, setRecent] = useState<Generation[]>([])
  const [error, setError] = useState("")
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [submissionProgress, setSubmissionProgress] = useState("")
  const [savingAssetIds, setSavingAssetIds] = useState<string[]>([])

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

  async function handleGenerate() {
    const cleanPrompt = prompt.trim()
    if (mode === "prompt" && !cleanPrompt) return
    if (mode === "reference" && !referenceImages.length) return
    const effectivePrompt = mode === "reference"
      ? `${RECREATE_PROMPT}${cleanPrompt ? ` Additional instructions: ${cleanPrompt}` : ""}`
      : cleanPrompt

    setSubmitting(true)
    setError("")
    setActive([])
    setSubmissionProgress("")

    const jobs = mode === "reference"
      ? referenceImages.flatMap(referenceImage => Array.from({ length: variants }, () => referenceImage))
      : [null]
    const submittedBatchIds: string[] = []

    for (const [index, referenceImage] of jobs.entries()) {
      setSubmissionProgress(jobs.length > 1 ? `Submitting ${index + 1} of ${jobs.length}...` : "")
      const response = await fetch("/api/threads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator,
          source_label: [label.trim(), referenceImage?.name].filter(Boolean).join(" · "),
          prompts: mode === "prompt" ? Array.from({ length: variants }, () => effectivePrompt) : [effectivePrompt],
          reference_image_data_url: referenceImage?.dataUrl,
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

  async function handleReferenceImage(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 10 - referenceImages.length))
    event.target.value = ""
    if (!files.length) return

    setProcessingImage(true)
    setError("")
    try {
      const prepared: ReferenceImage[] = []
      for (const file of files) {
        prepared.push({ id: crypto.randomUUID(), name: file.name, dataUrl: await compressReferenceImage(file) })
      }
      setReferenceImages(current => [...current, ...prepared])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The screenshot could not be processed.")
    } finally {
      setProcessingImage(false)
    }
  }

  async function handleSaveAsset(generationId: string) {
    setSavingAssetIds(current => [...current, generationId])
    setError("")
    const response = await fetch("/api/content-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation_id: generationId }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingAssetIds(current => current.filter(id => id !== generationId))
    if (!response.ok) {
      setError(data.error ?? "The image could not be saved to the content library.")
      return
    }

    const markSaved = (generation: Generation) => generation.id === generationId
      ? { ...generation, saved_asset_id: data.id, asset_status: data.status }
      : generation
    setActive(current => current.map(markSaved))
    setRecent(current => current.map(markSaved))
  }

  const visible = active.length ? active : recent
  const canGenerate = mode === "prompt" ? Boolean(prompt.trim()) : Boolean(referenceImages.length)
  const totalImages = mode === "reference" ? referenceImages.length * variants : variants

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">AI Image Generator</h1>
            <span className="text-xs px-2.5 py-1 rounded-full border border-violet-700 bg-violet-900/30 text-violet-300">
              Seedream 4.5
            </span>
          </div>
          <Link href="/content-bank" className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs">
            Open content bank
          </Link>
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
                <p className="text-xs text-gray-500 mt-1.5">Seedream recreates each screenshot separately with the selected creator. The creator references remain attached automatically.</p>
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

            {error && <p className="text-sm text-red-300 border border-red-900 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

            {submissionProgress && <p className="text-xs text-violet-300">{submissionProgress}</p>}

            <button onClick={() => void handleGenerate()} disabled={submitting || processingImage || Boolean(batchIds.length) || !canGenerate}
              className="w-full px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Starting..." : batchIds.length ? "Generating..." : `Generate ${totalImages} ${totalImages === 1 ? "image" : "images"}`}
            </button>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-white font-semibold">{active.length ? "Current batch" : "Recent images"}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{active.length ? "This page updates automatically while Seedream is working." : "The last 40 generated variants."}</p>
            </div>
            <button onClick={() => void loadRecent()} disabled={loadingRecent || Boolean(batchIds.length)}
              className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs disabled:opacity-50">
              Refresh history
            </button>
          </div>

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
                <article key={generation.id} className="overflow-hidden bg-gray-900 border border-gray-800 rounded-xl">
                  <div className="aspect-[4/5] bg-gray-950 flex items-center justify-center relative">
                    {generation.image_url ? (
                      <Image src={generation.image_url} alt={`${generation.creator} generation`} fill unoptimized className="object-cover"/>
                    ) : (
                      <p className="text-sm text-gray-600 px-5 text-center">{generation.status === "failed" ? "Generation failed" : "Generating image..."}</p>
                    )}
                  </div>
                  <div className="p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-white text-sm font-medium">{generation.creator}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[generation.status] ?? "border-gray-700 bg-gray-800 text-gray-300"}`}>
                        {statusLabel(generation.status)}
                      </span>
                    </div>
                    {generation.source_label && <p className="text-xs text-violet-300 mt-1 truncate">{generation.source_label}</p>}
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
