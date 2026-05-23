"use client"

import { useState, useEffect, useMemo } from "react"

type Row = Record<string, string>

const COL_LABELS: Record<string, string> = {
  JaNeinStatus: "Done",
  JaNein: "Done",
  Status: "Status",
  "Priorität": "Priority",
  Trennung: "Type",
  Creator: "Creator",
  PostingModus: "Mode",
  Mitarbeiter: "Employee",
  Plattform: "Platform",
  CheckStatus: "Check",
  Brandings: "Brand",
  Hinweis: "Notes",
}

const BADGE_COLORS: Record<string, Record<string, string>> = {
  JaNeinStatus: {
    Ja: "bg-green-900/50 text-green-400 border-green-800",
    Nein: "bg-red-900/50 text-red-400 border-red-800",
    "In Arbeit": "bg-blue-900/50 text-blue-400 border-blue-800",
  },
  JaNein: {
    Ja: "bg-green-900/50 text-green-400 border-green-800",
    Nein: "bg-red-900/50 text-red-400 border-red-800",
    "In Arbeit": "bg-blue-900/50 text-blue-400 border-blue-800",
  },
  "Priorität": {
    Hoch: "bg-red-900/50 text-red-400 border-red-800",
    Mittel: "bg-amber-900/50 text-amber-400 border-amber-800",
    Niedrig: "bg-green-900/50 text-green-400 border-green-800",
  },
  Trennung: {
    Getrennt: "bg-gray-800 text-gray-400 border-gray-700",
    Verbunden: "bg-cyan-900/50 text-cyan-400 border-cyan-800",
    Unklar: "bg-amber-900/50 text-amber-400 border-amber-800",
  },
  PostingModus: {
    "Manuell separat": "bg-gray-800 text-gray-400 border-gray-700",
    Crossposting: "bg-purple-900/50 text-purple-400 border-purple-800",
    Unklar: "bg-amber-900/50 text-amber-400 border-amber-800",
  },
  Plattform: {
    Instagram: "bg-purple-900/50 text-purple-400 border-purple-800",
    Facebook: "bg-blue-900/50 text-blue-400 border-blue-800",
    Threads: "bg-gray-800 text-gray-400 border-gray-700",
    TikTok: "bg-pink-900/50 text-pink-400 border-pink-800",
    YouTube: "bg-red-900/50 text-red-400 border-red-800",
  },
  CheckStatus: {
    Fertig: "bg-green-900/50 text-green-400 border-green-800",
    Fehlt: "bg-amber-900/50 text-amber-400 border-amber-800",
    "In Arbeit": "bg-blue-900/50 text-blue-400 border-blue-800",
    Problem: "bg-red-900/50 text-red-400 border-red-800",
  },
}

const BADGE_COLS = new Set([
  "JaNeinStatus", "JaNein", "Priorität", "Trennung", "PostingModus", "Plattform", "CheckStatus",
])

const TEXT_COLS = new Set(["Creator", "Mitarbeiter", "Brandings", "Hinweis", "Status"])

function Badge({ col, value }: { col: string; value: string }) {
  if (!value) return <span className="text-gray-600">—</span>
  const colorMap = BADGE_COLORS[col]
  const cls = colorMap?.[value] ?? "bg-gray-800 text-gray-400 border-gray-700"
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {value}
    </span>
  )
}

function FilterSelect({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-500 cursor-pointer"
    >
      <option value="all">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export default function TrackerPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [filterCreator, setFilterCreator] = useState("all")
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [filterEmployee, setFilterEmployee] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/sheet-tracker")
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setRows(data.rows ?? [])
        setHeaders(data.headers ?? [])
        setLastSynced(data.lastSynced)
      }
    } catch {
      setError("Failed to connect to the server.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const creators  = useMemo(() => [...new Set(rows.map(r => r.Creator).filter(Boolean))].sort(), [rows])
  const platforms = useMemo(() => [...new Set(rows.map(r => r.Plattform).filter(Boolean))].sort(), [rows])
  const employees = useMemo(() => [...new Set(rows.map(r => r.Mitarbeiter).filter(Boolean))].sort(), [rows])
  const statuses  = useMemo(() => [...new Set(rows.map(r => r.CheckStatus).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => rows.filter(row => {
    if (filterCreator !== "all" && row.Creator !== filterCreator) return false
    if (filterPlatform !== "all" && row.Plattform !== filterPlatform) return false
    if (filterEmployee !== "all" && row.Mitarbeiter !== filterEmployee) return false
    if (filterStatus !== "all" && row.CheckStatus !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return Object.values(row).some(v => v.toLowerCase().includes(q))
    }
    return true
  }), [rows, filterCreator, filterPlatform, filterEmployee, filterStatus, search])

  const stats = useMemo(() => ({
    total:    rows.length,
    fertig:   rows.filter(r => r.CheckStatus === "Fertig").length,
    inArbeit: rows.filter(r => r.CheckStatus === "In Arbeit").length,
    fehlt:    rows.filter(r => r.CheckStatus === "Fehlt").length,
    problem:  rows.filter(r => r.CheckStatus === "Problem").length,
  }), [rows])

  const hasActiveFilter = filterCreator !== "all" || filterPlatform !== "all" ||
    filterEmployee !== "all" || filterStatus !== "all" || search !== ""

  function clearFilters() {
    setFilterCreator("all")
    setFilterPlatform("all")
    setFilterEmployee("all")
    setFilterStatus("all")
    setSearch("")
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Posting Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">
            {lastSynced
              ? `Last synced at ${new Date(lastSynced).toLocaleTimeString()}`
              : "Live sync from Google Sheets"}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Sync
        </button>
      </div>

      {error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-8 text-center max-w-lg mx-auto mt-16">
          <svg className="w-10 h-10 text-red-500 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-red-400 font-medium mb-2">Could not load sheet</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-left text-xs text-gray-500 space-y-1">
            <p className="text-gray-400 font-medium mb-2">To fix this:</p>
            <p>1. Open your Google Sheet</p>
            <p>2. Click <span className="text-white">File → Share → Publish to web</span></p>
            <p>3. Select <span className="text-white">CSV</span> from the format dropdown</p>
            <p>4. Click <span className="text-white">Publish</span>, then come back and click Sync</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {[
              { label: "Total",       value: stats.total,    color: "text-white" },
              { label: "Done",        value: stats.fertig,   color: "text-green-400" },
              { label: "In Progress", value: stats.inArbeit, color: "text-blue-400" },
              { label: "Missing",     value: stats.fehlt,    color: "text-amber-400" },
              { label: "Problem",     value: stats.problem,  color: "text-red-400" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 w-48"
              />
            </div>
            {creators.length > 0 && (
              <FilterSelect value={filterCreator} onChange={setFilterCreator} options={creators} placeholder="All Creators" />
            )}
            {platforms.length > 0 && (
              <FilterSelect value={filterPlatform} onChange={setFilterPlatform} options={platforms} placeholder="All Platforms" />
            )}
            {employees.length > 0 && (
              <FilterSelect value={filterEmployee} onChange={setFilterEmployee} options={employees} placeholder="All Employees" />
            )}
            {statuses.length > 0 && (
              <FilterSelect value={filterStatus} onChange={setFilterStatus} options={statuses} placeholder="All Statuses" />
            )}
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-xs text-gray-500 hover:text-white transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {headers.map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {COL_LABELS[h] ?? h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={headers.length} className="px-4 py-16 text-center text-gray-600">
                        No entries match your filters
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        {headers.map(h => (
                          <td key={h} className="px-4 py-3">
                            {BADGE_COLS.has(h) ? (
                              <Badge col={h} value={row[h]} />
                            ) : h === "Hinweis" ? (
                              <span className="text-gray-400 text-xs max-w-[180px] truncate block" title={row[h]}>
                                {row[h] || "—"}
                              </span>
                            ) : (
                              <span className="text-gray-300 whitespace-nowrap">{row[h] || "—"}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                {filtered.length === rows.length
                  ? `${rows.length} entries`
                  : `${filtered.length} of ${rows.length} entries`}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
