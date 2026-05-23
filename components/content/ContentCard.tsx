import { ContentItem } from "@/types/content"
import { fmtViralTier, fmtStorageStatus, fmtCompact, fmtDate } from "@/lib/contentLibrary"

interface Props {
  item: ContentItem
}

export default function ContentCard({ item }: Props) {
  const m     = item.latestMetrics
  const tier  = fmtViralTier(item.viralTier)
  const store = fmtStorageStatus(item.status)

  const thumbSrc = item.storageThumbnailPath
    ? `/storage/${item.storageThumbnailPath}`  // served from own storage once implemented
    : item.thumbnailUrl ?? null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col hover:border-gray-700 transition-colors">

      {/* ── Thumbnail ─────────────────────────────────────────────── */}
      <div className="relative aspect-[9/16] bg-gray-800 overflow-hidden">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={item.caption.slice(0, 60) || "Reel thumbnail"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        )}

        {/* Viral tier badge */}
        <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-md ${tier.cls}`}>
          {tier.label}
        </span>

        {/* Storage status badge */}
        <span className={`absolute top-2 right-2 text-xs font-medium ${store.cls}`}>
          {store.label}
        </span>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col gap-2 flex-1">

        {/* Account + meta */}
        <div>
          <p className="text-white text-sm font-medium leading-tight">@{item.instagramUsername || "—"}</p>
          <p className="text-gray-500 text-xs mt-0.5">{item.creatorName} · {item.market}</p>
        </div>

        {/* Metrics */}
        {m && (
          <div className="flex items-center gap-3 text-xs text-gray-400 tabular-nums">
            <span title="Views">
              <span className="text-gray-500 mr-1">👁</span>{fmtCompact(m.views)}
            </span>
            <span title="Likes">
              <span className="text-gray-500 mr-1">♥</span>{fmtCompact(m.likes)}
            </span>
            <span title="Comments">
              <span className="text-gray-500 mr-1">💬</span>{fmtCompact(m.comments)}
            </span>
          </div>
        )}

        {/* Caption */}
        {item.caption && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{item.caption}</p>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-2 border-t border-gray-800 flex items-center justify-between">
          <span className="text-gray-600 text-xs">
            {item.savedAt ? `Saved ${fmtDate(item.savedAt)}` : `Detected ${fmtDate(item.detectedAt)}`}
          </span>
          <a
            href={item.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-white transition-colors"
            title="Open original"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
