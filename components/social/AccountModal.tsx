"use client"

import { useState, useEffect } from "react"
import {
  InstagramAccount,
  AccountStatus,
  ConnectionStatus,
  DataSource,
  PerformanceLabel,
  Creator,
} from "@/types/instagram"

interface Props {
  mode: "add" | "edit"
  account?: InstagramAccount
  creators: Creator[]
  markets: string[]
  onSubmit: (account: InstagramAccount) => void
  onAddCreator: (name: string) => Creator
  onAddMarket: (name: string) => string
  onClose: () => void
}

const STATUS_OPTIONS: AccountStatus[]   = ["active", "scaling", "testing", "paused", "banned"]
const LABEL_OPTIONS: PerformanceLabel[] = ["New", "Growing", "Top", "Stable", "Declining"]

const FIELD_CLS =
  "w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-gray-500 placeholder-gray-600"
const LABEL_CLS = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider"

export default function AccountModal({
  mode,
  account,
  creators,
  markets,
  onSubmit,
  onAddCreator,
  onAddMarket,
  onClose,
}: Props) {
  const isEdit = mode === "edit"

  // ── Form state ────────────────────────────────────────────────────
  const [username,         setUsername]         = useState(account?.username ?? "")
  const [creatorId,        setCreatorId]        = useState(account?.creatorId ?? creators[0]?.id ?? "")
  const [market,           setMarket]           = useState(account?.market ?? markets[0] ?? "")
  const [status,           setStatus]           = useState<AccountStatus>(account?.status ?? "active")
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(account?.connectionStatus ?? "not_connected")
  const [dataSource,       setDataSource]       = useState<DataSource>(account?.dataSource ?? "instagram_api")
  const [performanceLabel, setPerformanceLabel] = useState<PerformanceLabel>(account?.performanceLabel ?? "New")
  const [notes,            setNotes]            = useState(account?.notes ?? "")

  // ── Inline creator creation ───────────────────────────────────────
  const [showNewCreator,  setShowNewCreator]  = useState(false)
  const [newCreatorName,  setNewCreatorName]  = useState("")
  const [creatorError,    setCreatorError]    = useState("")

  // ── Local creator list (grows as user adds) ───────────────────────
  const [localCreators, setLocalCreators] = useState<Creator[]>(creators)
  useEffect(() => { setLocalCreators(creators) }, [creators])

  // ── Inline market creation ────────────────────────────────────────
  const [showNewMarket, setShowNewMarket] = useState(false)
  const [newMarketName, setNewMarketName] = useState("")
  const [marketError,   setMarketError]   = useState("")

  // ── Local market list (grows as user adds) ────────────────────────
  const [localMarkets, setLocalMarkets] = useState<string[]>(markets)
  useEffect(() => { setLocalMarkets(markets) }, [markets])

  // ── Validation ────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!username.trim())       e.username = "Username is required."
    if (!market.trim())         e.market   = "Market is required."
    if (showNewCreator && !newCreatorName.trim()) e.newCreator = "Enter a creator name."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Add new creator inline ────────────────────────────────────────
  function handleAddCreator() {
    const name = newCreatorName.trim()
    if (!name) { setCreatorError("Enter a name."); return }
    const dupe = localCreators.some(c => c.name.toLowerCase() === name.toLowerCase())
    if (dupe)  { setCreatorError("Creator already exists."); return }

    const newCreator = onAddCreator(name)
    setLocalCreators(prev => [...prev, newCreator])
    setCreatorId(newCreator.id)
    setShowNewCreator(false)
    setNewCreatorName("")
    setCreatorError("")
  }

  // ── Add new market inline ─────────────────────────────────────────
  function handleAddMarketInline() {
    const name = newMarketName.trim()
    if (!name) { setMarketError("Enter a market name."); return }
    const dupe = localMarkets.some(m => m.toLowerCase() === name.toLowerCase())
    if (dupe)  { setMarketError("Market already exists."); return }

    const added = onAddMarket(name)
    setLocalMarkets(prev => [...prev, added].sort())
    setMarket(added)
    setShowNewMarket(false)
    setNewMarketName("")
    setMarketError("")
  }

  // ── Submit ────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const finalCreator = localCreators.find(c => c.id === creatorId) ?? localCreators[0]
    const rawUsername  = username.trim()

    const result: InstagramAccount = {
      ...(account ?? {}),
      id:               account?.id ?? `acc_${Date.now()}`,
      username:         rawUsername.startsWith("@") ? rawUsername : `@${rawUsername}`,
      creatorId:        finalCreator?.id ?? creatorId,
      creatorName:      finalCreator?.name ?? "",
      market:           market.trim(),
      status,
      connectionStatus,
      dataSource,
      notes:            notes.trim(),
      performanceLabel,
      archived:         account?.archived ?? false,
      snapshots:        account?.snapshots ?? [],
      // API-set fields — preserved on edit, undefined for new accounts until first sync
      externalInstagramId: account?.externalInstagramId,
      lastSyncedAt:        account?.lastSyncedAt,
    }

    onSubmit(result)
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-white font-semibold text-base">
            {isEdit ? "Edit Account" : "Add Instagram Account"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Username */}
          <div>
            <label className={LABEL_CLS}>Instagram Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="@username"
              className={FIELD_CLS}
            />
            {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
          </div>

          {/* Creator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={LABEL_CLS + " mb-0"}>Creator</label>
              {!showNewCreator && (
                <button
                  type="button"
                  onClick={() => setShowNewCreator(true)}
                  className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span> New creator
                </button>
              )}
            </div>

            {showNewCreator ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCreatorName}
                    onChange={e => { setNewCreatorName(e.target.value); setCreatorError("") }}
                    placeholder="Creator name, e.g. Sofia"
                    className={FIELD_CLS}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddCreator}
                    className="px-3 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewCreator(false); setNewCreatorName(""); setCreatorError("") }}
                    className="px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {creatorError && <p className="text-red-400 text-xs">{creatorError}</p>}
                {errors.newCreator && <p className="text-red-400 text-xs">{errors.newCreator}</p>}
              </div>
            ) : (
              <select
                value={creatorId}
                onChange={e => setCreatorId(e.target.value)}
                className={FIELD_CLS}
              >
                {localCreators.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Market */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={LABEL_CLS + " mb-0"}>Market</label>
              {!showNewMarket && (
                <button
                  type="button"
                  onClick={() => setShowNewMarket(true)}
                  className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span> New market
                </button>
              )}
            </div>

            {showNewMarket ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMarketName}
                    onChange={e => { setNewMarketName(e.target.value); setMarketError("") }}
                    placeholder="e.g. UK, Canada, Australia…"
                    className={FIELD_CLS}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddMarketInline}
                    className="px-3 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewMarket(false); setNewMarketName(""); setMarketError("") }}
                    className="px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {marketError && <p className="text-red-400 text-xs">{marketError}</p>}
              </div>
            ) : (
              <select
                value={market}
                onChange={e => setMarket(e.target.value)}
                className={FIELD_CLS}
              >
                {localMarkets.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            {errors.market && <p className="text-red-400 text-xs mt-1">{errors.market}</p>}
          </div>

          {/* Status + Performance label — 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as AccountStatus)} className={FIELD_CLS}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Performance Label</label>
              <select value={performanceLabel} onChange={e => setPerformanceLabel(e.target.value as PerformanceLabel)} className={FIELD_CLS}>
                {LABEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Data source + Connection — 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Data Source</label>
              <select value={dataSource} onChange={e => setDataSource(e.target.value as DataSource)} className={FIELD_CLS}>
                <option value="instagram_api">Instagram API</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Connection</label>
              <select value={connectionStatus} onChange={e => setConnectionStatus(e.target.value as ConnectionStatus)} className={FIELD_CLS}>
                <option value="not_connected">Not connected</option>
                <option value="connected">Connected</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL_CLS}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes about this account…"
              rows={2}
              className={FIELD_CLS + " resize-none"}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              {isEdit ? "Save Changes" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
