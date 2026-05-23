"use client"

import { useState, useEffect, useMemo } from "react"

// ── Types ─────────────────────────────────────────────────────
type Account = {
  id: string
  creator: string
  platform: string
  username: string | null
  branding: string | null
  check_status: string
  posting_active: boolean
  posting_mode: string | null
  mitarbeiter: string | null
  priority: string | null
  hinweis: string | null
  created_at: string
}

const PLATFORMS = ["Instagram", "Facebook", "TikTok", "Threads", "YouTube"]
const STATUSES  = ["Fertig", "Fehlt", "In Arbeit", "Problem"]
const MODES     = ["Manuell separat", "Crossposting"]
const PRIORITIES = ["Hoch", "Mittel", "Niedrig"]

// ── Platform visuals ──────────────────────────────────────────
const P: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Instagram: {
    color: "text-purple-400", bg: "bg-purple-900/20", border: "border-purple-800",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>,
  },
  Facebook: {
    color: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-800",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  },
  TikTok: {
    color: "text-pink-400", bg: "bg-pink-900/20", border: "border-pink-800",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.94a8.16 8.16 0 0 0 4.78 1.52V7.02a4.85 4.85 0 0 1-1.01-.33z"/></svg>,
  },
  Threads: {
    color: "text-gray-300", bg: "bg-gray-800/60", border: "border-gray-700",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>,
  },
  YouTube: {
    color: "text-red-400", bg: "bg-red-900/20", border: "border-red-800",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>,
  },
}

const S: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  Fertig:      { label: "Live",        dot: "bg-green-400", text: "text-green-400", bg: "bg-green-900/30",  border: "border-green-800" },
  Fehlt:       { label: "Missing",     dot: "bg-red-400",   text: "text-red-400",   bg: "bg-red-900/30",    border: "border-red-800" },
  "In Arbeit": { label: "In Progress", dot: "bg-blue-400",  text: "text-blue-400",  bg: "bg-blue-900/30",   border: "border-blue-800" },
  Problem:     { label: "Problem",     dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-900/30",  border: "border-amber-800" },
}

function getPlatform(p: string) {
  return P[p] ?? { color: "text-gray-400", bg: "bg-gray-800", border: "border-gray-700", icon: null }
}
function getStatus(s: string) {
  return S[s] ?? { label: s, dot: "bg-gray-400", text: "text-gray-400", bg: "bg-gray-800", border: "border-gray-700" }
}

// ── Platform overview card ────────────────────────────────────
function PlatformStat({ platform, accounts }: { platform: string; accounts: Account[] }) {
  const cfg     = getPlatform(platform)
  const total   = accounts.length
  const live    = accounts.filter(a => a.check_status === "Fertig").length
  const missing = accounts.filter(a => a.check_status === "Fehlt").length
  const problem = accounts.filter(a => a.check_status === "Problem").length

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl p-5 min-w-[150px] flex-1`}>
      <div className={`flex items-center gap-2 mb-3 ${cfg.color}`}>{cfg.icon}<span className="font-semibold text-sm">{platform}</span></div>
      <p className="text-3xl font-bold text-white mb-3">{total}</p>
      <div className="space-y-1">
        {live    > 0 && <div className="flex justify-between"><span className="text-xs text-gray-500">Live</span><span className="text-xs font-medium text-green-400">{live}</span></div>}
        {missing > 0 && <div className="flex justify-between"><span className="text-xs text-gray-500">Missing</span><span className="text-xs font-bold text-red-400">{missing}</span></div>}
        {problem > 0 && <div className="flex justify-between"><span className="text-xs text-gray-500">Problem</span><span className="text-xs font-medium text-amber-400">{problem}</span></div>}
      </div>
    </div>
  )
}

// ── Account card ──────────────────────────────────────────────
function AccountCard({ account, onClick }: { account: Account; onClick: () => void }) {
  const pc = getPlatform(account.platform)
  const sc = getStatus(account.check_status)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border rounded-xl p-4 hover:bg-gray-800/80 transition-colors ${
        account.check_status === "Fehlt" || account.check_status === "Problem"
          ? "border-red-900/50"
          : "border-gray-800"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex items-center gap-2 ${pc.color}`}>{pc.icon}<span className="text-sm font-semibold">{account.platform}</span></div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text} border ${sc.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>
          {sc.label}
        </span>
      </div>

      {account.username && (
        <p className="text-white font-medium text-sm mb-1 truncate">@{account.username}</p>
      )}
      {account.branding && (
        <p className="text-gray-400 text-xs mb-3 truncate">{account.branding}</p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
        {account.posting_active ? (
          <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/> Posting active</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-gray-600"/> No posting</span>
        )}
        {account.mitarbeiter && (
          <span className="ml-auto text-xs text-gray-500 truncate">{account.mitarbeiter}</span>
        )}
      </div>
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────
const EMPTY: Omit<Account, "id" | "created_at"> = {
  creator: "", platform: "Instagram", username: "", branding: "",
  check_status: "Fehlt", posting_active: false, posting_mode: "",
  mitarbeiter: "", priority: "Mittel", hinweis: "",
}

function Modal({
  account, creators, onClose, onSave, onDelete,
}: {
  account: Partial<Account> | null
  creators: string[]
  onClose: () => void
  onSave: (data: Omit<Account, "id" | "created_at">) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const isNew = !account?.id
  const [form, setForm] = useState<Omit<Account, "id" | "created_at">>({ ...EMPTY, ...account })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function set(field: keyof typeof form, value: unknown) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.creator || !form.platform) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{isNew ? "Add Account" : "Edit Account"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Platform */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(pl => {
                const pc = getPlatform(pl)
                const active = form.platform === pl
                return (
                  <button
                    key={pl}
                    onClick={() => set("platform", pl)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      active ? `${pc.bg} ${pc.color} ${pc.border}` : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    {pc.icon}{pl}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Creator */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Creator</label>
            <input
              list="creators-list"
              value={form.creator}
              onChange={e => set("creator", e.target.value)}
              placeholder="e.g. Romina"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <datalist id="creators-list">
              {creators.map(c => <option key={c} value={c}/>)}
            </datalist>
          </div>

          {/* Username + Branding */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Username</label>
              <input
                value={form.username ?? ""}
                onChange={e => set("username", e.target.value)}
                placeholder="@handle"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Branding / Niche</label>
              <input
                value={form.branding ?? ""}
                onChange={e => set("branding", e.target.value)}
                placeholder="e.g. Farmgirl"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>

          {/* Status + Employee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Account Status</label>
              <select
                value={form.check_status}
                onChange={e => set("check_status", e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500"
              >
                {STATUSES.map(s => <option key={s} value={s}>{getStatus(s).label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Employee</label>
              <input
                value={form.mitarbeiter ?? ""}
                onChange={e => set("mitarbeiter", e.target.value)}
                placeholder="e.g. Davide"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>

          {/* Posting active toggle */}
          <div className="flex items-center justify-between bg-gray-950 border border-gray-700 rounded-lg px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">Posting active</p>
              <p className="text-gray-500 text-xs mt-0.5">Is content being posted on this account?</p>
            </div>
            <button
              onClick={() => set("posting_active", !form.posting_active)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.posting_active ? "bg-green-500" : "bg-gray-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.posting_active ? "translate-x-5" : "translate-x-0"}`}/>
            </button>
          </div>

          {/* Posting mode */}
          {form.posting_active && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Posting Mode</label>
              <div className="flex gap-2">
                {MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => set("posting_mode", m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.posting_mode === m
                        ? "bg-white text-gray-950 border-white"
                        : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Notes</label>
            <textarea
              value={form.hinweis ?? ""}
              onChange={e => set("hinweis", e.target.value)}
              placeholder="Any notes..."
              rows={2}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3">
          {!isNew && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.creator || !form.platform}
            className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : isNew ? "Add Account" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function TrackerPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading,  setLoading]  = useState(true)
  const [creator,  setCreator]  = useState("all")
  const [modal,    setModal]    = useState<{ mode: "add" } | { mode: "edit"; account: Account } | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/creator-accounts")
    const data = await res.json()
    setAccounts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const creators  = useMemo(() => [...new Set(accounts.map(a => a.creator))].sort(), [accounts])
  const platforms = useMemo(() => [...new Set(accounts.map(a => a.platform))], [accounts])

  const filtered = useMemo(() =>
    creator === "all" ? accounts : accounts.filter(a => a.creator === creator),
    [accounts, creator]
  )

  const byCreator = useMemo(() => {
    const groups: Record<string, Account[]> = {}
    for (const a of filtered) {
      if (!groups[a.creator]) groups[a.creator] = []
      groups[a.creator].push(a)
    }
    return groups
  }, [filtered])

  async function handleSave(data: Omit<Account, "id" | "created_at">) {
    if (modal?.mode === "edit") {
      await fetch(`/api/creator-accounts/${modal.account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    } else {
      await fetch("/api/creator-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    }
    setModal(null)
    load()
  }

  async function handleDelete() {
    if (modal?.mode !== "edit") return
    await fetch(`/api/creator-accounts/${modal.account.id}`, { method: "DELETE" })
    setModal(null)
    load()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Account Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">{accounts.length} accounts across {platforms.length} platforms</p>
        </div>
        <button
          onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Account
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full"/>
        </div>
      ) : (
        <>
          {/* Platform stats */}
          {platforms.length > 0 && (
            <div className="flex gap-4 flex-wrap mb-8">
              {platforms.map(p => (
                <PlatformStat key={p} platform={p} accounts={filtered.filter(a => a.platform === p)}/>
              ))}
            </div>
          )}

          {/* Creator tabs */}
          {creators.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-8">
              {["all", ...creators].map(c => (
                <button
                  key={c}
                  onClick={() => setCreator(c)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    creator === c
                      ? "bg-white text-gray-950"
                      : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                  }`}
                >
                  {c !== "all" && (
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${creator === c ? "bg-gray-200 text-gray-900" : "bg-gray-700 text-gray-300"}`}>
                      {c[0].toUpperCase()}
                    </span>
                  )}
                  {c === "all" ? "All Creators" : c}
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {accounts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 border-dashed rounded-2xl p-20 text-center">
              <p className="text-white font-medium mb-2">No accounts yet</p>
              <p className="text-gray-500 text-sm mb-6">Add your first account to get started</p>
              <button
                onClick={() => setModal({ mode: "add" })}
                className="px-5 py-2.5 bg-white text-gray-950 font-medium rounded-lg text-sm"
              >
                Add Account
              </button>
            </div>
          ) : creator === "all" ? (
            Object.entries(byCreator).map(([c, rows]) => (
              <div key={c} className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold">{c[0]}</div>
                  <h2 className="text-white font-semibold">{c}</h2>
                  <span className="text-gray-600 text-sm">{rows.length} accounts</span>
                  {rows.filter(r => r.check_status === "Fehlt").length > 0 && (
                    <span className="text-red-400 text-sm font-medium">{rows.filter(r => r.check_status === "Fehlt").length} missing</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {rows.map(a => <AccountCard key={a.id} account={a} onClick={() => setModal({ mode: "edit", account: a })}/>)}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map(a => <AccountCard key={a.id} account={a} onClick={() => setModal({ mode: "edit", account: a })}/>)}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          account={modal.mode === "edit" ? modal.account : null}
          creators={creators}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
