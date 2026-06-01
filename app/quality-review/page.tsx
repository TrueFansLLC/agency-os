"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

type Verdict = "approved" | "usable" | "rejected"
type GenerationModel = "seedream" | "nano_banana_pro"
type QaStatus = "pending" | "passed" | "review_required" | "failed" | "skipped"
type RecreationStrategy = "exact" | "subtle_outfit_variations" | "different_outfits"

type Review = {
  generation_id: string
  verdict: Verdict
  reasons: string[]
  notes: string | null
  updated_at: string
}

type Generation = {
  id: string
  creator: string
  source_label: string | null
  prompt: string
  image_url: string
  created_at: string
  generation_model: GenerationModel
  recreation_strategy: RecreationStrategy
  qa_status: QaStatus
  qa_score: number | null
  qa_summary: string | null
  qa_details: {
    scores?: Record<string, number>
    notes?: string[]
  } | null
  blueprint_preview_url: string | null
  review: Review | null
  saved_asset: { id: string; status: string } | null
}

type ReviewStats = {
  total: number
  reviewed: number
  unreviewed: number
  approved: number
  usable: number
  rejected: number
  qa_passed: number
  qa_review_required: number
  by_model: Record<GenerationModel, { total: number; reviewed: number; accepted: number }>
}

const EMPTY_STATS: ReviewStats = {
  total: 0,
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

const CREATORS = ["all", "Cathy", "Neyla", "Romina"]
const REJECTION_REASONS = [
  { value: "wrong_identity", label: "Wrong identity" },
  { value: "wrong_outfit", label: "Wrong outfit" },
  { value: "wrong_crop", label: "Wrong crop" },
  { value: "wrong_pose", label: "Wrong pose" },
  { value: "wrong_background", label: "Wrong background" },
  { value: "coverage_mismatch", label: "Coverage mismatch" },
  { value: "low_realism", label: "Low realism" },
  { value: "other", label: "Other" },
]

function modelLabel(model: GenerationModel) {
  return model === "nano_banana_pro" ? "Nano Banana Pro" : "Seedream 4.5"
}

function recreationStrategyLabel(strategy: RecreationStrategy) {
  if (strategy === "subtle_outfit_variations") return "Subtle outfit variations"
  if (strategy === "different_outfits") return "Different outfits, same pose"
  return "Exact recreation attempts"
}

function qaLabel(status: QaStatus) {
  if (status === "passed") return "QA passed"
  if (status === "review_required") return "Review required"
  if (status === "failed") return "Manual review"
  if (status === "pending") return "QA pending"
  return "Not scored"
}

function qaStyle(status: QaStatus) {
  if (status === "passed") return "border-emerald-700 bg-emerald-900/30 text-emerald-300"
  if (status === "review_required") return "border-amber-700 bg-amber-900/30 text-amber-300"
  return "border-gray-700 bg-gray-800 text-gray-300"
}

function verdictStyle(verdict: Verdict) {
  if (verdict === "approved") return "border-emerald-700 bg-emerald-900/30 text-emerald-300"
  if (verdict === "usable") return "border-sky-700 bg-sky-900/30 text-sky-300"
  return "border-red-800 bg-red-900/30 text-red-300"
}

function acceptanceRate(model: ReviewStats["by_model"][GenerationModel]) {
  return model.reviewed ? Math.round(model.accepted / model.reviewed * 100) : null
}

export default function QualityReviewPage() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [stats, setStats] = useState<ReviewStats>(EMPTY_STATS)
  const [selectedId, setSelectedId] = useState("")
  const [creator, setCreator] = useState("all")
  const [reviewFilter, setReviewFilter] = useState<"all" | "unreviewed" | Verdict>("unreviewed")
  const [qaFilter, setQaFilter] = useState<"all" | QaStatus>("all")
  const [modelFilter, setModelFilter] = useState<"all" | GenerationModel>("all")
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError("")
    const response = await fetch(`/api/generation-reviews?creator=${encodeURIComponent(creator)}`)
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setError(data.error ?? "Could not load the quality review queue.")
      return
    }
    setGenerations(data.generations ?? [])
    setStats(data.stats ?? EMPTY_STATS)
  }, [creator])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const filteredGenerations = useMemo(() => generations.filter(generation => {
    if (reviewFilter === "unreviewed" && generation.review) return false
    if (reviewFilter !== "all" && reviewFilter !== "unreviewed" && generation.review?.verdict !== reviewFilter) return false
    if (qaFilter !== "all" && generation.qa_status !== qaFilter) return false
    if (modelFilter !== "all" && generation.generation_model !== modelFilter) return false
    return true
  }), [generations, modelFilter, qaFilter, reviewFilter])

  const selected = useMemo(
    () => generations.find(generation => generation.id === selectedId) ?? null,
    [generations, selectedId]
  )

  useEffect(() => {
    if (!filteredGenerations.length) {
      setSelectedId("")
      return
    }
    if (!filteredGenerations.some(generation => generation.id === selectedId)) {
      setSelectedId(filteredGenerations[0].id)
    }
  }, [filteredGenerations, selectedId])

  useEffect(() => {
    setRejectionReasons(selected?.review?.reasons ?? [])
    setNotes(selected?.review?.notes ?? "")
    setMessage("")
  }, [selected])

  function moveToNext(currentId: string) {
    const currentIndex = filteredGenerations.findIndex(generation => generation.id === currentId)
    const next = filteredGenerations.slice(currentIndex + 1).find(generation => !generation.review)
      ?? filteredGenerations.find(generation => generation.id !== currentId && !generation.review)
      ?? filteredGenerations.find(generation => generation.id !== currentId)
    if (next) setSelectedId(next.id)
  }

  async function saveReview(verdict: Verdict) {
    if (!selected) return
    setWorking(true)
    setError("")
    setMessage("")
    const response = await fetch("/api/generation-reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generation_id: selected.id,
        verdict,
        reasons: verdict === "rejected" ? rejectionReasons : [],
        notes,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setWorking(false)
    if (!response.ok) {
      setError(data.error ?? "The review could not be saved.")
      return
    }
    setGenerations(current => current.map(generation => generation.id === selected.id ? { ...generation, review: data } : generation))
    setStats(current => {
      const previous = selected.review?.verdict
      const modelStats = { ...current.by_model[selected.generation_model] }
      const next = { ...current, by_model: { ...current.by_model, [selected.generation_model]: modelStats } }
      if (!previous) {
        next.reviewed += 1
        modelStats.reviewed += 1
      } else {
        next[previous] -= 1
        if (previous !== "rejected") modelStats.accepted -= 1
      }
      next.unreviewed = Math.max(0, next.total - next.reviewed)
      next[verdict] += 1
      if (verdict !== "rejected") modelStats.accepted += 1
      return next
    })
    setMessage(`${verdict === "approved" ? "Approved" : verdict === "usable" ? "Marked usable" : "Rejection saved"}.`)
    moveToNext(selected.id)
  }

  async function clearReview() {
    if (!selected?.review) return
    setWorking(true)
    setError("")
    const response = await fetch("/api/generation-reviews", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation_id: selected.id }),
    })
    const data = await response.json().catch(() => ({}))
    setWorking(false)
    if (!response.ok) {
      setError(data.error ?? "The review could not be cleared.")
      return
    }
    await loadReviews()
  }

  async function retry(retryModel: GenerationModel) {
    if (!selected) return
    setWorking(true)
    setError("")
    setMessage("")
    const response = await fetch("/api/threads/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retry_generation_id: selected.id, generation_model: retryModel }),
    })
    const data = await response.json().catch(() => ({}))
    setWorking(false)
    if (!response.ok) {
      setError(data.error ?? "The retry could not be started.")
      return
    }
    setMessage(`Retry started with ${modelLabel(retryModel)}. It will appear in this queue after generation and QA finish.`)
  }

  async function saveToLibrary() {
    if (!selected || selected.saved_asset) return
    setWorking(true)
    setError("")
    const response = await fetch("/api/content-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation_id: selected.id }),
    })
    const data = await response.json().catch(() => ({}))
    setWorking(false)
    if (!response.ok) {
      setError(data.error ?? "The image could not be saved to the content bank.")
      return
    }
    setGenerations(current => current.map(generation => generation.id === selected.id ? { ...generation, saved_asset: data } : generation))
    setMessage("Saved to the content bank.")
  }

  function toggleReason(reason: string) {
    setRejectionReasons(current => current.includes(reason) ? current.filter(value => value !== reason) : [...current, reason])
  }

  const seedreamRate = acceptanceRate(stats.by_model.seedream)
  const nanoRate = acceptanceRate(stats.by_model.nano_banana_pro)
  const progress = Math.min(100, Math.round(stats.reviewed / 20 * 100))

  return (
    <div className="mx-auto max-w-[1800px] p-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quality Review</h1>
          <p className="mt-1 text-sm text-gray-400">Calibrate automated QA and approve only recreations that are actually useful.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/ai-tools" className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500">Generate images</Link>
          <Link href="/generation-jobs" className="rounded-lg border border-sky-700 bg-sky-950/20 px-4 py-2.5 text-sm text-sky-300 hover:border-sky-500 hover:text-sky-200">Open job center</Link>
          <Link href="/content-bank" className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white">Open content bank</Link>
        </div>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Calibration target</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.reviewed}<span className="text-sm text-gray-500"> / 20</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }}/></div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Queue</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.unreviewed}</p>
          <p className="mt-1 text-xs text-gray-500">{stats.total} blueprint recreations</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Verdicts</p>
          <p className="mt-2 text-sm text-emerald-300">{stats.approved} approved</p>
          <p className="mt-1 text-sm text-sky-300">{stats.usable} usable · <span className="text-red-300">{stats.rejected} rejected</span></p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Seedream acceptance</p>
          <p className="mt-2 text-2xl font-semibold text-white">{seedreamRate === null ? "—" : `${seedreamRate}%`}</p>
          <p className="mt-1 text-xs text-gray-500">{stats.by_model.seedream.reviewed} manually reviewed</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500">Nano Banana acceptance</p>
          <p className="mt-2 text-2xl font-semibold text-white">{nanoRate === null ? "—" : `${nanoRate}%`}</p>
          <p className="mt-1 text-xs text-gray-500">{stats.by_model.nano_banana_pro.reviewed} manually reviewed</p>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p>}
      {message && <p className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">{message}</p>}

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="h-fit rounded-xl border border-gray-800 bg-gray-900 p-3">
          <div className="grid gap-2">
            <select value={creator} onChange={event => setCreator(event.target.value)} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
              {CREATORS.map(option => <option key={option} value={option}>{option === "all" ? "All creators" : option}</option>)}
            </select>
            <select value={reviewFilter} onChange={event => setReviewFilter(event.target.value as typeof reviewFilter)} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
              <option value="unreviewed">Unreviewed only</option>
              <option value="all">All verdicts</option>
              <option value="approved">Approved</option>
              <option value="usable">Usable</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={qaFilter} onChange={event => setQaFilter(event.target.value as typeof qaFilter)} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
              <option value="all">All QA signals</option>
              <option value="review_required">QA: review required</option>
              <option value="passed">QA: passed</option>
              <option value="skipped">QA: not scored</option>
            </select>
            <select value={modelFilter} onChange={event => setModelFilter(event.target.value as typeof modelFilter)} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
              <option value="all">All providers</option>
              <option value="seedream">Seedream 4.5</option>
              <option value="nano_banana_pro">Nano Banana Pro</option>
            </select>
          </div>

          <div className="mt-3 max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p className="p-4 text-center text-xs text-gray-500">Loading review queue...</p>
            ) : filteredGenerations.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-500">No recreations match these filters.</p>
            ) : filteredGenerations.map(generation => (
              <button key={generation.id} type="button" onClick={() => setSelectedId(generation.id)}
                className={`w-full rounded-lg border p-2 text-left transition-colors ${selectedId === generation.id ? "border-violet-500 bg-violet-950/20" : "border-gray-800 bg-gray-950 hover:border-gray-700"}`}>
                <div className="flex gap-2">
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-gray-900">
                    <Image src={generation.image_url} alt={`${generation.creator} recreation`} fill unoptimized className="object-cover"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-white">{generation.creator}</p>
                      {generation.review && <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${verdictStyle(generation.review.verdict)}`}>{generation.review.verdict}</span>}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-gray-500">{modelLabel(generation.generation_model)}</p>
                    <p className="mt-1 text-[11px] text-gray-600">{typeof generation.qa_score === "number" ? `QA ${generation.qa_score}/100` : qaLabel(generation.qa_status)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          {!selected ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
              <p className="font-medium text-white">No image selected</p>
              <p className="mt-1 text-sm text-gray-500">Choose a recreation from the review queue.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-white">{selected.creator}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${qaStyle(selected.qa_status)}`}>{qaLabel(selected.qa_status)}</span>
                      {typeof selected.qa_score === "number" && <span className="text-xs text-gray-400">{selected.qa_score}/100</span>}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{modelLabel(selected.generation_model)} · {recreationStrategyLabel(selected.recreation_strategy)} · {selected.source_label ?? "No label"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void retry(selected.generation_model)} disabled={working}
                      className="rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50">
                      Retry same mode
                    </button>
                    {selected.generation_model !== "nano_banana_pro" && (
                      <button type="button" onClick={() => void retry("nano_banana_pro")} disabled={working}
                        className="rounded-md border border-violet-700 bg-violet-900/30 px-3 py-2 text-xs text-violet-300 hover:border-violet-500 hover:text-violet-200 disabled:opacity-50">
                        Retry with Quality
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <figure>
                    <figcaption className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Original blueprint</figcaption>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
                      {selected.blueprint_preview_url
                        ? <Image src={selected.blueprint_preview_url} alt="Original blueprint" fill unoptimized className="object-contain"/>
                        : <p className="flex h-full items-center justify-center text-xs text-gray-600">Blueprint preview unavailable</p>}
                    </div>
                  </figure>
                  <figure>
                    <figcaption className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Generated recreation</figcaption>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
                      <Image src={selected.image_url} alt="Generated recreation" fill unoptimized className="object-contain"/>
                    </div>
                  </figure>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <h3 className="font-medium text-white">Automated fidelity QA</h3>
                  <p className="mt-1 text-sm text-gray-400">{selected.qa_summary ?? "No automated comparison is available for this image."}</p>
                  {selected.qa_details?.scores && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {Object.entries(selected.qa_details.scores).map(([label, score]) => (
                        <div key={label} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs capitalize text-gray-400">{label}</span>
                            <span className="text-xs text-white">{score}/100</span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${score}%` }}/></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selected.qa_details?.notes && selected.qa_details.notes.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {selected.qa_details.notes.map(note => <p key={note} className="text-xs text-gray-500">· {note}</p>)}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <h3 className="font-medium text-white">Your verdict</h3>
                  <p className="mt-1 text-xs text-gray-500">Your feedback calibrates the automated QA threshold.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => void saveReview("approved")} disabled={working}
                      className="rounded-lg border border-emerald-700 bg-emerald-900/20 px-3 py-2.5 text-sm text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50">
                      Approve
                    </button>
                    <button type="button" onClick={() => void saveReview("usable")} disabled={working}
                      className="rounded-lg border border-sky-700 bg-sky-900/20 px-3 py-2.5 text-sm text-sky-300 hover:bg-sky-900/40 disabled:opacity-50">
                      Usable
                    </button>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-500">Reject reasons</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {REJECTION_REASONS.map(reason => (
                      <button key={reason.value} type="button" onClick={() => toggleReason(reason.value)}
                        className={`rounded-full border px-2.5 py-1 text-xs ${rejectionReasons.includes(reason.value) ? "border-red-700 bg-red-900/30 text-red-300" : "border-gray-700 text-gray-400 hover:text-white"}`}>
                        {reason.label}
                      </button>
                    ))}
                  </div>
                  <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} placeholder="Optional notes..."
                    className="mt-3 w-full resize-y rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"/>
                  <button type="button" onClick={() => void saveReview("rejected")} disabled={working || !rejectionReasons.length}
                    className="mt-2 w-full rounded-lg border border-red-800 bg-red-950/30 px-3 py-2.5 text-sm text-red-300 hover:bg-red-900/30 disabled:opacity-50">
                    Save rejection
                  </button>

                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-800 pt-3">
                    {selected.saved_asset ? (
                      <span className="text-xs text-emerald-300">Saved to content bank</span>
                    ) : (
                      <button type="button" onClick={() => void saveToLibrary()} disabled={working}
                        className="text-xs text-violet-300 hover:text-violet-200 disabled:opacity-50">
                        Save to content bank
                      </button>
                    )}
                    {selected.review && (
                      <button type="button" onClick={() => void clearReview()} disabled={working}
                        className="ml-auto text-xs text-gray-500 hover:text-white disabled:opacity-50">
                        Clear verdict
                      </button>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
