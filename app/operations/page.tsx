"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type StatusCounts = Record<string, number>
type AlertSeverity = "critical" | "warning" | "info"

type OperationsData = {
  generated_at: string
  date: string
  summary: {
    critical_alerts: number
    warning_alerts: number
    account_issues: number
    open_tasks: number
  }
  posts: {
    total: number
    by_status: StatusCounts
    overdue: number
  }
  threads: {
    accounts_total: number
    accounts_by_status: StatusCounts
    batches_total: number
    batches_by_status: StatusCounts
    blocked: number
  }
  status_checks: {
    total: number
    complete: number
    incomplete: number
    expected_screenshots: number
    received_screenshots: number
  }
  ai: {
    generated_today: number
    generating: number
    failed: number
    review_required: number
    review_queue: number
    estimated_fal_cost_usd: number
    by_model: {
      seedream: number
      nano_banana_pro: number
    }
  }
  team: {
    total: number
    telegram_connected: number
    setup_issues: number
  }
  content_inventory: Array<{
    creator: string
    total: number
    available: number
    saved: number
    ready: number
    assigned: number
    used: number
    archived: number
    low_stock: boolean
  }>
  alerts: Array<{
    id: string
    severity: AlertSeverity
    title: string
    detail: string
    href: string
  }>
  tasks: Array<{
    id: string
    title: string
    assignee: string
    priority: string
    status: string
    due_date: string | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  geplant: "Planned",
  bereit: "Ready",
  gesendet: "Sent",
  gepostet: "Confirmed",
  wartet: "Parked",
  ready: "Ready",
  sent: "Sent",
  posted: "Posted",
  deleted: "Deleted",
  blocked: "Blocked",
  active: "Active",
  warmup: "Warmup",
  restricted: "Restricted",
  paused: "Paused",
  banned: "Banned",
}

const ALERT_STYLES: Record<AlertSeverity, string> = {
  critical: "border-red-900 bg-red-950/35 text-red-300",
  warning: "border-amber-900 bg-amber-950/30 text-amber-300",
  info: "border-sky-900 bg-sky-950/25 text-sky-300",
}

function MetricCard({
  label,
  value,
  detail,
  accent = "text-white",
}: {
  label: string
  value: string | number
  detail: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  )
}

function StatusPills({ counts }: { counts: StatusCounts }) {
  const items = Object.entries(counts).filter(([, count]) => count > 0)
  return items.length ? (
    <div className="flex flex-wrap gap-2">
      {items.map(([status, count]) => (
        <span key={status} className="rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-xs text-gray-400">
          {STATUS_LABELS[status] ?? status}: <span className="text-white">{count}</span>
        </span>
      ))}
    </div>
  ) : <p className="text-xs text-gray-600">No activity yet.</p>
}

function SectionHeader({
  title,
  detail,
  href,
}: {
  title: string
  detail: string
  href?: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">{detail}</p>
      </div>
      {href ? <Link href={href} className="text-xs text-violet-300 hover:text-violet-200">Open details</Link> : null}
    </div>
  )
}

function formatRefreshTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value))
}

export default function OperationsPage() {
  const [data, setData] = useState<OperationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadOperations = useCallback(async () => {
    setError("")
    const response = await fetch("/api/operations-summary", { cache: "no-store" })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error ?? "Could not load daily operations.")
      setLoading(false)
      return
    }
    setData(payload)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadOperations()
    const timer = window.setInterval(() => void loadOperations(), 30_000)
    return () => window.clearInterval(timer)
  }, [loadOperations])

  if (loading && !data) {
    return <div className="p-8 text-sm text-gray-500">Loading daily operations...</div>
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
          {error || "Daily operations are currently unavailable."}
        </div>
      </div>
    )
  }

  const confirmedPosts = data.posts.by_status.gepostet ?? 0
  const sentThreads = (data.threads.batches_by_status.sent ?? 0)
    + (data.threads.batches_by_status.posted ?? 0)
    + (data.threads.batches_by_status.deleted ?? 0)

  return (
    <div className="mx-auto max-w-[1500px] p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-400">Live operations</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Daily Operations Control Tower</h1>
          <p className="mt-2 text-sm text-gray-400">
            One place to review today&apos;s posting, account health, content stock and AI workload for {data.date}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-600">Updated {formatRefreshTime(data.generated_at)} Bangkok time · auto-refreshes every 30s</p>
          <button type="button" onClick={() => void loadOperations()}
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-gray-500 hover:text-white">
            Refresh now
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Critical alerts" value={data.summary.critical_alerts}
          detail="Restricted, banned or blocked" accent={data.summary.critical_alerts ? "text-red-300" : "text-emerald-300"}/>
        <MetricCard label="Posts confirmed" value={`${confirmedPosts}/${data.posts.total}`}
          detail={`${data.posts.overdue} overdue confirmation${data.posts.overdue === 1 ? "" : "s"}`} accent="text-emerald-300"/>
        <MetricCard label="Threads batches" value={`${sentThreads}/${data.threads.batches_total}`}
          detail={`${data.threads.blocked} blocked today`} accent={data.threads.blocked ? "text-red-300" : "text-sky-300"}/>
        <MetricCard label="Status checks" value={`${data.status_checks.complete}/${data.status_checks.total}`}
          detail={`${data.status_checks.received_screenshots}/${data.status_checks.expected_screenshots} screenshots received`} accent="text-sky-300"/>
        <MetricCard label="AI images today" value={data.ai.generated_today}
          detail={`${data.ai.generating} generating · ${data.ai.failed} failed`} accent={data.ai.failed ? "text-amber-300" : "text-violet-300"}/>
        <MetricCard label="Estimated fal cost" value={`$${data.ai.estimated_fal_cost_usd.toFixed(2)}`}
          detail="Image calls today · QA excluded" accent="text-violet-300"/>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="Priority inbox" detail="The most important operational issues, sorted by urgency."/>
          <div className="space-y-2">
            {data.alerts.length ? data.alerts.map(alert => (
              <Link key={alert.id} href={alert.href}
                className={`block rounded-lg border px-3.5 py-3 transition-colors hover:border-gray-600 ${ALERT_STYLES[alert.severity]}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{alert.title}</p>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{alert.severity}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{alert.detail}</p>
              </Link>
            )) : (
              <div className="rounded-lg border border-emerald-900 bg-emerald-950/25 px-4 py-5 text-sm text-emerald-300">
                No operational alerts. Everything currently looks calm.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="Open tasks" detail={`${data.summary.open_tasks} recent open task${data.summary.open_tasks === 1 ? "" : "s"} shown.`} href="/tasks"/>
          <div className="space-y-2">
            {data.tasks.length ? data.tasks.map(task => (
              <div key={task.id} className="rounded-lg border border-gray-800 bg-gray-950 px-3.5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-white">{task.title}</p>
                  <span className="rounded-full border border-gray-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-500">{task.priority}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {task.assignee || "Unassigned"} · {task.status}{task.due_date ? ` · Due ${task.due_date}` : ""}
                </p>
              </div>
            )) : <p className="text-sm text-gray-500">No open tasks.</p>}
          </div>
        </section>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="Scheduled posts" detail={`${data.posts.total} Instagram and Facebook post${data.posts.total === 1 ? "" : "s"} today.`} href="/posting-planer"/>
          <StatusPills counts={data.posts.by_status}/>
        </section>
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="Threads accounts" detail={`${data.threads.accounts_total} active account record${data.threads.accounts_total === 1 ? "" : "s"}.`} href="/threads"/>
          <StatusPills counts={data.threads.accounts_by_status}/>
        </section>
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="Threads posting batches" detail={`${data.threads.batches_total} batch${data.threads.batches_total === 1 ? "" : "es"} planned today.`} href="/threads"/>
          <StatusPills counts={data.threads.batches_by_status}/>
        </section>
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="Team connections" detail={`${data.team.telegram_connected}/${data.team.total} employees connected to Telegram.`} href="/employees"/>
          <p className={`text-3xl font-semibold ${data.team.setup_issues ? "text-amber-300" : "text-emerald-300"}`}>{data.team.setup_issues}</p>
          <p className="mt-1 text-xs text-gray-500">incomplete setup records</p>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="Reusable content inventory" detail="Saved, ready and assigned images remain available until marked as used or archived." href="/content-bank"/>
          <div className="grid gap-3 md:grid-cols-3">
            {data.content_inventory.map(inventory => (
              <div key={inventory.creator} className={`rounded-lg border p-4 ${inventory.low_stock ? "border-amber-900 bg-amber-950/20" : "border-gray-800 bg-gray-950"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{inventory.creator}</p>
                  {inventory.low_stock ? <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">Low stock</span> : null}
                </div>
                <p className="mt-3 text-3xl font-semibold text-white">{inventory.available}</p>
                <p className="mt-1 text-xs text-gray-500">reusable images available</p>
                <p className="mt-3 text-[11px] text-gray-600">
                  Saved {inventory.saved} · Ready {inventory.ready} · Assigned {inventory.assigned} · Used {inventory.used}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <SectionHeader title="AI production" detail="Today&apos;s generation workload and human review backlog." href="/generation-jobs"/>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Seedream" value={data.ai.by_model.seedream} detail="Fast image calls"/>
            <MetricCard label="Quality" value={data.ai.by_model.nano_banana_pro} detail="Nano Banana Pro calls"/>
            <MetricCard label="Review queue" value={data.ai.review_queue} detail="Human calibration backlog" accent={data.ai.review_queue ? "text-sky-300" : "text-emerald-300"}/>
            <MetricCard label="QA attention" value={data.ai.review_required} detail="Automated fidelity flags" accent={data.ai.review_required ? "text-amber-300" : "text-emerald-300"}/>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/generation-jobs" className="rounded-lg border border-sky-800 bg-sky-950/30 px-3 py-2.5 text-center text-xs font-medium text-sky-300 hover:border-sky-600 hover:text-sky-200">
              Open job center
            </Link>
            <Link href="/quality-review" className="rounded-lg border border-violet-800 bg-violet-950/30 px-3 py-2.5 text-center text-xs font-medium text-violet-300 hover:border-violet-600 hover:text-violet-200">
              Quality review inbox
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
