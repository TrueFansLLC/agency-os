"use client"

import { ContentFilters, ViralTier, ContentStatus } from "@/types/content"
import { Creator } from "@/types/instagram"

interface Props {
  filters:   ContentFilters
  onChange:  (f: ContentFilters) => void
  creators:  Creator[]
  markets:   string[]
}

const TIERS:    { value: "all" | ViralTier;    label: string }[] = [
  { value: "all", label: "All Tiers" },
  { value: "A",   label: "Tier A" },
  { value: "B",   label: "Tier B" },
  { value: "C",   label: "Tier C" },
]

const STATUSES: { value: "all" | ContentStatus; label: string }[] = [
  { value: "all",           label: "All Statuses"  },
  { value: "video_saved",   label: "Video saved"   },
  { value: "link_only",     label: "Link only"     },
  { value: "missing_file",  label: "Missing file"  },
  { value: "pending",       label: "Pending"       },
]

const DATE_RANGES: { value: ContentFilters["dateRange"]; label: string }[] = [
  { value: "7d",  label: "Last 7 days"  },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time"     },
]

const SELECT_CLS = "bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500"

export default function ContentFilterBar({ filters, onChange, creators, markets }: Props) {
  const set = <K extends keyof ContentFilters>(key: K, val: ContentFilters[K]) =>
    onChange({ ...filters, [key]: val })

  const hasActive =
    filters.search !== "" ||
    filters.creator !== "all" ||
    filters.market  !== "all" ||
    filters.tier    !== "all" ||
    filters.status  !== "all" ||
    filters.dateRange !== "30d"

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search caption, creator, account…"
          value={filters.search}
          onChange={e => set("search", e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg pl-9 pr-3 py-2 w-64 focus:outline-none focus:border-gray-500 placeholder-gray-600"
        />
      </div>

      {/* Creator */}
      <select value={filters.creator} onChange={e => set("creator", e.target.value)} className={SELECT_CLS}>
        <option value="all">All Creators</option>
        {creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {/* Market */}
      <select value={filters.market} onChange={e => set("market", e.target.value)} className={SELECT_CLS}>
        <option value="all">All Markets</option>
        {markets.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      {/* Viral Tier */}
      <select value={filters.tier} onChange={e => set("tier", e.target.value as ContentFilters["tier"])} className={SELECT_CLS}>
        {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Status */}
      <select value={filters.status} onChange={e => set("status", e.target.value as ContentFilters["status"])} className={SELECT_CLS}>
        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* Date range */}
      <select value={filters.dateRange} onChange={e => set("dateRange", e.target.value as ContentFilters["dateRange"])} className={SELECT_CLS}>
        {DATE_RANGES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>

      {/* Clear */}
      {hasActive && (
        <button
          onClick={() => onChange({ search: "", creator: "all", market: "all", tier: "all", status: "all", dateRange: "30d" })}
          className="text-gray-500 hover:text-white text-sm transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
