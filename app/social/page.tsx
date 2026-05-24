"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Filters, InstagramAccount, AccountWithMetrics, Creator } from "@/types/instagram"
import { filterAndCompute, computeKPIs } from "@/lib/metrics"
import FilterBar    from "@/components/social/FilterBar"
import KPICards     from "@/components/social/KPICards"
import AccountTable from "@/components/social/AccountTable"
import AccountModal from "@/components/social/AccountModal"

const DEFAULT_FILTERS: Filters = {
  dateRange:    "30d",
  customFrom:   "",
  customTo:     "",
  creator:      "all",
  market:       "all",
  status:       "all",
  showArchived: false,
}

type ModalState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "edit"; account: AccountWithMetrics }

export default function SocialPage() {
  const [accountList, setAccountList] = useState<InstagramAccount[]>([])
  const [creatorList, setCreatorList] = useState<Creator[]>([])
  const [marketList,  setMarketList]  = useState<string[]>(["Germany", "USA"])
  const [isLoading,   setIsLoading]   = useState(true)
  const [syncingId,   setSyncingId]   = useState<string | null>(null)
  const [syncingAll,  setSyncingAll]  = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [modal,   setModal]   = useState<ModalState>({ open: false })

  const loadData = useCallback(async () => {
    try {
      const [accRes, creatRes, mktRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/creators"),
        fetch("/api/markets"),
      ])
      const [accounts, creators, markets] = await Promise.all([
        accRes.json(),
        creatRes.json(),
        mktRes.json(),
      ])
      setAccountList(Array.isArray(accounts) ? accounts : [])
      setCreatorList(Array.isArray(creators) ? creators : [])
      setMarketList(Array.isArray(markets) && markets.length ? markets : ["Germany", "USA"])
    } catch (err) {
      console.error("Failed to load data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-import from Account Tracker on every page load, then fetch
  useEffect(() => {
    fetch("/api/accounts/import", { method: "POST" })
      .then(() => loadData())
      .catch(() => loadData())
  }, [loadData])

  // ── Derived values ─────────────────────────────────────────────
  const filtered    = useMemo(() => filterAndCompute(accountList, filters), [accountList, filters])
  const kpis        = useMemo(() => computeKPIs(filtered), [filtered])
  const hasAccounts = accountList.filter(a => !a.archived).length > 0

  // ── Handlers ──────────────────────────────────────────────────
  // Creator/market added inline in modal — update local list immediately
  // so the dropdown reflects the new option before the account is saved.
  // The DB record is created by the accounts API on submit.
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
    await loadData()
  }

  async function handleArchive(id: string) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    })
    await loadData()
  }

  async function handleSync(id: string) {
    setSyncingId(id)
    try {
      const res = await fetch(`/api/sync/${id}`, { method: "POST" })
      if (!res.ok) {
        const { error } = await res.json()
        alert(`Sync failed: ${error}`)
      }
      await loadData()
    } catch {
      alert("Sync failed — check your connection.")
    } finally {
      setSyncingId(null)
    }
  }

  async function handleSyncAll() {
    const ids = accountList.filter(a => !a.archived).map(a => a.id)
    if (!ids.length) return
    setSyncingAll(true)
    setSyncProgress({ done: 0, total: ids.length })
    for (let i = 0; i < ids.length; i++) {
      try {
        await fetch(`/api/sync/${ids[i]}`, { method: "POST" })
      } catch {
        // continue syncing others even if one fails
      }
      setSyncProgress({ done: i + 1, total: ids.length })
    }
    await loadData()
    setSyncingAll(false)
    setSyncProgress(null)
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Social Media</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Instagram performance across all creators and markets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={syncingAll ? "animate-spin" : ""}
            >
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {syncProgress ? `Syncing ${syncProgress.done}/${syncProgress.total}…` : "Sync All"}
          </button>
          <button
            onClick={() => setModal({ open: true, mode: "add" })}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Account
          </button>
        </div>
      </div>

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
    </div>
  )
}
