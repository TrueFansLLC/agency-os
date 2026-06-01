"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

type Generation = {
  id: string
  batch_id: string
  creator: string
  source_label: string | null
  prompt: string
  image_url: string | null
  status: string
  created_at: string
  fal_queue_status: string | null
  error_message: string | null
  generation_model: string
  recreation_strategy: string
  retry_of_id: string | null
  qa_status: string
  qa_score: number | null
  can_retry: boolean
  review: { verdict: string } | null
  saved_asset: { status: string } | null
}

type Job = {
  id: string
  status: string
  created_at: string
  updated_at: string
  creators: string[]
  source_labels: string[]
  total: number
  generated: number
  generating: number
  failed: number
  retryable_failed: number
  review_required: number
  reviewed: number
  saved: number
  active_batch_ids: string[]
  models: Record<string, number>
  estimated_fal_cost_usd: number
  generations: Generation[]
}

type JobsResponse = {
  generated_at: string
  jobs: Job[]
  active_batch_ids: string[]
  creators: string[]
  summary: {
    jobs: number
    images: number
    active: number
    attention: number
    completed: number
    failed_images: number
    review_required: number
    estimated_fal_cost_usd: number
  }
}

const EMPTY_DATA: JobsResponse = {
  generated_at: "",
  jobs: [],
  active_batch_ids: [],
  creators: [],
  summary: { jobs: 0, images: 0, active: 0, attention: 0, completed: 0, failed_images: 0, review_required: 0, estimated_fal_cost_usd: 0 },
}
const MODEL_PRICE_USD: Record<string, number> = { seedream: 0.04, nano_banana_pro: 0.15 }
const JOB_STYLE: Record<string, string> = {
  generating: "border-amber-700 bg-amber-950/25 text-amber-300",
  attention: "border-orange-800 bg-orange-950/25 text-orange-300",
  failed: "border-red-800 bg-red-950/25 text-red-300",
  completed: "border-emerald-800 bg-emerald-950/25 text-emerald-300",
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function bangkokDay(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value)
}

function modelLabel(model: string) {
  return model === "nano_banana_pro" ? "Quality" : "Fast"
}

function jobLabel(status: string) {
  if (status === "generating") return "Generating"
  if (status === "attention") return "Needs attention"
  if (status === "failed") return "Failed"
  return "Completed"
}

function generationStatus(generation: Generation) {
  if (generation.status === "generating") return generation.fal_queue_status === "IN_PROGRESS" ? "Rendering" : "Queued"
  if (generation.status === "failed") return "Failed"
  if (generation.qa_status === "review_required") return "QA attention"
  if (generation.qa_status === "passed") return "QA passed"
  return "Generated"
}

function MetricCard({ label, value, accent = "text-white" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  )
}

export default function GenerationJobsPage() {
  const [data, setData] = useState<JobsResponse>(EMPTY_DATA)
  const [selectedJobId, setSelectedJobId] = useState("")
  const [creator, setCreator] = useState("all")
  const [status, setStatus] = useState("all")
  const [dateRange, setDateRange] = useState("all")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadJobs = useCallback(async () => {
    const response = await fetch("/api/generation-jobs", { cache: "no-store" })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setError(payload.error ?? "Could not load generation jobs.")
      return
    }
    setData(payload)
    setSelectedJobId(current => payload.jobs.some((job: Job) => job.id === current) ? current : payload.jobs[0]?.id ?? "")
  }, [])

  const pollActive = useCallback(async () => {
    if (!data.active_batch_ids.length) return
    await Promise.all(data.active_batch_ids.map(batchId =>
      fetch(`/api/threads/generate?batch_id=${encodeURIComponent(batchId)}`).catch(() => null)
    ))
    await loadJobs()
  }, [data.active_batch_ids, loadJobs])

  useEffect(() => {
    void loadJobs()
    const timer = window.setInterval(() => void loadJobs(), 15000)
    return () => window.clearInterval(timer)
  }, [loadJobs])

  useEffect(() => {
    if (!data.active_batch_ids.length) return
    const timer = window.setInterval(() => void pollActive(), 5000)
    return () => window.clearInterval(timer)
  }, [data.active_batch_ids.length, pollActive])

  const filteredJobs = useMemo(() => {
    const now = new Date(data.generated_at || 0)
    return data.jobs.filter(job => {
      if (creator !== "all" && !job.creators.includes(creator)) return false
      if (status !== "all" && job.status !== status) return false
      const createdAt = new Date(job.created_at).getTime()
      if (dateRange === "today" && bangkokDay(new Date(job.created_at)) !== bangkokDay(now)) return false
      if (dateRange === "7d" && createdAt < now.getTime() - 7 * 24 * 60 * 60 * 1000) return false
      if (dateRange === "30d" && createdAt < now.getTime() - 30 * 24 * 60 * 60 * 1000) return false
      return true
    })
  }, [creator, data.generated_at, data.jobs, dateRange, status])

  const selectedJob = data.jobs.find(job => job.id === selectedJobId) ?? filteredJobs[0] ?? null

  async function retryGenerations(generations: Generation[], premium = false) {
    if (!generations.length || working) return
    const estimatedCost = generations.reduce((sum, generation) => sum + (premium ? 0.15 : MODEL_PRICE_USD[generation.generation_model] ?? 0), 0)
    if (!window.confirm(`Start ${generations.length} paid ${generations.length === 1 ? "retry" : "retries"} for approximately ${formatUsd(estimatedCost)}?`)) return

    setWorking(true)
    setError("")
    setMessage("")
    const retryJobId = crypto.randomUUID()
    for (const generation of generations) {
      const response = await fetch("/api/threads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retry_generation_id: generation.id,
          generation_job_id: retryJobId,
          generation_model: premium ? "nano_banana_pro" : generation.generation_model,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.error ?? "One or more retries could not be started.")
        break
      }
    }
    setWorking(false)
    setSelectedJobId(retryJobId)
    setMessage("Retry job started. Progress will update automatically.")
    await loadJobs()
  }

  const retryableFailures = selectedJob?.generations.filter(generation => generation.status === "failed" && generation.can_retry) ?? []

  return (
    <div className="mx-auto max-w-[1800px] p-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-400">AI production</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">AI Generation Job Center</h1>
          <p className="mt-2 text-sm text-gray-400">Track multi-screenshot production jobs, review failures and restart only the images that need another attempt.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/ai-tools" className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500">Generate images</Link>
          <Link href="/quality-review" className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white">Quality review</Link>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">{message}</p> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <MetricCard label="Jobs" value={data.summary.jobs}/>
        <MetricCard label="Images" value={data.summary.images}/>
        <MetricCard label="Active" value={data.summary.active} accent={data.summary.active ? "text-amber-300" : "text-emerald-300"}/>
        <MetricCard label="Attention" value={data.summary.attention} accent={data.summary.attention ? "text-orange-300" : "text-emerald-300"}/>
        <MetricCard label="Failed images" value={data.summary.failed_images} accent={data.summary.failed_images ? "text-red-300" : "text-emerald-300"}/>
        <MetricCard label="QA review" value={data.summary.review_required} accent={data.summary.review_required ? "text-amber-300" : "text-emerald-300"}/>
        <MetricCard label="Estimated spend" value={formatUsd(data.summary.estimated_fal_cost_usd)} accent="text-violet-300"/>
      </section>

      <section className="mb-5 flex flex-wrap gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <select value={creator} onChange={event => setCreator(event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-300 focus:border-violet-500 focus:outline-none">
          <option value="all">All creators</option>
          {data.creators.map(option => <option key={option}>{option}</option>)}
        </select>
        <select value={status} onChange={event => setStatus(event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-300 focus:border-violet-500 focus:outline-none">
          <option value="all">All statuses</option>
          <option value="generating">Generating</option>
          <option value="attention">Needs attention</option>
          <option value="failed">Failed</option>
          <option value="completed">Completed</option>
        </select>
        <select value={dateRange} onChange={event => setDateRange(event.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-300 focus:border-violet-500 focus:outline-none">
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <button type="button" onClick={() => void loadJobs()}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white">
          Refresh now
        </button>
        <p className="ml-auto self-center text-xs text-gray-600">Updates every 15s{data.active_batch_ids.length ? " · active jobs every 5s" : ""}</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <section className="space-y-2">
          {loading ? <p className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-500">Loading production jobs...</p> : null}
          {!loading && !filteredJobs.length ? <p className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-500">No generation jobs match these filters.</p> : null}
          {filteredJobs.map(job => {
            const finished = job.total - job.generating
            return (
              <button key={job.id} type="button" onClick={() => setSelectedJobId(job.id)}
                className={`block w-full rounded-xl border p-4 text-left transition-colors ${selectedJob?.id === job.id ? "border-violet-500 bg-violet-950/20" : "border-gray-800 bg-gray-900 hover:border-gray-700"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{job.creators.join(", ")}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(job.created_at)} · {job.total} images</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${JOB_STYLE[job.status]}`}>{jobLabel(job.status)}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${job.total ? finished / job.total * 100 : 0}%` }}/>
                </div>
                <p className="mt-2 text-xs text-gray-500">{job.generated} generated · {job.failed} failed · {job.review_required} QA attention</p>
              </button>
            )
          })}
        </section>

        {selectedJob ? (
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-white">{selectedJob.creators.join(", ")} production job</h2>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${JOB_STYLE[selectedJob.status]}`}>{jobLabel(selectedJob.status)}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{formatDate(selectedJob.created_at)} · Job {selectedJob.id.slice(0, 8)}</p>
                {selectedJob.source_labels.length ? <p className="mt-2 text-xs text-violet-300">{selectedJob.source_labels.join(" · ")}</p> : null}
              </div>
              {retryableFailures.length ? (
                <button type="button" onClick={() => void retryGenerations(retryableFailures)} disabled={working}
                  className="rounded-lg border border-orange-700 bg-orange-950/30 px-4 py-2.5 text-sm font-medium text-orange-300 hover:border-orange-500 hover:text-orange-200 disabled:opacity-50">
                  {working ? "Starting retries..." : `Retry ${retryableFailures.length} failed ${retryableFailures.length === 1 ? "image" : "images"}`}
                </button>
              ) : null}
            </div>

            <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <MetricCard label="Total" value={selectedJob.total}/>
              <MetricCard label="Generated" value={selectedJob.generated}/>
              <MetricCard label="Generating" value={selectedJob.generating} accent={selectedJob.generating ? "text-amber-300" : "text-gray-300"}/>
              <MetricCard label="Failed" value={selectedJob.failed} accent={selectedJob.failed ? "text-red-300" : "text-emerald-300"}/>
              <MetricCard label="Reviewed" value={selectedJob.reviewed}/>
              <MetricCard label="Saved" value={selectedJob.saved}/>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {selectedJob.generations.map(generation => (
                <article key={generation.id} className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
                  <div className="relative aspect-[4/3] bg-black">
                    {generation.image_url ? (
                      <Image src={generation.image_url} alt={`${generation.creator} generation`} fill unoptimized className="object-cover"/>
                    ) : (
                      <div className="flex h-full items-center justify-center px-5 text-center text-sm text-gray-600">{generation.status === "failed" ? "Generation failed" : "Generating image..."}</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{generationStatus(generation)}</p>
                      <span className="text-[11px] text-gray-500">{modelLabel(generation.generation_model)}</span>
                    </div>
                    {typeof generation.qa_score === "number" ? <p className="mt-1 text-xs text-gray-500">Fidelity QA {generation.qa_score}/100</p> : null}
                    {generation.error_message ? <p className="mt-2 text-xs text-red-300">{generation.error_message}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {generation.image_url ? <a href={generation.image_url} target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:text-violet-200">Open image</a> : null}
                      {generation.saved_asset ? <span className="text-xs text-emerald-300">Saved</span> : null}
                      {generation.review ? <span className="text-xs text-sky-300">{generation.review.verdict}</span> : null}
                      {generation.status === "failed" && generation.can_retry ? (
                        <button type="button" onClick={() => void retryGenerations([generation])} disabled={working}
                          className="text-xs text-orange-300 hover:text-orange-200 disabled:opacity-50">
                          Retry same mode
                        </button>
                      ) : null}
                      {generation.status === "failed" && generation.can_retry && generation.generation_model !== "nano_banana_pro" ? (
                        <button type="button" onClick={() => void retryGenerations([generation], true)} disabled={working}
                          className="text-xs text-violet-300 hover:text-violet-200 disabled:opacity-50">
                          Retry with Quality
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">Select a production job to inspect its images.</section>
        )}
      </div>
    </div>
  )
}
