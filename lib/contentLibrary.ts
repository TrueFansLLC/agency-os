import { ContentItem, ContentFilters, ContentStatus, ViralTier } from "@/types/content"

// ── Filtering ─────────────────────────────────────────────────────────────────

export function filterContent(items: ContentItem[], f: ContentFilters): ContentItem[] {
  const search = f.search.toLowerCase().trim()
  const cutoff = dateCutoff(f.dateRange)

  return items.filter(item => {
    if (f.creator !== "all" && item.creatorId !== f.creator) return false
    if (f.market  !== "all" && item.market !== f.market)     return false
    if (f.tier    !== "all" && item.viralTier !== f.tier)    return false
    if (f.status  !== "all" && item.status !== f.status)     return false

    if (cutoff) {
      const date = item.savedAt ?? item.detectedAt
      if (new Date(date) < cutoff) return false
    }

    if (search) {
      const hay = [
        item.instagramUsername,
        item.creatorName,
        item.market,
        item.caption,
        ...item.tags,
      ].join(" ").toLowerCase()
      if (!hay.includes(search)) return false
    }

    return true
  })
}

function dateCutoff(range: ContentFilters["dateRange"]): Date | null {
  if (range === "all") return null
  const d = new Date()
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  d.setDate(d.getDate() - days)
  return d
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmtViralTier(tier: ViralTier): { label: string; cls: string } {
  return {
    A: { label: "Tier A", cls: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
    B: { label: "Tier B", cls: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
    C: { label: "Tier C", cls: "bg-blue-500/20   text-blue-400   border border-blue-500/30"   },
  }[tier]
}

export function fmtStorageStatus(status: ContentStatus): { label: string; cls: string } {
  switch (status) {
    case "video_saved":   return { label: "Video saved",   cls: "text-green-400"  }
    case "link_only":     return { label: "Link only",     cls: "text-yellow-400" }
    case "missing_file":  return { label: "Missing file",  cls: "text-red-400"    }
    case "pending":       return { label: "Pending",       cls: "text-blue-400"   }
  }
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "")     + "K"
  return n.toString()
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
