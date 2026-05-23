"use client"

import { useState, useEffect, useMemo } from "react"

type Row = Record<string, string>

// ── Platform config ────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Instagram: {
    color: "text-purple-400",
    bg: "bg-purple-900/20",
    border: "border-purple-800",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  Facebook: {
    color: "text-blue-400",
    bg: "bg-blue-900/20",
    border: "border-blue-800",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  Threads: {
    color: "text-gray-300",
    bg: "bg-gray-800/60",
    border: "border-gray-700",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
      </svg>
    ),
  },
  TikTok: {
    color: "text-pink-400",
    bg: "bg-pink-900/20",
    border: "border-pink-800",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.94a8.16 8.16 0 0 0 4.78 1.52V7.02a4.85 4.85 0 0 1-1.01-.33z" />
      </svg>
    ),
  },
  YouTube: {
    color: "text-red-400",
    bg: "bg-red-900/20",
    border: "border-red-800",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" />
      </svg>
    ),
  },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Fertig:      { label: "Live",        color: "text-green-400", bg: "bg-green-900/30",  border: "border-green-800",  dot: "bg-green-400" },
  Fehlt:       { label: "Missing",     color: "text-red-400",   bg: "bg-red-900/30",    border: "border-red-800",    dot: "bg-red-400" },
  "In Arbeit": { label: "In Progress", color: "text-blue-400",  bg: "bg-blue-900/30",   border: "border-blue-800",   dot: "bg-blue-400" },
  Problem:     { label: "Problem",     color: "text-amber-400", bg: "bg-amber-900/30",  border: "border-amber-800",  dot: "bg-amber-400" },
}

function getPlatformConfig(platform: string) {
  return PLATFORM_CONFIG[platform] ?? {
    color: "text-gray-400", bg: "bg-gray-800/50", border: "border-gray-700",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  }
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status || "Unknown", color: "text-gray-400", bg: "bg-gray-800", border: "border-gray-700", dot: "bg-gray-400" }
}

// ── Platform KPI card ─────────────────────────────────────────
function PlatformCard({ platform, rows }: { platform: string; rows: Row[] }) {
  const cfg = getPlatformConfig(platform)
  const total    = rows.length
  const live     = rows.filter(r => r.CheckStatus === "Fertig").length
  const missing  = rows.filter(r => r.CheckStatus === "Fehlt").length
  const progress = rows.filter(r => r.CheckStatus === "In Arbeit").length
  const problem  = rows.filter(r => r.CheckStatus === "Problem").length

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-5 flex-1 min-w-[160px]`}>
      <div className={`flex items-center gap-2 mb-4 ${cfg.color}`}>
        {cfg.icon}
        <span className="font-semibold text-sm">{platform}</span>
      </div>
      <p className="text-3xl font-bold text-white mb-3">{total}</p>
      <div className="space-y-1.5">
        {live > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Live</span>
            <span className="text-xs font-medium text-green-400">{live}</span>
          </div>
        )}
        {missing > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Missing</span>
            <span className="text-xs font-bold text-red-400">{missing}</span>
          </div>
        )}
        {progress > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">In Progress</span>
            <span className="text-xs font-medium text-blue-400">{progress}</span>
          </div>
        )}
        {problem > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Problem</span>
            <span className="text-xs font-medium text-amber-400">{problem}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Single account card ───────────────────────────────────────
function AccountCard({ row, showCreator }: { row: Row; showCreator: boolean }) {
  const platform = row.Plattform || "Unknown"
  const cfg      = getPlatformConfig(platform)
  const status   = row.CheckStatus || "Fehlt"
  const sCfg     = getStatusConfig(status)

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 ${
      status === "Fehlt" || status === "Problem"
        ? "border-red-900/60"
        : "border-gray-800"
    }`}>
      {/* Platform + Status */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 ${cfg.color}`}>
          {cfg.icon}
          <span className="text-sm font-medium">{platform}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sCfg.bg} ${sCfg.color} border ${sCfg.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
          {sCfg.label}
        </span>
      </div>

      {/* Brand */}
      {row.Brandings && (
        <p className="text-white font-semibold text-sm leading-tight">{row.Brandings}</p>
      )}

      {/* Creator (only in All view) */}
      {showCreator && row.Creator && (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-bold shrink-0">
            {row.Creator[0]}
          </div>
          <span className="text-gray-400 text-xs">{row.Creator}</span>
        </div>
      )}

      {/* Employee */}
      {row.Mitarbeiter && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-gray-500 text-xs">{row.Mitarbeiter}</span>
          {row.PostingModus && row.PostingModus !== "Unklar" && (
            <span className="ml-auto text-gray-600 text-xs">{row.PostingModus}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Creator section (used in All view) ───────────────────────
function CreatorSection({ creator, rows }: { creator: string; rows: Row[] }) {
  const live    = rows.filter(r => r.CheckStatus === "Fertig").length
  const missing = rows.filter(r => r.CheckStatus === "Fehlt").length
  const problem = rows.filter(r => r.CheckStatus === "Problem").length

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {creator[0]}
        </div>
        <h2 className="text-white font-semibold text-base">{creator}</h2>
        <div className="flex items-center gap-3 ml-2">
          <span className="text-xs text-gray-500">{rows.length} accounts</span>
          {missing > 0 && <span className="text-xs font-medium text-red-400">{missing} missing</span>}
          {problem > 0 && <span className="text-xs font-medium text-amber-400">{problem} problem</span>}
          {live > 0 && <span className="text-xs font-medium text-green-400">{live} live</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {rows.map((row, i) => (
          <AccountCard key={i} row={row} showCreator={false} />
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function TrackerPage() {
  const [rows,       setRows]       = useState<Row[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [creator,    setCreator]    = useState("all")

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("/api/sheet-tracker")
      const data = await res.json()
      if (data.error) setError(data.error)
      else { setRows(data.rows ?? []); setLastSynced(data.lastSynced) }
    } catch { setError("Failed to connect.") }
    finally  { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const creators  = useMemo(() => [...new Set(rows.map(r => r.Creator).filter(Boolean))].sort(), [rows])
  const platforms = useMemo(() => [...new Set(rows.map(r => r.Plattform).filter(Boolean))], [rows])

  const filteredRows = useMemo(() =>
    creator === "all" ? rows : rows.filter(r => r.Creator === creator),
    [rows, creator]
  )

  const creatorGroups = useMemo(() => {
    const groups: Record<string, Row[]> = {}
    for (const row of filteredRows) {
      const key = row.Creator || "Unknown"
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
    }
    return groups
  }, [filteredRows])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Account Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">
            {lastSynced ? `Last synced at ${new Date(lastSynced).toLocaleTimeString()}` : "Live sync from Google Sheets"}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Sync
        </button>
      </div>

      {error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-8 text-center max-w-lg mx-auto mt-16">
          <p className="text-red-400 font-medium mb-2">Could not load sheet</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full" />
        </div>
      ) : (
        <>
          {/* Platform overview */}
          <div className="flex gap-4 flex-wrap mb-8">
            {platforms.map(p => (
              <PlatformCard
                key={p}
                platform={p}
                rows={filteredRows.filter(r => r.Plattform === p)}
              />
            ))}
          </div>

          {/* Creator selector */}
          <div className="flex items-center gap-2 flex-wrap mb-8">
            <button
              onClick={() => setCreator("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                creator === "all"
                  ? "bg-white text-gray-950"
                  : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              All Creators
            </button>
            {creators.map(c => (
              <button
                key={c}
                onClick={() => setCreator(c)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  creator === c
                    ? "bg-white text-gray-950"
                    : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  creator === c ? "bg-gray-800 text-gray-950" : "bg-gray-700 text-gray-300"
                }`}>
                  {c[0]}
                </span>
                {c}
              </button>
            ))}
          </div>

          {/* Accounts */}
          {rows.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <p className="text-gray-500">No accounts found in your sheet yet.</p>
            </div>
          ) : creator === "all" ? (
            Object.entries(creatorGroups).map(([c, cRows]) => (
              <CreatorSection key={c} creator={c} rows={cRows} />
            ))
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredRows.map((row, i) => (
                <AccountCard key={i} row={row} showCreator={false} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
