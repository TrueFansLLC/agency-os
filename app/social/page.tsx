"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Filters, InstagramAccount, AccountWithMetrics, Creator } from "@/types/instagram"
import { filterAndCompute, computeKPIs } from "@/lib/metrics"
import FilterBar    from "@/components/social/FilterBar"
import KPICards     from "@/components/social/KPICards"
import AccountTable from "@/components/social/AccountTable"
import AccountModal from "@/components/social/AccountModal"

type PlatformTab = "Alle" | "Instagram" | "Facebook"

type Pair = {
  id: string
  creator: string
  branding: string | null
  content_creator: string | null
  ig_mitarbeiter: string | null
  fb_mitarbeiter: string | null
  ig_username: string | null
  ig_status: string
  ig_posting: boolean
  ig_link: string | null
  fb_username: string | null
  fb_status: string
  fb_posting: boolean
  fb_link: string | null
  notes: string | null
}

const DEFAULT_FILTERS: Filters = {
  dateRange: "30d", customFrom: "", customTo: "",
  creator: "all", market: "all", status: "all", showArchived: false,
}

type ModalState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; account: AccountWithMetrics }

const STATUS_BADGE: Record<string, string> = {
  "Fertig":    "text-emerald-400 bg-emerald-900/30 border-emerald-700/60",
  "Fehlt":     "text-red-400    bg-red-900/30    border-red-700/60",
  "In Arbeit": "text-yellow-400 bg-yellow-900/30 border-yellow-700/60",
}

export default function SocialPage() {
  const [platform,      setPlatform]      = useState<PlatformTab>("Instagram")
  const [creatorFilter, setCreatorFilter] = useState("all")

  // ── Instagram state ──────────────────────────────────────────
  const [accountList,   setAccountList]   = useState<InstagramAccount[]>([])
  const [creatorList,   setCreatorList]   = useState<Creator[]>([])
  const [marketList,    setMarketList]    = useState<string[]>(["Germany", "USA"])
  const [isLoading,     setIsLoading]     = useState(true)
  const [syncingId,     setSyncingId]     = useState<string | null>(null)
  const [syncingAll,    setSyncingAll]    = useState(false)
  const [syncProgress,  setSyncProgress]  = useState<{ done: number; total: number } | null>(null)
  const [filters,       setFilters]       = useState<Filters>(DEFAULT_FILTERS)
  const [modal,         setModal]         = useState<ModalState>({ open: false })

  // ── Account Tracker (pairs) state ────────────────────────────
  const [pairs,        setPairs]        = useState<Pair[]>([])
  const [pairsLoading, setPairsLoading] = useState(true)

  // ── Loaders ───────────────────────────────────────────────────
  const loadIgData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [accRes, creatRes, mktRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/creators"),
        fetch("/api/markets"),
      ])
      const [accounts, creators, markets] = await Promise.all([
        accRes.json(), creatRes.json(), mktRes.json(),
      ])
      setAccountList(Array.isArray(accounts) ? accounts : [])
      setCreatorList(Array.isArray(creators) ? creators : [])
      setMarketList(Array.isArray(markets) && markets.length ? markets : ["Germany", "USA"])
    } catch (err) {
      console.error("Failed to load IG data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadPairs = useCallback(async () => {
    setPairsLoading(true)
    try {
      const res  = await fetch("/api/creator-accounts")
      const data = await res.json()
      setPairs(Array.isArray(data) ? data : [])
    } finally {
      setPairsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIgData().then(() => {
      fetch("/api/accounts/import", { method: "POST" })
        .then(() => loadIgData())
        .catch(() => {})
    })
    loadPairs()
  }, [loadIgData, loadPairs])

  // ── Instagram derived values ──────────────────────────────────
  const filtered    = useMemo(() => filterAndCompute(accountList, filters), [accountList, filters])
  const kpis        = useMemo(() => computeKPIs(filtered), [filtered])
  const hasAccounts = accountList.filter(a => !a.archived).length > 0

  // ── Pairs derived values ──────────────────────────────────────
  const creatorOptions = useMemo(() =>
    [...new Set(pairs.map(p => p.creator))].sort(),
    [pairs]
  )

  const filteredPairs = useMemo(() =>
    pairs.filter(p => creatorFilter === "all" || p.creator === creatorFilter),
    [pairs, creatorFilter]
  )

  const fbAccounts = useMemo(() =>
    filteredPairs.filter(p => p.fb_username),
    [filteredPairs]
  )

  const fbKpis = useMemo(() => ({
    total:  pairs.filter(p => p.fb_username).length,
    live:   pairs.filter(p => p.fb_username && p.fb_status === "Fertig").length,
    active: pairs.filter(p => p.fb_username && p.fb_posting).length,
    noLink: pairs.filter(p => p.fb_username && !p.fb_link).length,
  }), [pairs])

  const allKpis = useMemo(() => ({
    total:      pairs.length,
    igLive:     pairs.filter(p => p.ig_status === "Fertig").length,
    fbLive:     pairs.filter(p => p.fb_status === "Fertig").length,
    bothActive: pairs.filter(p => p.ig_posting && p.fb_posting).length,
  }), [pairs])

  // ── Instagram handlers ────────────────────────────────────────
  function handleAddCreator(name: string): Creator {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "")
    const creator: Creator = { id, name }
    setCreatorList(prev => prev.some(c => c.id === id) ? prev : [...prev, creator])
    return creator
  }

  function handleAddMarket(name: string): string {
    const trimmed = name.trim()
    setMarketList(prev =>
      prev.some(m => m.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed].sort()
    )
    return trimmed
  }

  async function handleSubmit(account: InstagramAccount) {
    const isEdit = modal.open && modal.mode === "edit"
    const url    = isEdit ? `/api/accounts/${account.id}` : "/api/accounts"
    const method = isEdit ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Failed to save account: ${body.error ?? res.statusText}`)
      return
    }
    setModal({ open: false })
    await loadIgData()
  }

  async function handleArchive(id: string) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    })
    await loadIgData()
  }

  async function handleSync(id: string, force = false) {
    setSyncingId(id)
    try {
      const url = force ? `/api/sync/${id}?force=1` : `/api/sync/${id}`
      const res = await fetch(url, { method: "POST" })
      if (!res.ok) {
        const { error } = await res.json()
        alert(`Sync failed: ${error}`)
      }
      await loadIgData()
    } catch {
      alert("Sync failed — check your connection.")
    } finally {
      setSyncingId(null)
    }
  }

  async function handleSyncAll() {
    const today = new Date().toISOString().split("T")[0]
    const ids = accountList
      .filter(a => !a.archived)
      .filter(a => !a.lastSyncedAt || !a.lastSyncedAt.startsWith(today))
      .map(a => a.id)

    if (!ids.length) {
      alert(`All accounts already synced today. (${accountList.filter(a => !a.archived).length} — quota protected)`)
      return
    }
    setSyncingAll(true)
    setSyncProgress({ done: 0, total: ids.length })
    for (let i = 0; i < ids.length; i++) {
      try { await fetch(`/api/sync/${ids[i]}`, { method: "POST" }) } catch { }
      setSyncProgress({ done: i + 1, total: ids.length })
    }
    await loadIgData()
    setSyncingAll(false)
    setSyncProgress(null)
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-8">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Social Media</h1>
          <p className="text-gray-400 mt-1 text-sm">Instagram & Facebook across all creators</p>
        </div>
        {platform === "Instagram" && (
          <div className="flex items-center gap-2">
            <button onClick={handleSyncAll} disabled={syncingAll || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={syncingAll ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {syncProgress ? `Syncing ${syncProgress.done}/${syncProgress.total}…` : "Sync All"}
            </button>
            <button onClick={() => setModal({ open: true, mode: "add" })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Account
            </button>
          </div>
        )}
      </div>

      {/* Platform tabs */}
      <div className="flex items-center gap-1.5 mb-6 pb-5 border-b border-gray-800">
        {(["Alle", "Instagram", "Facebook"] as const).map(tab => (
          <button key={tab} onClick={() => { setPlatform(tab); setCreatorFilter("all") }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              platform === tab ? "bg-white text-gray-900" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}>
            {tab === "Alle" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            )}
            {tab === "Instagram" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            )}
            {tab === "Facebook" && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            )}
            {tab}
          </button>
        ))}
      </div>

      {/* ═══ INSTAGRAM TAB ═══════════════════════════════════════ */}
      {platform === "Instagram" && (
        <>
          <FilterBar filters={filters} onChange={setFilters} creators={creatorList} markets={marketList} />
          <KPICards kpis={kpis} />
          {isLoading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-500 text-sm">Loading accounts…</p>
            </div>
          ) : (
            <AccountTable
              accounts={filtered}
              hasAccounts={hasAccounts}
              syncingId={syncingId}
              onEdit={account => setModal({ open: true, mode: "edit", account })}
              onArchive={handleArchive}
              onSync={handleSync}
              onAddFirst={() => setModal({ open: true, mode: "add" })}
            />
          )}
          {modal.open && (
            <AccountModal
              mode={modal.mode}
              account={modal.mode === "edit" ? modal.account : undefined}
              creators={creatorList}
              markets={marketList}
              onSubmit={handleSubmit}
              onAddCreator={handleAddCreator}
              onAddMarket={handleAddMarket}
              onClose={() => setModal({ open: false })}
            />
          )}
        </>
      )}

      {/* ═══ FACEBOOK TAB ════════════════════════════════════════ */}
      {platform === "Facebook" && (
        <>
          {/* KPI bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            {[
              { label: "Facebook Pages",  value: fbKpis.total,  color: "text-blue-400" },
              { label: "Live (Fertig)",   value: fbKpis.live,   color: "text-emerald-400" },
              { label: "Posting aktiv",   value: fbKpis.active, color: "text-green-400" },
              { label: "Kein Link",       value: fbKpis.noLink, color: fbKpis.noLink > 0 ? "text-amber-400" : "text-emerald-400" },
            ].map(k => (
              <div key={k.label} className="bg-gradient-to-br from-gray-900 to-gray-800/60 border border-gray-800 rounded-xl p-4 flex-1 min-w-[130px] hover:border-gray-700 transition-all">
                <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
                <p className="text-gray-400 text-xs font-medium mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Creator filter */}
          {creatorOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {["all", ...creatorOptions].map(c => (
                <button key={c} onClick={() => setCreatorFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    creatorFilter === c ? "bg-white text-gray-950" : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white"
                  }`}>
                  {c === "all" ? "All Creators" : c}
                </button>
              ))}
            </div>
          )}

          {/* Facebook table */}
          {pairsLoading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-500 text-sm">Loading…</p>
            </div>
          ) : fbAccounts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-16 text-center">
              <p className="text-gray-400 font-medium mb-2">No Facebook Pages found</p>
              <p className="text-gray-500 text-sm">
                Add Facebook usernames and links in the <span className="text-white font-medium">Account Tracker</span>.
              </p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Page</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Posting</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {fbAccounts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-white text-sm font-medium">{p.fb_username}</p>
                        {p.branding && <p className="text-gray-500 text-xs mt-0.5">{p.branding}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-sm">{p.creator}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-sm">{p.fb_mitarbeiter ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_BADGE[p.fb_status] ?? "text-gray-400 bg-gray-800 border-gray-700"}`}>
                          {p.fb_status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${p.fb_posting ? "text-emerald-400" : "text-red-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.fb_posting ? "bg-emerald-400" : "bg-red-400"}`}/>
                          {p.fb_posting ? "Aktiv" : "Pausiert"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.fb_link ? (
                          <a href={p.fb_link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs truncate max-w-[160px]">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            {p.fb_link.replace(/^https?:\/\//, "").slice(0, 35)}
                          </a>
                        ) : (
                          <span className="text-red-400 text-xs">Fehlt</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══ ALLE TAB ════════════════════════════════════════════ */}
      {platform === "Alle" && (
        <>
          {/* KPI bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            {[
              { label: "Account Pairs",  value: allKpis.total,      color: "text-white" },
              { label: "Instagram Live", value: allKpis.igLive,     color: "text-purple-400" },
              { label: "Facebook Live",  value: allKpis.fbLive,     color: "text-blue-400" },
              { label: "Beide aktiv",    value: allKpis.bothActive, color: "text-emerald-400" },
            ].map(k => (
              <div key={k.label} className="bg-gradient-to-br from-gray-900 to-gray-800/60 border border-gray-800 rounded-xl p-4 flex-1 min-w-[130px] hover:border-gray-700 transition-all">
                <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
                <p className="text-gray-400 text-xs font-medium mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Creator filter */}
          {creatorOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {["all", ...creatorOptions].map(c => (
                <button key={c} onClick={() => setCreatorFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    creatorFilter === c ? "bg-white text-gray-950" : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white"
                  }`}>
                  {c === "all" ? "All Creators" : c}
                </button>
              ))}
            </div>
          )}

          {/* Pair cards */}
          {pairsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full"/>
            </div>
          ) : filteredPairs.length === 0 ? (
            <div className="border border-gray-800 border-dashed rounded-2xl p-16 text-center">
              <p className="text-gray-400 font-medium mb-2">No accounts yet</p>
              <p className="text-gray-500 text-sm">Add accounts in the Account Tracker.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPairs.map(pair => {
                const hasIssue =
                  pair.ig_status === "Fehlt" || pair.fb_status === "Fehlt" ||
                  !pair.ig_posting || !pair.fb_posting ||
                  !pair.ig_link || !pair.fb_link

                return (
                  <div key={pair.id}
                    className={`bg-gray-900 border rounded-xl overflow-hidden ${hasIssue ? "border-red-900/50" : "border-gray-800"}`}>
                    {/* Card header */}
                    <div className="px-4 pt-3.5 pb-3 border-b border-gray-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white font-semibold text-sm">{pair.creator}</p>
                        {pair.branding && <span className="text-gray-500 text-xs shrink-0">{pair.branding}</span>}
                      </div>
                      {pair.content_creator && (
                        <p className="text-gray-600 text-xs mt-0.5">Content: {pair.content_creator}</p>
                      )}
                    </div>
                    {/* IG + FB columns */}
                    <div className="grid grid-cols-2 divide-x divide-gray-800">
                      {/* Instagram */}
                      <div className="px-3 py-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-purple-400 mb-2">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>
                            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                          </svg>
                          <span className="text-xs font-semibold">Instagram</span>
                        </div>
                        {pair.ig_username && <p className="text-gray-400 text-xs truncate">@{pair.ig_username}</p>}
                        {[
                          { label: "Account", ok: pair.ig_status === "Fertig" },
                          { label: "Posting", ok: pair.ig_posting },
                          { label: "Link",    ok: !!pair.ig_link },
                        ].map(r => (
                          <div key={r.label} className="flex items-center gap-1.5 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-green-400" : "bg-red-500"}`}/>
                            <span className={r.ok ? "text-gray-500" : "text-red-400 font-medium"}>{r.label}</span>
                          </div>
                        ))}
                        {pair.ig_mitarbeiter && (
                          <p className="text-gray-600 text-xs pt-1 truncate">{pair.ig_mitarbeiter}</p>
                        )}
                      </div>
                      {/* Facebook */}
                      <div className="px-3 py-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-blue-400 mb-2">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                          </svg>
                          <span className="text-xs font-semibold">Facebook</span>
                        </div>
                        {pair.fb_username && <p className="text-gray-400 text-xs truncate">{pair.fb_username}</p>}
                        {[
                          { label: "Page",    ok: pair.fb_status === "Fertig" },
                          { label: "Posting", ok: pair.fb_posting },
                          { label: "Link",    ok: !!pair.fb_link },
                        ].map(r => (
                          <div key={r.label} className="flex items-center gap-1.5 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-green-400" : "bg-red-500"}`}/>
                            <span className={r.ok ? "text-gray-500" : "text-red-400 font-medium"}>{r.label}</span>
                          </div>
                        ))}
                        {pair.fb_mitarbeiter && (
                          <p className="text-gray-600 text-xs pt-1 truncate">{pair.fb_mitarbeiter}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
