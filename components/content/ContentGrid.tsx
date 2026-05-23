import { ContentItem } from "@/types/content"
import ContentCard from "./ContentCard"

interface Props {
  items:       ContentItem[]
  hasContent:  boolean        // true if DB has any rows at all
  total:       number         // total before filters
}

export default function ContentGrid({ items, hasContent, total }: Props) {

  // ── Nothing in DB yet ────────────────────────────────────────────
  if (!hasContent) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
        <p className="text-white font-medium text-base mb-1">No viral content saved yet</p>
        <p className="text-gray-500 text-sm max-w-sm">
          Viral Reels will appear here once tracking and sync are active. Content is detected automatically when an account&apos;s Reel crosses your viral threshold.
        </p>
      </div>
    )
  }

  // ── Content exists but filters match nothing ──────────────────────
  if (items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-gray-400 text-sm font-medium mb-1">No content matches the selected filters</p>
        <p className="text-gray-600 text-sm">Try adjusting the creator, market, tier, or date range.</p>
      </div>
    )
  }

  // ── Card grid ─────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-500 text-xs">
          {items.length === total
            ? `${total} item${total !== 1 ? "s" : ""}`
            : `${items.length} of ${total} item${total !== 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map(item => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
