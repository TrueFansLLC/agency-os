"use client"

import { useState, useEffect, useCallback } from "react"

type AccountPair = {
  id: string
  ig_username: string | null
  fb_username: string | null
  ig_mitarbeiter: string | null
  fb_mitarbeiter: string | null
  status: "active" | "restricted" | "banned"
  status_since: string | null
  status_note: string | null
}

const STATUS_CONFIG = {
  active:     { icon: "🟢", label: "Active",     bg: "bg-green-900/30",  text: "text-green-300",  border: "border-green-800" },
  restricted: { icon: "🟠", label: "Restricted", bg: "bg-orange-900/30", text: "text-orange-300", border: "border-orange-800" },
  banned:     { icon: "🔴", label: "Banned",      bg: "bg-red-900/30",   text: "text-red-300",    border: "border-red-800" },
}

type Filter = "all" | "active" | "restricted" | "banned"

export default function AccountStatusPage() {
  const [accounts, setAccounts] = useState<AccountPair[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>("all")
  const [reactivating, setReactivating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/account-status")
    const data = await res.json()
    setAccounts(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function reactivate(id: string) {
    setReactivating(id)
    await fetch("/api/account-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    await load()
    setReactivating(null)
  }

  const filtered = accounts.filter(a => filter === "all" || a.status === filter)

  const counts = {
    all:        accounts.length,
    active:     accounts.filter(a => a.status === "active").length,
    restricted: accounts.filter(a => a.status === "restricted").length,
    banned:     accounts.filter(a => a.status === "banned").length,
  }

  function timeSince(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    return "just now"
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Account Status</h1>
        <p className="text-gray-400 text-sm mt-1">Monitor and reactivate creator accounts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(["all", "active", "restricted", "banned"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-xl p-4 border text-left transition-all ${
              filter === f ? "border-gray-500 bg-gray-800" : "border-gray-800 bg-gray-900 hover:border-gray-700"
            }`}>
            <div className="text-2xl font-bold text-white">{counts[f]}</div>
            <div className="text-xs text-gray-400 capitalize mt-0.5">
              {f === "all" ? "Total Accounts" : STATUS_CONFIG[f].icon + " " + STATUS_CONFIG[f].label}
            </div>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500 text-sm">No accounts found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(acc => {
            const cfg = STATUS_CONFIG[acc.status] ?? STATUS_CONFIG.active
            const isIssue = acc.status !== "active"

            return (
              <div key={acc.id}
                className={`rounded-xl border p-4 flex items-center gap-4 ${
                  isIssue ? `${cfg.bg} ${cfg.border}` : "bg-gray-900 border-gray-800"
                }`}>

                {/* Status badge */}
                <div className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  {cfg.icon} {cfg.label}
                </div>

                {/* Account names */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    {acc.ig_username && (
                      <span className="text-white font-medium text-sm">@{acc.ig_username}</span>
                    )}
                    {acc.fb_username && acc.fb_username !== acc.ig_username && (
                      <span className="text-gray-400 text-sm">{acc.fb_username}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {acc.ig_mitarbeiter && (
                      <span className="text-gray-500 text-xs">IG: {acc.ig_mitarbeiter}</span>
                    )}
                    {acc.fb_mitarbeiter && (
                      <span className="text-gray-500 text-xs">FB: {acc.fb_mitarbeiter}</span>
                    )}
                    {acc.status_since && (
                      <span className={`text-xs ${cfg.text}`}>{timeSince(acc.status_since)}</span>
                    )}
                    {acc.status_note && (
                      <span className="text-gray-500 text-xs italic">{acc.status_note}</span>
                    )}
                  </div>
                </div>

                {/* Reactivate button */}
                {isIssue && (
                  <button
                    onClick={() => reactivate(acc.id)}
                    disabled={reactivating === acc.id}
                    className="shrink-0 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                    {reactivating === acc.id ? "..." : "🟢 Reactivate"}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
