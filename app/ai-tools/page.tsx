"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"

type Generation = {
  id: string
  batch_id: string
  creator: string
  prompt: string
  image_url: string | null
  status: string
  source_label: string | null
  created_at: string
}

const CREATORS = ["Cathy", "Neyla", "Romina"]
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

export default function AIToolsPage() {
  const [creator, setCreator] = useState("Cathy")
  const [label, setLabel] = useState("")
  const [prompt, setPrompt] = useState("")
  const [variants, setVariants] = useState(2)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [active, setActive] = useState<Generation[]>([])
  const [recent, setRecent] = useState<Generation[]>([])
  const [error, setError] = useState("")
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  const pollBatch = useCallback(async (id: string) => {
    const response = await fetch(`/api/threads/generate?batch_id=${encodeURIComponent(id)}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error ?? "Could not update the batch.")
      setBatchId(null)
      return
    }

    const generations = (data.generations ?? []) as Generation[]
    setActive(generations)
    if (generations.length && generations.every(generation => generation.status !== "generating")) {
      setBatchId(null)
      await loadRecent()
    }
  }, [loadRecent])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(() => {
    if (!batchId) return
    void pollBatch(batchId)
    const timer = window.setInterval(() => void pollBatch(batchId), 3000)
    return () => window.clearInterval(timer)
  }, [batchId, pollBatch])

  async function handleGenerate() {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt) return

    setSubmitting(true)
    setError("")
    setActive([])
    const response = await fetch("/api/threads/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator,
        source_label: label,
        prompts: Array.from({ length: variants }, () => cleanPrompt),
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSubmitting(false)
    if (!response.ok) {
      setError(data.error ?? "Generation could not be started.")
      return
    }
    setBatchId(data.batch_id)
  }

  const visible = active.length ? active : recent

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-white">AI Image Generator</h1>
          <span className="text-xs px-2.5 py-1 rounded-full border border-violet-700 bg-violet-900/30 text-violet-300">
            Seedream 4.5
          </span>
        </div>
        <p className="text-gray-400 mt-1 text-sm">Create Threads images with the saved creator references. Start with one scene and generate a few variants.</p>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-fit">
          <div className="space-y-4">
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

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Prompt</label>
              <textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={10}
                placeholder="Describe one image: setting, outfit, pose, framing, lighting and phone-camera style."
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 resize-y"/>
              <p className="text-xs text-gray-500 mt-1.5">Creator identity references are attached automatically.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Variants</label>
              <select value={variants} onChange={event => setVariants(Number(event.target.value))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
                {[1, 2, 3, 4, 5, 6].map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            {error && <p className="text-sm text-red-300 border border-red-900 bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

            <button onClick={() => void handleGenerate()} disabled={submitting || Boolean(batchId) || !prompt.trim()}
              className="w-full px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Starting..." : batchId ? "Generating..." : `Generate ${variants} ${variants === 1 ? "image" : "images"}`}
            </button>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-white font-semibold">{active.length ? "Current batch" : "Recent images"}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{active.length ? "This page updates automatically while Seedream is working." : "The last 40 generated variants."}</p>
            </div>
            <button onClick={() => void loadRecent()} disabled={loadingRecent || Boolean(batchId)}
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
                      <a href={generation.image_url} target="_blank" rel="noreferrer"
                        className="inline-flex mt-3 text-xs text-violet-300 hover:text-violet-200">
                        Open full image
                      </a>
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
