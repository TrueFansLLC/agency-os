export type FbAccountStatus    = "active" | "paused" | "banned" | "testing" | "scaling"
export type FbPerformanceLabel = "Top" | "Growing" | "Stable" | "Declining" | "New"
export type FbConnectionStatus = "not_connected" | "connected" | "error"
export type DateRangeOption    = "7d" | "30d" | "custom"

export interface FbDailySnapshot {
  date:        string
  followers:   number
  videoViews:  number
  videosCount: number
  postsCount:  number
}

export interface Creator {
  id:   string
  name: string
}

export interface FbAccount {
  id:               string
  pageHandle:       string
  pageName:         string
  creatorId:        string
  creatorName:      string
  market:           string
  status:           FbAccountStatus
  connectionStatus: FbConnectionStatus
  performanceLabel: FbPerformanceLabel
  lastSyncedAt?:    string
  notes:            string
  archived:         boolean
  snapshots:        FbDailySnapshot[]
}

export interface FbFilters {
  dateRange:    DateRangeOption
  customFrom:   string
  customTo:     string
  creator:      string
  market:       string
  status:       string
  showArchived: boolean
}

export interface FbComputedMetrics {
  followersNow:   number
  followerGrowth: number
  videoViews:     number
  videosCount:    number
  postsCount:     number
  avgViewsPerVideo: number
}

export interface FbAccountWithMetrics extends FbAccount {
  metrics: FbComputedMetrics
}

export interface FbKPIs {
  totalAccounts:  number
  activeAccounts: number
  totalFollowers: number
  totalVideoViews: number
  totalVideos:    number
  avgViewsPerVideo: number
}
