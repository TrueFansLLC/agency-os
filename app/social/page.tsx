"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Filters, InstagramAccount, AccountWithMetrics, Creator } from "@/types/instagram"
import { FbFilters, FbAccount, FbAccountWithMetrics, Creator as FbCreator } from "@/types/facebook"
import { filterAndCompute, computeKPIs } from "@/lib/metrics"
import { filterAndComputeFb, computeFbKPIs } from "@/lib/fb-metrics"
import FilterBar    from "@/components/social/FilterBar"
import KPICards     from "@/components/social/KPICards"
import AccountTable from "@/components/social/AccountTable"
import AccountModal from "@/components/social/AccountModal"
import FbFilterBar    from "@/components/facebook/FbFilterBar"
import FbKPICards     from "@/components/facebook/FbKPICards"
import FbAccountTable from "@/components/facebook/FbAccountTable"
import FbAccountModal from "@/components/facebook/FbAccountModal"

type PlatformTab = "Alle" | "Instagram" | "Facebook" | "Threads"

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

const DEFAULT_IG_FILTERS: Filters = {
  dateRange: "30d", customFrom: "", customTo: "",
  creator: "all", market: "all", status: "all", showArchived: false,
}

const DEFAULT_FB_FILTERS: FbFilters = {
  dateRange: "30d", customFrom: "", customTo: "",
  creator: "all", market: "all", status: "all", showArchived: false,
}

type IgModalState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; account: AccountWithMetrics }

type FbModalState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; account: FbAccountWithMetrics }

export default function SocialPage() {
  const [platform, setPlatform] = useState<PlatformTab>("Instagram")

  // ── Instagram state ───────────────────────────────────────────
  const [accountList,   setAccountList]   = useState<InstagramAccount[]>([])
  const [creatorList,   setCreatorList]   = useState<Creator[]>([])
  const [marketList,    setMarketList]    = useState<string[]>(["Germany", "USA"])
  const [isLoading,     setIsLoading]     = useState(true)
  const [syncingId,     setSyncingId]     = useState<string | null>(null)
  const [syncingAll,    setSyncingAll]    = useState(false)
  const [syncProgress,  setSyncProgress]  = useState<{ done: number; total: number } | null>(null)
  const [igFilters,     setIgFilters]     = useState<Filters>(DEFAULT_IG_FILTERS)
  const [igModal,       setIgModal]       = useState<IgModalState>({ open: false })

  // ── Facebook state ────────────────────────────────────────────
  const [fbAccountList,  setFbAccountList]  = useState<FbAccount[]>([])
  const [fbCreatorList,  setFbCreatorList]  = useState<FbCreator[]>([])
  const [fbMarketList,   setFbMarketList]   = useState<string[]>(["Germany", "USA"])
  const [fbIsLoading,    setFbIsLoading]    = useState(true)
  const [fbSyncingId,    setFbSyncingId]    = useState<string | null>(null)
  const [fbSyncingAll,   setFbSyncingAll]   = useState(false)
  const [fbSyncProgress, setFbSyncProgress] = useState<{ done: number; total: number } | null>(null)
  const [fbFilters,      setFbFilters]      = useState<FbFilters>(DEFAULT_FB_FILTERS)
  const [fbModal,        setFbModal]        = useState<FbModalState>({ open: false })

  // ── Alle tab state ────────────────────────────────────────────
  const [pairs,        setPairs]        = useState<Pair[]>([])
  const [pairsLoading, setPairsLoading] = useState(true)
  const [creatorFilter, setCreatorFilter] = useState("all")

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

  const loadFbData = useCallback(async () => {
    setFbIsLoading(true)
    try {
      const [accRes, creatRes, mktRes] = await Promise.all([
        fetch("/api/facebook-accounts"),
        fetch("/api/creators"),
        fetch("/api/markets"),
      ])
      const [accounts, creators, markets] = await Promise.all([
        accRes.json(), creatRes.json(), mktRes.json(),
      ])
      setFbAccountList(Array.isArray(accounts) ? accounts : [])
      setFbCreatorList(Array.isArray(creators) ? creators : [])
      setFbMarketList(Array.isArray(markets) && markets.length ? markets : ["Germany", "USA"])
    } catch (err) {
      console.error("Failed to load FB data:", err)
    } finally {
      setFbIsLoading(false)
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

    // Import from Account Tracker, then auto-sync any never-synced pages
    fetch("/api/facebook-accounts/import", { method: "POST" })
      .then(() => fetch("/api/facebook-accounts"))
      .then(r => r.json())
      .then(async (accounts: FbAccount[]) => {
        const unsynced = (Array.isArray(accounts) ? accounts : [])
          .filter(a => !a.archived && !a.lastSyncedAt)
        for (const a of unsynced) {
          try { await fetch(`/api/facebook-sync/${a.id}`, { method: "POST" }) } catch { /* continue */ }
        }
        await loadFbData()
      })
      .catch(() => loadFbData())

    loadPairs()
  }, [loadIgData, loadFbData, loadPairs])

  // ── Instagram derived values ──────────────────────────────────
  const igFiltered    = useMemo(() => filterAndCompute(accountList, igFilters), [accountList, igFilters])
  const igKpis        = useMemo(() => computeKPIs(igFiltered), [igFiltered])
  const hasIgAccounts = accountList.filter(a => !a.archived).length > 0

  // ── Facebook derived values ───────────────────────────────────
  const fbFiltered    = useMemo(() => filterAndComputeFb(fbAccountList, fbFilters), [fbAccountList, fbFilters])
  const fbKpis        = useMemo(() => computeFbKPIs(fbFiltered), [fbFiltered])
  const hasFbAccounts = fbAccountList.filter(a => !a.archived).length > 0

  // ── Alle derived values ───────────────────────────────────────
  const creatorOptions = useMemo(() =>
    [...new Set(pairs.map(p => p.creator))].sort(),
    [pairs]
  )
  const filteredPairs = useMemo(() =>
    pairs.filter(p => creatorFilter === "all" || p.creator === creatorFilter),
    [pairs, creatorFilter]
  )
  const allKpis = useMemo(() => ({
    total:      pairs.length,
    igLive:     pairs.filter(p => p.ig_status === "Fertig").length,
    fbLive:     pairs.filter(p => p.fb_status === "Fertig").length,
    bothActive: pairs.filter(p => p.ig_posting && p.fb_posting).length,
  }), [pairs])

  // ── Instagram handlers ────────────────────────────────────────
  function handleIgAddCreator(name: string): Creator {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "")
    const creator: Creator = { id, name }
    setCreatorList(prev => prev.some(c => c.id === id) ? prev : [...prev, creator])
    return creator
  }

  function handleIgAddMarket(name: string): string {
    const trimmed = name.trim()
    setMarketList(prev =>
      prev.some(m => m.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed].sort()
    )
    return trimmed
  }

  async function handleIgSubmit(account: InstagramAccount) {
    const isEdit = igModal.open && igModal.mode === "edit"
    const res = await fetch(isEdit ? `/api/accounts/${account.id}` : "/api/accounts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Failed to save account: ${body.error ?? res.statusText}`)
      return
    }
    setIgModal({ open: false })
    await loadIgData()
  }

  async function handleIgArchive(id: string) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    })
    await loadIgData()
  }

  async function handleIgSync(id: string, force = false) {
    setSyncingId(id)
    try {
      const res = await fetch(force ? `/api/sync/${id}?force=1` : `/api/sync/${id}`, { method: "POST" })
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

  async function handleIgSyncAll() {
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

  // ── Facebook handlers ─────────────────────────────────────────
  function handleFbAddCreator(name: string): FbCreator {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "")
    const creator: FbCreator = { id, name }
    setFbCreatorList(prev => prev.some(c => c.id === id) ? prev : [...prev, creator])
    return creator
  }

  function handleFbAddMarket(name: string): string {
    const trimmed = name.trim()
    setFbMarketList(prev =>
      prev.some(m => m.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed].sort()
    )
    return trimmed
  }

  async function handleFbSubmit(account: FbAccount) {
    const isEdit = fbModal.open && fbModal.mode === "edit"
    const res = await fetch(isEdit ? `/api/facebook-accounts/${account.id}` : "/api/facebook-accounts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Failed to save page: ${body.error ?? res.statusText}`)
      return
    }
    setFbModal({ open: false })
    await loadFbData()
  }

  async function handleFbArchive(id: string) {
    await fetch(`/api/facebook-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    })
    await loadFbData()
  }

  async function handleFbSync(id: string, force = false) {
    setFbSyncingId(id)
    try {
      const res = await fetch(force ? `/api/facebook-sync/${id}?force=1` : `/api/facebook-sync/${id}`, { method: "POST" })
      if (!res.ok) {
        const { error } = await res.json()
        alert(`Sync failed: ${error}`)
      }
      await loadFbData()
    } catch {
      alert("Sync failed — check your connection.")
    } finally {
      setFbSyncingId(null)
    }
  }

  async function handleFbSyncAll() {
    const today = new Date().toISOString().split("T")[0]
    const ids = fbAccountList
      .filter(a => !a.archived)
      .filter(a => !a.lastSyncedAt || !a.lastSyncedAt.startsWith(today))
      .map(a => a.id)
    if (!ids.length) {
      alert(`All pages already synced today. (${fbAccountList.filter(a => !a.archived).length} — quota protected)`)
      return
    }
    setFbSyncingAll(true)
    setFbSyncProgress({ done: 0, total: ids.length })
    for (let i = 0; i < ids.length; i++) {
      try { await fetch(`/api/facebook-sync/${ids[i]}`, { method: "POST" }) } catch { }
      setFbSyncProgress({ done: i + 1, total: ids.length })
    }
    await loadFbData()
    setFbSyncingAll(false)
    setFbSyncProgress(null)
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-8">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Performance Tracking</h1>
          <p className="text-gray-400 mt-1 text-sm">Instagram, Facebook & Threads across all creators</p>
        </div>
        {platform === "Instagram" && (
          <div className="flex items-center gap-2">
            <button onClick={handleIgSyncAll} disabled={syncingAll || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={syncingAll ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {syncProgress ? `Syncing ${syncProgress.done}/${syncProgress.total}…` : "Sync All"}
            </button>
            <button onClick={() => setIgModal({ open: true, mode: "add" })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Account
            </button>
          </div>
        )}
        {platform === "Facebook" && (
          <div className="flex items-center gap-2">
            <button onClick={handleFbSyncAll} disabled={fbSyncingAll || fbIsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 border border-gray-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={fbSyncingAll ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {fbSyncProgress ? `Syncing ${fbSyncProgress.done}/${fbSyncProgress.total}…` : "Sync All"}
            </button>
            <button onClick={() => setFbModal({ open: true, mode: "add" })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Page
            </button>
          </div>
        )}
      </div>

      {/* Platform tabs */}
      <div className="flex items-center gap-1.5 mb-6 pb-5 border-b border-gray-800">
        {(["Alle", "Instagram", "Facebook", "Threads"] as const).map(tab => (
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
            {tab === "Threads" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>
              </svg>
            )}
            {tab}
          </button>
        ))}
      </div>

      {/* ═══ THREADS TAB (placeholder — Daten via API folgt) ═════ */}
      {platform === "Threads" && (
        <div className="border border-dashed border-gray-800 rounded-xl py-20 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>
            </svg>
          </div>
          <p className="text-white font-medium mb-1">Threads Performance Tracking</p>
          <p className="text-gray-500 text-sm">Kommt bald — sobald wir eine Threads-Daten-API anbinden.<br/>Accounts verwaltest du im <span className="text-gray-300">Account Tracker → Threads</span>.</p>
        </div>
      )}

      {/* ═══ INSTAGRAM TAB ═══════════════════════════════════════ */}
      {platform === "Instagram" && (
        <>
          <FilterBar filters={igFilters} onChange={setIgFilters} creators={creatorList} markets={marketList} />
          <KPICards kpis={igKpis} />
          {isLoading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-500 text-sm">Loading accounts…</p>
            </div>
          ) : (
            <AccountTable
              accounts={igFiltered}
              hasAccounts={hasIgAccounts}
              syncingId={syncingId}
              onEdit={account => setIgModal({ open: true, mode: "edit", account })}
              onArchive={handleIgArchive}
              onSync={handleIgSync}
              onAddFirst={() => setIgModal({ open: true, mode: "add" })}
            />
          )}
          {igModal.open && (
            <AccountModal
              mode={igModal.mode}
              account={igModal.mode === "edit" ? igModal.account : undefined}
              creators={creatorList}
              markets={marketList}
              onSubmit={handleIgSubmit}
              onAddCreator={handleIgAddCreator}
              onAddMarket={handleIgAddMarket}
              onClose={() => setIgModal({ open: false })}
            />
          )}
        </>
      )}

      {/* ═══ FACEBOOK TAB ════════════════════════════════════════ */}
      {platform === "Facebook" && (
        <>
          <FbFilterBar filters={fbFilters} onChange={setFbFilters} creators={fbCreatorList} markets={fbMarketList} />
          <FbKPICards kpis={fbKpis} />
          {fbIsLoading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <p className="text-gray-500 text-sm">Loading pages…</p>
            </div>
          ) : (
            <FbAccountTable
              accounts={fbFiltered}
              hasAccounts={hasFbAccounts}
              syncingId={fbSyncingId}
              onEdit={account => setFbModal({ open: true, mode: "edit", account })}
              onArchive={handleFbArchive}
              onSync={handleFbSync}
              onAddFirst={() => setFbModal({ open: true, mode: "add" })}
            />
          )}
          {fbModal.open && (
            <FbAccountModal
              mode={fbModal.mode}
              account={fbModal.mode === "edit" ? fbModal.account : undefined}
              creators={fbCreatorList}
              markets={fbMarketList}
              onSubmit={handleFbSubmit}
              onAddCreator={handleFbAddCreator}
              onAddMarket={handleFbAddMarket}
              onClose={() => setFbModal({ open: false })}
            />
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
                    <div className="px-4 pt-3.5 pb-3 border-b border-gray-800">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white font-semibold text-sm">{pair.creator}</p>
                        {pair.branding && <span className="text-gray-500 text-xs shrink-0">{pair.branding}</span>}
                      </div>
                      {pair.content_creator && (
                        <p className="text-gray-600 text-xs mt-0.5">Content: {pair.content_creator}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800">
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
