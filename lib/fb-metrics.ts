import { FbAccount, FbAccountWithMetrics, FbFilters, FbKPIs, FbComputedMetrics, FbDailySnapshot } from "@/types/facebook"

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function fmtGrowth(n: number): string {
  const sign = n > 0 ? "+" : ""
  return `${sign}${fmtNumber(n)}`
}

function dateRange(filters: FbFilters): { from: Date; to: Date } {
  const to   = new Date()
  const from = new Date()
  if (filters.dateRange === "7d") {
    from.setDate(from.getDate() - 7)
  } else if (filters.dateRange === "30d") {
    from.setDate(from.getDate() - 30)
  } else {
    if (filters.customFrom) from.setTime(new Date(filters.customFrom).getTime())
    if (filters.customTo)   to.setTime(new Date(filters.customTo).getTime())
  }
  return { from, to }
}

function computeMetrics(account: FbAccount, filters: FbFilters): FbComputedMetrics {
  const { from, to } = dateRange(filters)

  const snaps = account.snapshots.filter(s => {
    const d = new Date(s.date)
    return d >= from && d <= to
  })

  if (snaps.length === 0) {
    const latest = account.snapshots[account.snapshots.length - 1]
    return {
      followersNow:     latest?.followers   ?? 0,
      followerGrowth:   0,
      videoViews:       0,
      videosCount:      latest?.videosCount ?? 0,
      postsCount:       latest?.postsCount  ?? 0,
      avgViewsPerVideo: 0,
    }
  }

  const sorted = [...snaps].sort((a, b) => a.date.localeCompare(b.date))
  const first  = sorted[0]
  const last   = sorted[sorted.length - 1]

  const followersNow   = last.followers
  const followerGrowth = last.followers - first.followers

  const totalVideoViews = snaps.reduce((sum, s) => sum + s.videoViews, 0)
  const videosCount     = last.videosCount
  const postsCount      = last.postsCount
  const avgViewsPerVideo = videosCount > 0 ? Math.round(totalVideoViews / videosCount) : 0

  return {
    followersNow,
    followerGrowth,
    videoViews: totalVideoViews,
    videosCount,
    postsCount,
    avgViewsPerVideo,
  }
}

export function filterAndComputeFb(accounts: FbAccount[], filters: FbFilters): FbAccountWithMetrics[] {
  return accounts
    .filter(a => {
      if (!filters.showArchived && a.archived) return false
      if (filters.creator !== "all" && a.creatorId !== filters.creator) return false
      if (filters.market  !== "all" && a.market   !== filters.market)   return false
      if (filters.status  !== "all" && a.status   !== filters.status)   return false
      return true
    })
    .map(a => ({ ...a, metrics: computeMetrics(a, filters) }))
}

export function computeFbKPIs(accounts: FbAccountWithMetrics[]): FbKPIs {
  const active = accounts.filter(a => !a.archived && (a.status === "active" || a.status === "scaling"))
  return {
    totalAccounts:    accounts.filter(a => !a.archived).length,
    activeAccounts:   active.length,
    totalFollowers:   accounts.reduce((s, a) => s + a.metrics.followersNow, 0),
    totalVideoViews:  accounts.reduce((s, a) => s + a.metrics.videoViews,   0),
    totalVideos:      accounts.reduce((s, a) => s + a.metrics.videosCount,  0),
    avgViewsPerVideo: (() => {
      const total = accounts.reduce((s, a) => s + a.metrics.videosCount, 0)
      if (!total) return 0
      const views = accounts.reduce((s, a) => s + a.metrics.videoViews, 0)
      return Math.round(views / total)
    })(),
  }
}
