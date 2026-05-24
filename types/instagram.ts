// Core domain types — mirrors what a future Instagram API / database would return.
// Replace localStorage calls in storage.ts with real API calls without touching any UI.

export type AccountStatus    = "active" | "paused" | "banned" | "testing" | "scaling"
export type PerformanceLabel = "Top" | "Growing" | "Stable" | "Declining" | "New"
export type DateRangeOption  = "7d" | "30d" | "custom"
export type ConnectionStatus = "not_connected" | "connected" | "error"
export type DataSource       = "instagram_api" | "manual"

// One snapshot = one day of recorded metrics pulled from the Instagram API.
// In production this row is written by a background sync job.
export interface DailySnapshot {
  date: string
  followers: number
  views: number
  posts: number
  fbFollowers?: number
}

export interface Creator {
  id: string
  name: string
}

export interface InstagramAccount {
  id: string
  username: string              // e.g. "@romina.official"
  creatorId: string             // foreign key → Creator.id
  creatorName: string           // denormalised for display convenience
  market: string                // e.g. "Germany", "USA"
  status: AccountStatus
  connectionStatus: ConnectionStatus
  dataSource: DataSource
  // ── Instagram API fields ─────────────────────────────────────────
  // These are populated automatically once the account is connected.
  // Manually added accounts leave them undefined until first sync.
  externalInstagramId?: string
  lastSyncedAt?: string
  fbUsername?: string
  snapshots: DailySnapshot[]
  notes: string
  performanceLabel: PerformanceLabel
  archived: boolean             // soft delete — excluded from main view
}

// ------------------------------------------------------------------
// Filter state
// ------------------------------------------------------------------
export interface Filters {
  dateRange: DateRangeOption
  customFrom: string
  customTo: string
  creator: string       // "all" or Creator.id
  market: string        // "all" or market name
  status: string        // "all" or AccountStatus
  showArchived: boolean
}

// ------------------------------------------------------------------
// Computed metrics — derived from snapshots for the active date range
// ------------------------------------------------------------------
export interface ComputedMetrics {
  followersNow: number
  followerGrowth: number
  fbFollowersNow: number
  views: number
  posts: number
  avgViewsPerPost: number
  lastPostDate: string
}

export interface AccountWithMetrics extends InstagramAccount {
  metrics: ComputedMetrics
}

export interface KPIs {
  totalAccounts: number
  activeAccounts: number
  totalViews: number
  totalFollowerGrowth: number
  totalPosts: number
  avgViewsPerPost: number
}
