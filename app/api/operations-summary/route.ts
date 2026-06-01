import { NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"
import { createServerClient } from "@/lib/supabase/server"

const BANGKOK_TIME_ZONE = "Asia/Bangkok"
const DEFAULT_CONTENT_CREATORS = ["Cathy", "Neyla", "Romina"]
const LOW_CONTENT_THRESHOLD = 12
const OVERDUE_POST_MS = 60 * 60 * 1000
const MODEL_PRICE_PER_IMAGE = {
  seedream: 0.04,
  nano_banana_pro: 0.15,
} as const

type AlertSeverity = "critical" | "warning" | "info"

type OperationsAlert = {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  href: string
}

function getBangkokDate() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

function getBangkokDayRange(today: string) {
  const start = new Date(`${today}T00:00:00+07:00`)
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

function countByStatus(rows: Record<string, unknown>[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const status = typeof row.status === "string" ? row.status : "unknown"
    counts[status] = (counts[status] ?? 0) + 1
    return counts
  }, {})
}

function isOlderThan(date: unknown, milliseconds: number) {
  return typeof date === "string" && Date.now() - new Date(date).getTime() >= milliseconds
}

export async function GET() {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const today = getBangkokDate()
  const dayRange = getBangkokDayRange(today)

  const [
    postsResult,
    accountPairsResult,
    threadsAccountsResult,
    threadsBatchesResult,
    statusChecksResult,
    generationsResult,
    reviewCandidatesResult,
    reviewsResult,
    contentAssetsResult,
    employeesResult,
    tasksResult,
  ] = await Promise.all([
    supabase
      .from("posting_schedule")
      .select("id,creator,account,platform,reel_number,status,employee_name,dispatched_at,confirmed_at,send_time")
      .eq("send_date", today),
    supabase
      .from("account_pairs")
      .select("id,creator,ig_username,fb_username,ig_mitarbeiter,fb_mitarbeiter,status,status_since,status_note")
      .eq("archived", false),
    supabase
      .from("threads_accounts")
      .select("id,username,creator,branding,mitarbeiter,employee_id,status")
      .eq("archived", false),
    supabase
      .from("threads_daily_batches")
      .select("id,status,posts_count,images_count,dispatched_at,blocked_reason,account:threads_accounts(username,creator,branding,status,mitarbeiter)")
      .eq("date", today),
    supabase
      .from("daily_status_screenshots")
      .select("id,employee_name,platform,expected_count,received_count,check_sent_at,followup_sent_at")
      .eq("date", today),
    supabase
      .from("threads_generations")
      .select("id,creator,status,generation_model,qa_status,qa_score,error_message,created_at")
      .gte("created_at", dayRange.start)
      .lt("created_at", dayRange.end),
    supabase
      .from("threads_generations")
      .select("id")
      .not("image_url", "is", null)
      .not("reference_storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("generation_reviews")
      .select("generation_id"),
    supabase
      .from("content_assets")
      .select("id,creator,status"),
    supabase
      .from("employees")
      .select("id,name,platform,telegram_chat_id,telegram_threads_thread_id,telegram_threads_status_thread_id"),
    supabase
      .from("tasks")
      .select("id,title,assignee,priority,status,due_date", { count: "exact" })
      .neq("status", "erledigt")
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const queryError = [
    postsResult.error,
    accountPairsResult.error,
    threadsAccountsResult.error,
    threadsBatchesResult.error,
    statusChecksResult.error,
    generationsResult.error,
    reviewCandidatesResult.error,
    reviewsResult.error,
    contentAssetsResult.error,
    employeesResult.error,
    tasksResult.error,
  ].find(Boolean)
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })

  const posts = postsResult.data ?? []
  const accountPairs = accountPairsResult.data ?? []
  const threadsAccounts = threadsAccountsResult.data ?? []
  const threadsBatches = threadsBatchesResult.data ?? []
  const statusChecks = statusChecksResult.data ?? []
  const generations = generationsResult.data ?? []
  const reviewedIds = new Set((reviewsResult.data ?? []).map(review => review.generation_id))
  const contentAssets = contentAssetsResult.data ?? []
  const employees = employeesResult.data ?? []

  const overduePosts = posts.filter(post => post.status === "gesendet" && !post.confirmed_at && isOlderThan(post.dispatched_at, OVERDUE_POST_MS))
  const accountIssues = accountPairs.filter(pair => pair.status === "restricted" || pair.status === "banned")
  const threadsIssues = threadsAccounts.filter(account => account.status === "restricted" || account.status === "banned" || account.status === "paused")
  const blockedThreadsBatches = threadsBatches.filter(batch => batch.status === "blocked")
  const incompleteStatusChecks = statusChecks.filter(check => check.received_count < check.expected_count)
  const failedGenerations = generations.filter(generation => generation.status === "failed")
  const generatingImages = generations.filter(generation => generation.status === "generating").length
  const reviewQueue = (reviewCandidatesResult.data ?? []).filter(generation => !reviewedIds.has(generation.id)).length
  const reviewRequired = generations.filter(generation => generation.qa_status === "review_required").length

  const contentCreators = [...new Set([
    ...DEFAULT_CONTENT_CREATORS,
    ...contentAssets.map(asset => asset.creator),
    ...threadsAccounts.map(account => account.creator),
  ])].sort()
  const contentInventory = contentCreators.map(creator => {
    const creatorAssets = contentAssets.filter(asset => asset.creator === creator)
    const available = creatorAssets.filter(asset => ["saved", "ready", "assigned"].includes(asset.status)).length
    return {
      creator,
      total: creatorAssets.length,
      available,
      saved: creatorAssets.filter(asset => asset.status === "saved").length,
      ready: creatorAssets.filter(asset => asset.status === "ready").length,
      assigned: creatorAssets.filter(asset => asset.status === "assigned").length,
      used: creatorAssets.filter(asset => asset.status === "used").length,
      archived: creatorAssets.filter(asset => asset.status === "archived").length,
      low_stock: available < LOW_CONTENT_THRESHOLD,
    }
  })

  const threadsEmployees = new Set(threadsAccounts.map(account => account.employee_id).filter(Boolean))
  const telegramSetupIssues = employees.filter(employee =>
    !employee.telegram_chat_id
    || (threadsEmployees.has(employee.id) && (!employee.telegram_threads_thread_id || !employee.telegram_threads_status_thread_id))
  )

  const falCostEstimate = generations.reduce((sum, generation) => {
    const model = generation.generation_model === "nano_banana_pro" ? "nano_banana_pro" : "seedream"
    return sum + MODEL_PRICE_PER_IMAGE[model]
  }, 0)

  const alerts: OperationsAlert[] = []
  for (const pair of accountIssues.slice(0, 8)) {
    alerts.push({
      id: `pair-${pair.id}`,
      severity: "critical",
      title: `${pair.status === "banned" ? "Banned" : "Restricted"} account`,
      detail: `@${pair.ig_username ?? pair.fb_username ?? "unknown"} · ${pair.creator}${pair.status_note ? ` · ${pair.status_note}` : ""}`,
      href: "/account-status",
    })
  }
  for (const account of threadsIssues.slice(0, 8)) {
    alerts.push({
      id: `threads-${account.id}`,
      severity: account.status === "paused" ? "warning" : "critical",
      title: `Threads account ${account.status}`,
      detail: `@${account.username} · ${account.creator}${account.mitarbeiter ? ` · ${account.mitarbeiter}` : ""}`,
      href: "/threads",
    })
  }
  for (const post of overduePosts.slice(0, 6)) {
    alerts.push({
      id: `post-${post.id}`,
      severity: "warning",
      title: "Post confirmation overdue",
      detail: `@${post.account} · ${post.platform} · R${post.reel_number}${post.employee_name ? ` · ${post.employee_name}` : ""}`,
      href: "/posting-planer",
    })
  }
  for (const batch of blockedThreadsBatches.slice(0, 6)) {
    const account = Array.isArray(batch.account) ? batch.account[0] : batch.account
    alerts.push({
      id: `batch-${batch.id}`,
      severity: "critical",
      title: "Threads batch blocked",
      detail: `@${account?.username ?? "unknown"}${batch.blocked_reason ? ` · ${batch.blocked_reason}` : ""}`,
      href: "/threads",
    })
  }
  for (const check of incompleteStatusChecks.slice(0, 6)) {
    alerts.push({
      id: `check-${check.id}`,
      severity: "warning",
      title: "Daily screenshots missing",
      detail: `${check.employee_name} · ${String(check.platform).toUpperCase()} · ${check.received_count}/${check.expected_count} received`,
      href: "/account-status",
    })
  }
  if (failedGenerations.length) {
    alerts.push({
      id: "generation-failures",
      severity: "warning",
      title: `${failedGenerations.length} image generation${failedGenerations.length === 1 ? "" : "s"} failed today`,
      detail: "Open AI Tools to review errors and retry the failed jobs.",
      href: "/ai-tools",
    })
  }
  if (reviewQueue) {
    alerts.push({
      id: "quality-review-backlog",
      severity: "info",
      title: `${reviewQueue} recreation${reviewQueue === 1 ? "" : "s"} waiting for review`,
      detail: "Calibrate the workflow by approving, accepting or rejecting generated images.",
      href: "/quality-review",
    })
  }
  for (const inventory of contentInventory.filter(item => item.low_stock)) {
    alerts.push({
      id: `content-${inventory.creator}`,
      severity: "info",
      title: `${inventory.creator} content stock is low`,
      detail: `${inventory.available} reusable image${inventory.available === 1 ? "" : "s"} available in the content bank.`,
      href: "/content-bank",
    })
  }
  for (const employee of telegramSetupIssues.slice(0, 6)) {
    alerts.push({
      id: `employee-${employee.id}`,
      severity: "warning",
      title: "Employee setup incomplete",
      detail: `${employee.name} is missing Telegram${threadsEmployees.has(employee.id) ? " or Threads topic" : ""} configuration.`,
      href: "/employees",
    })
  }

  const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    date: today,
    summary: {
      critical_alerts: alerts.filter(alert => alert.severity === "critical").length,
      warning_alerts: alerts.filter(alert => alert.severity === "warning").length,
      account_issues: accountIssues.length + threadsIssues.length,
      open_tasks: tasksResult.count ?? tasksResult.data?.length ?? 0,
    },
    posts: {
      total: posts.length,
      by_status: countByStatus(posts),
      overdue: overduePosts.length,
    },
    threads: {
      accounts_total: threadsAccounts.length,
      accounts_by_status: countByStatus(threadsAccounts),
      batches_total: threadsBatches.length,
      batches_by_status: countByStatus(threadsBatches),
      blocked: blockedThreadsBatches.length,
    },
    status_checks: {
      total: statusChecks.length,
      complete: statusChecks.length - incompleteStatusChecks.length,
      incomplete: incompleteStatusChecks.length,
      expected_screenshots: statusChecks.reduce((sum, check) => sum + check.expected_count, 0),
      received_screenshots: statusChecks.reduce((sum, check) => sum + check.received_count, 0),
    },
    ai: {
      generated_today: generations.length,
      generating: generatingImages,
      failed: failedGenerations.length,
      review_required: reviewRequired,
      review_queue: reviewQueue,
      estimated_fal_cost_usd: Number(falCostEstimate.toFixed(2)),
      by_model: {
        seedream: generations.filter(generation => generation.generation_model !== "nano_banana_pro").length,
        nano_banana_pro: generations.filter(generation => generation.generation_model === "nano_banana_pro").length,
      },
    },
    team: {
      total: employees.length,
      telegram_connected: employees.filter(employee => employee.telegram_chat_id).length,
      setup_issues: telegramSetupIssues.length,
    },
    content_inventory: contentInventory,
    alerts,
    tasks: tasksResult.data ?? [],
  })
}
