// Pure calculation logic — no UI, no mock data.
// Swap the data source (mockData → API/DB) without touching this file.

import {
  InstagramAccount,
  AccountWithMetrics,
  ComputedMetrics,
  Filters,
  KPIs,
} from "@/types/instagram"

// ─── Date range resolution ────────────────────────────────────────

export function resolveDateRange(filters: Filters): { from: string; to: string } {
  // In production replace this with: const today = new Date()
  const today = new Date("2026-05-03")
  const pad = (d: Date) => d.toISOString().split("T")[0]

  if (filters.dateRange === "7d") {
    const from = new Date(today)
    from.setDate(from.getDate() - 7)
    return { from: pad(from), to: pad(today) }
  }

  if (filters.dateRange === "30d") {
    const from = new Date(today)
    from.setDate(from.getDate() - 30)
    return { from: pad(from), to: pad(today) }
  }

  return { from: filters.customFrom, to: filters.customTo }
}

// ─── Per-account metric computation ──────────────────────────────

export function computeMetrics(
  account: InstagramAccount,
  from: string,
  to: string
): ComputedMetrics {
  const inRange = account.snapshots.filter(s => s.date >= from && s.date <= to)

  // Current follower count = most recent snapshot overall
  const latest = account.snapshots[account.snapshots.length - 1]
  const followersNow = latest?.followers ?? 0

  // Follower growth = followers at end of range − followers just before range
  const endSnapshot = inRange[inRange.length - 1]
  const beforeRange = account.snapshots.filter(s => s.date < from)
  const baselineSnapshot = beforeRange[beforeRange.length - 1] ?? inRange[0]
  const followerGrowth =
    endSnapshot && baselineSnapshot
      ? endSnapshot.followers - baselineSnapshot.followers
      : 0

  const views = inRange.reduce((sum, s) => sum + s.views, 0)
  const posts = inRange.reduce((sum, s) => sum + s.posts, 0)
  const avgViewsPerPost = posts > 0 ? Math.round(views / posts) : 0

  const lastPostSnap = [...account.snapshots].reverse().find(s => s.posts > 0)
  const lastPostDate = lastPostSnap ? formatRelativeDate(lastPostSnap.date) : "—"

  return { followersNow, followerGrowth, views, posts, avgViewsPerPost, lastPostDate }
}

// ─── Filtering + bulk computation ────────────────────────────────

export function filterAndCompute(
  allAccounts: InstagramAccount[],
  filters: Filters
): AccountWithMetrics[] {
  const { from, to } = resolveDateRange(filters)

  return allAccounts
    .filter(a => {
      if (!filters.showArchived && a.archived) return false
      if (filters.creator !== "all" && a.creatorId !== filters.creator) return false
      if (filters.market !== "all" && a.market !== filters.market) return false
      if (filters.status !== "all" && a.status !== filters.status) return false
      return true
    })
    .map(a => ({ ...a, metrics: computeMetrics(a, from, to) }))
}

// ─── KPI aggregation ─────────────────────────────────────────────

export function computeKPIs(accounts: AccountWithMetrics[]): KPIs {
  const activeAccounts = accounts.filter(a => a.status === "active" || a.status === "scaling").length
  const totalViews = accounts.reduce((s, a) => s + a.metrics.views, 0)
  const totalFollowerGrowth = accounts.reduce((s, a) => s + a.metrics.followerGrowth, 0)
  const totalPosts = accounts.reduce((s, a) => s + a.metrics.posts, 0)
  const avgViewsPerPost = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0

  return {
    totalAccounts: accounts.length,
    activeAccounts,
    totalViews,
    totalFollowerGrowth,
    totalPosts,
    avgViewsPerPost,
  }
}

// ─── Formatting helpers ───────────────────────────────────────────

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function fmtGrowth(n: number): string {
  if (n === 0) return "—"
  const sign = n > 0 ? "+" : "-"
  return `${sign}${fmtNumber(Math.abs(n))}`
}

function formatRelativeDate(dateStr: string): string {
  const ref = new Date("2026-05-03") // replace with new Date() in production
  const d = new Date(dateStr)
  const diff = Math.floor((ref.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return `${Math.floor(diff / 30)}mo ago`
}

// ─── Dynamic filter option derivation ────────────────────────────
// Derive available creators and markets from the actual accounts array.
// Adding a new account automatically makes it appear in every filter.

export function deriveCreators(accounts: InstagramAccount[]): { id: string; name: string }[] {
  const map = new Map<string, string>()
  accounts.forEach(a => map.set(a.creatorId, a.creatorName))
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function deriveMarkets(accounts: InstagramAccount[]): string[] {
  return [...new Set(accounts.map(a => a.market))].sort()
}
