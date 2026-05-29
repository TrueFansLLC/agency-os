import { FbAccountWithMetrics, FbAccountStatus, FbPerformanceLabel } from "@/types/facebook"
import { fmtNumber, fmtGrowth } from "@/lib/fb-metrics"

const STATUS_CLS: Record<FbAccountStatus, string> = {
  active:  "bg-green-900/40  text-green-400  border border-green-800/60",
  scaling: "bg-purple-900/40 text-purple-400 border border-purple-800/60",
  testing: "bg-blue-900/40   text-blue-400   border border-blue-800/60",
  paused:  "bg-yellow-900/40 text-yellow-400 border border-yellow-800/60",
  banned:  "bg-red-900/40    text-red-400    border border-red-800/60",
}

const LABEL_CLS: Record<FbPerformanceLabel, string> = {
  Top:       "text-green-400",
  Growing:   "text-teal-400",
  Stable:    "text-gray-400",
  Declining: "text-red-400",
  New:       "text-blue-400",
}

const CONN_DOT: Record<string, string> = {
  connected:     "bg-green-400",
  not_connected: "bg-gray-500",
  error:         "bg-red-400",
}

const COLS = [
  "Page", "Creator", "Market", "Status",
  "Followers", "Growth", "Video Views", "Videos", "Avg Views/Video",
  "Label / Notes", "",
]

interface Props {
  accounts:    FbAccountWithMetrics[]
  hasAccounts: boolean
  syncingId:   string | null
  onEdit:      (account: FbAccountWithMetrics) => void
  onArchive:   (id: string) => void
  onSync:      (id: string) => void
  onAddFirst:  () => void
}

export default function FbAccountTable({ accounts, hasAccounts, syncingId, onEdit, onArchive, onSync, onAddFirst }: Props) {

  if (!hasAccounts) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
          </svg>
        </div>
        <p className="text-white font-medium text-base mb-1">No Facebook pages added yet</p>
        <p className="text-gray-500 text-sm mb-6 max-w-sm">
          Add your first Facebook page to start tracking followers, videos, and views.
        </p>
        <button
          onClick={onAddFirst}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add your first page
        </button>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-gray-400 text-sm font-medium mb-1">No pages match the selected filters</p>
        <p className="text-gray-600 text-sm">Try clearing the creator, market, or status filter.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-white font-medium text-sm">Pages</h2>
        <span className="text-gray-500 text-xs">{accounts.length} page{accounts.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-gray-800">
              {COLS.map(col => (
                <th key={col} className="text-left text-gray-500 font-medium text-xs px-4 py-3 whitespace-nowrap uppercase tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => {
              const m         = a.metrics
              const growthPos = m.followerGrowth >= 0
              const label     = a.pageName || a.pageHandle
              return (
                <tr
                  key={a.id}
                  className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${a.archived ? "opacity-50" : ""}`}
                >
                  {/* Page + connection dot */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${CONN_DOT[a.connectionStatus] ?? "bg-gray-500"}`}
                        title={`Connection: ${a.connectionStatus}`}
                      />
                      <div>
                        <p className="text-white font-medium">{label}</p>
                        {a.pageName && <p className="text-gray-500 text-xs">/{a.pageHandle}</p>}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{a.creatorName}</td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{a.market}</td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize ${STATUS_CLS[a.status]}`}>
                      {a.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">
                    {m.followersNow > 0 ? fmtNumber(m.followersNow) : "—"}
                  </td>

                  <td className={`px-4 py-3 whitespace-nowrap font-medium tabular-nums ${growthPos ? "text-green-400" : "text-red-400"}`}>
                    {fmtGrowth(m.followerGrowth)}
                  </td>

                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">
                    {m.videoViews > 0 ? fmtNumber(m.videoViews) : "—"}
                  </td>

                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">
                    {m.videosCount > 0 ? m.videosCount : "—"}
                  </td>

                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">
                    {m.avgViewsPerVideo > 0 ? fmtNumber(m.avgViewsPerVideo) : "—"}
                  </td>

                  {/* Label + notes */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-medium ${LABEL_CLS[a.performanceLabel]}`}>
                      {a.performanceLabel}
                    </span>
                    {a.notes && (
                      <span className="text-gray-500 text-xs ml-2 max-w-[140px] truncate inline-block align-bottom">
                        · {a.notes}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSync(a.id)}
                        disabled={syncingId === a.id}
                        title={a.lastSyncedAt ? `Last synced: ${new Date(a.lastSyncedAt).toLocaleString()}` : "Sync now"}
                        className="p-1.5 text-gray-500 hover:text-blue-400 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={syncingId === a.id ? "animate-spin" : ""}
                        >
                          <polyline points="23 4 23 10 17 10"/>
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => onEdit(a)}
                        title="Edit page"
                        className="p-1.5 text-gray-500 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Archive "${label}"? It will be hidden from the main view.`)) {
                            onArchive(a.id)
                          }
                        }}
                        title="Archive page"
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded-md hover:bg-gray-700 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
                          <line x1="10" y1="12" x2="14" y2="12"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
