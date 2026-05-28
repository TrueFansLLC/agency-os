export type ThreadsAccountStatus = 'warmup' | 'active' | 'paused' | 'banned'
export type ThreadsBatchStatus   = 'ready'  | 'sent'   | 'posted' | 'deleted'

export interface ThreadsAccount {
  id:                   string
  username:             string
  creator:              string
  branding:             string | null
  mitarbeiter:          string | null
  warmup_started_at:    string | null
  ramp_up_started_at:   string | null
  status:               ThreadsAccountStatus
  notes:                string
  archived:             boolean
  created_at:           string
  updated_at:           string
}

export interface ThreadsDailyBatch {
  id:                     string
  account_id:             string
  date:                   string
  drive_folder_url:       string
  posts_count:            number
  images_count:           number
  status:                 ThreadsBatchStatus
  telegram_message_id:    number | null
  chat_id:                string | null
  dispatched_at:          string | null
  posted_confirmed_at:    string | null
  deletion_confirmed_at:  string | null
  created_at:             string
  account?:               ThreadsAccount
}

export function calcPostsPerDay(ramp_up_started_at: string | null, today = new Date()): number {
  if (!ramp_up_started_at) return 1
  const start = new Date(ramp_up_started_at)
  const days  = Math.floor((today.getTime() - start.getTime()) / 86400000)
  return Math.min(Math.max(days + 1, 1), 5)
}

export function calcWarmupDay(warmup_started_at: string | null, today = new Date()): number {
  if (!warmup_started_at) return 1
  const start = new Date(warmup_started_at)
  const days  = Math.floor((today.getTime() - start.getTime()) / 86400000)
  return Math.max(days + 1, 1)
}

export function getPostingTimes(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${String(9 + i).padStart(2, "0")}:00`)
}
