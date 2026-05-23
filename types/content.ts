export type Platform    = "instagram" | "tiktok" | "youtube"
export type ContentType = "reel" | "post" | "video" | "story"
export type ViralTier   = "A" | "B" | "C"
export type ContentStatus = "link_only" | "video_saved" | "missing_file" | "pending"

export interface ContentMetricSnapshot {
  id:            string
  contentItemId: string
  checkedAt:     string
  views:         number
  likes:         number
  comments:      number
  shares:        number
  saves:         number
  createdAt:     string
}

export interface ContentItem {
  id:                   string
  creatorId:            string | null
  creatorName:          string
  marketId:             string | null
  market:               string
  instagramAccountId:   string | null
  instagramUsername:    string

  platform:             Platform
  contentType:          ContentType

  originalUrl:          string
  mediaUrl:             string | null
  thumbnailUrl:         string | null

  // Permanent storage — set by download worker (NOT YET IMPLEMENTED)
  // Path format: "content/{account_id}/{content_id}.mp4"
  storageVideoPath:     string | null
  storageThumbnailPath: string | null

  caption:              string
  postedAt:             string | null
  detectedAt:           string
  savedAt:              string | null

  viralTier:            ViralTier
  status:               ContentStatus
  notes:                string
  createdAt:            string
  updatedAt:            string

  // Populated by API — latest snapshot + all tags
  latestMetrics:        ContentMetricSnapshot | null
  tags:                 string[]
}

export interface ViralRule {
  id:                  string
  name:                string
  tier:                ViralTier
  timeWindowHours:     number
  minViews:            number
  minLikes:            number
  relativeMultiplier:  number | null
  creatorId:           string | null
  marketId:            string | null
  instagramAccountId:  string | null
  enabled:             boolean
  createdAt:           string
  updatedAt:           string
}

export interface ContentFilters {
  search:    string
  creator:   string        // "all" or creator id
  market:    string        // "all" or market name
  tier:      "all" | ViralTier
  status:    "all" | ContentStatus
  dateRange: "7d" | "30d" | "90d" | "all"
}

export const DEFAULT_CONTENT_FILTERS: ContentFilters = {
  search:    "",
  creator:   "all",
  market:    "all",
  tier:      "all",
  status:    "all",
  dateRange: "30d",
}
