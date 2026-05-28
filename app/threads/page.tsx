"use client"

import { useState, useEffect, useCallback } from "react"
import { ThreadsAccount, ThreadsDailyBatch, ThreadsAccountStatus, calcPostsPerDay, calcWarmupDay, getPostingTimes } from "@/types/threads"

// ── Helpers ───────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

function toDisplayDate(d: Date) {
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

const STATUS_LABEL: Record<ThreadsAccountStatus, string> = {
  warmup: "Warmup",
  active: "Aktiv",
  paused: "Pausiert",
  banned: "Gesperrt",
}

const STATUS_COLOR: Record<ThreadsAccountStatus, string> = {
  warmup: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  active: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  paused: "bg-gray-800 text-gray-400 border-gray-700",
  banned: "bg-red-900/40 text-red-300 border-red-800",
}

const BATCH_STATUS_LABEL: Record<string, string> = {
  ready:   "Bereit",
  sent:    "Gesendet",
  posted:  "Gepostet",
  deleted: "Erledigt ✓",
}

const BATCH_STATUS_COLOR: Record<string, string> = {
  ready:   "text-blue-300 bg-blue-900/30 border-blue-700",
  sent:    "text-yellow-300 bg-yellow-900/30 border-yellow-700",
  posted:  "text-orange-300 bg-orange-900/30 border-orange-700",
  deleted: "text-emerald-300 bg-emerald-900/30 border-emerald-700",
}

const CREATOR_COLOR: Record<string, string> = {
  Cathy:  "bg-pink-500",
  Neyla:  "bg-purple-500",
  Romina: "bg-blue-500",
}

const CREATORS = ["Cathy", "Neyla", "Romina"]

// ── Empty forms ───────────────────────────────────────────────────

const EMPTY_ACCOUNT = {
  username:           "",
  creator:            "Cathy",
  branding:           "",
  mitarbeiter:        "",
  warmup_started_at:  today(),
  ramp_up_started_at: "",
  status:             "warmup" as ThreadsAccountStatus,
  notes:              "",
}

// ── Account Modal ─────────────────────────────────────────────────

function AccountModal({
  account,
  onClose,
  onSave,
  onDelete,
}: {
  account: ThreadsAccount | null
  onClose: () => void
  onSave:  (data: typeof EMPTY_ACCOUNT) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const isNew = !account?.id
  const [form, setForm] = useState<typeof EMPTY_ACCOUNT>({
    username:           account?.username           ?? "",
    creator:            account?.creator            ?? "Cathy",
    branding:           account?.branding           ?? "",
    mitarbeiter:        account?.mitarbeiter        ?? "",
    warmup_started_at:  account?.warmup_started_at  ?? today(),
    ramp_up_started_at: account?.ramp_up_started_at ?? "",
    status:             account?.status             ?? "warmup",
    notes:              account?.notes              ?? "",
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof EMPTY_ACCOUNT, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">{isNew ? "Account hinzufügen" : "Account bearbeiten"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Username (ohne @)</label>
              <input value={form.username} onChange={e => set("username", e.target.value.replace(/^@/, ""))}
                placeholder="cathyycamping"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Creator</label>
              <select value={form.creator} onChange={e => set("creator", e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500">
                {CREATORS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Branding</label>
              <input value={form.branding} onChange={e => set("branding", e.target.value)}
                placeholder="Camping, Farm, ..."
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Mitarbeiter</label>
              <input value={form.mitarbeiter} onChange={e => set("mitarbeiter", e.target.value)}
                placeholder="Name des VA"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Warmup gestartet</label>
              <input type="date" value={form.warmup_started_at} onChange={e => set("warmup_started_at", e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value as ThreadsAccountStatus)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500">
                <option value="warmup">Warmup</option>
                <option value="active">Aktiv</option>
                <option value="paused">Pausiert</option>
                <option value="banned">Gesperrt</option>
              </select>
            </div>
          </div>

          {form.status === "active" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Erster Threads Post (Ramp-up Start)
              </label>
              <input type="date" value={form.ramp_up_started_at} onChange={e => set("ramp_up_started_at", e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500"/>
              {form.ramp_up_started_at && (
                <p className="text-xs text-gray-500 mt-1">
                  → Heute: <span className="text-white font-medium">{calcPostsPerDay(form.ramp_up_started_at)} Posts/Tag</span>
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Notizen</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
              placeholder="Optionale Notizen..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"/>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3">
          {!isNew && onDelete && (
            <button onClick={async () => { setSaving(true); await onDelete(); setSaving(false) }}
              disabled={saving}
              className="px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
              Löschen
            </button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
          <button
            onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }}
            disabled={saving || !form.username.trim()}
            className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm disabled:opacity-50">
            {saving ? "Speichert..." : isNew ? "Hinzufügen" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Batch Modal ───────────────────────────────────────────────────

function BatchModal({
  account,
  existingBatch,
  onClose,
  onSave,
}: {
  account:       ThreadsAccount
  existingBatch: ThreadsDailyBatch | null
  onClose:       () => void
  onSave:        (data: { drive_folder_url: string; posts_count: number; date: string }) => Promise<void>
}) {
  const postsDefault = calcPostsPerDay(account.ramp_up_started_at)
  const [form, setForm] = useState({
    drive_folder_url: existingBatch?.drive_folder_url ?? "",
    posts_count:      existingBatch?.posts_count      ?? postsDefault,
    date:             existingBatch?.date             ?? today(),
  })
  const [saving, setSaving] = useState(false)
  const times = getPostingTimes(form.posts_count)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">{existingBatch ? "Ordner bearbeiten" : "Ordner zuweisen"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">@{account.username} · {account.creator}{account.branding ? ` · ${account.branding}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Google Drive Ordner Link</label>
            <input
              type="url"
              value={form.drive_folder_url}
              onChange={e => setForm(f => ({ ...f, drive_folder_url: e.target.value }))}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Datum</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Posts heute</label>
              <select value={form.posts_count} onChange={e => setForm(f => ({ ...f, posts_count: Number(e.target.value) }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500">
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Post{n > 1 ? "s" : ""} ({n * 2} Bilder)</option>)}
              </select>
            </div>
          </div>

          <div className="bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-700">
            <p className="text-xs text-gray-400 font-medium mb-2">Posting-Plan für heute</p>
            <div className="flex flex-wrap gap-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span className="w-5 h-5 rounded-full bg-gray-700 text-gray-300 flex items-center justify-center font-medium text-xs">{i+1}</span>
                  <span className="text-white font-medium">{t}</span>
                  <span className="text-gray-500">· 2 Bilder</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Gesammt: <span className="text-white">{form.posts_count * 2} Bilder</span> · min. 1h Abstand</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
          <button
            onClick={async () => { setSaving(true); await onSave({ ...form }); setSaving(false) }}
            disabled={saving || !form.drive_folder_url.trim()}
            className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm disabled:opacity-50">
            {saving ? "Speichert..." : existingBatch ? "Aktualisieren" : "Zuweisen"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────

export default function ThreadsPage() {
  const [tab,      setTab]      = useState<"accounts" | "heute">("heute")
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([])
  const [batches,  setBatches]  = useState<ThreadsDailyBatch[]>([])
  const [loading,  setLoading]  = useState(true)

  const [accountModal,  setAccountModal]  = useState<{ mode: "add" } | { mode: "edit"; account: ThreadsAccount } | null>(null)
  const [batchModal,    setBatchModal]    = useState<{ account: ThreadsAccount; existing: ThreadsDailyBatch | null } | null>(null)
  const [dispatching,   setDispatching]  = useState(false)
  const [dispatchMsg,   setDispatchMsg]  = useState<string | null>(null)

  const todayStr = today()

  const load = useCallback(async () => {
    setLoading(true)
    const [acRes, batchRes] = await Promise.all([
      fetch("/api/threads-accounts"),
      fetch(`/api/threads-batches?date=${todayStr}`),
    ])
    const [ac, ba] = await Promise.all([acRes.json(), batchRes.json()])
    setAccounts(Array.isArray(ac) ? ac : [])
    setBatches(Array.isArray(ba) ? ba : [])
    setLoading(false)
  }, [todayStr])

  useEffect(() => { load() }, [load])

  // ── Stats ──────────────────────────────────────────────────────
  const activeAccounts  = accounts.filter(a => a.status === "active")
  const warmupAccounts  = accounts.filter(a => a.status === "warmup")
  const todayBatches    = batches.filter(b => b.date === todayStr)
  const pendingToday    = activeAccounts.filter(a => !todayBatches.find(b => b.account_id === a.id))
  const doneToday       = todayBatches.filter(b => b.status === "deleted").length

  // ── Handlers ──────────────────────────────────────────────────

  async function handleSaveAccount(data: typeof EMPTY_ACCOUNT) {
    const payload = {
      ...data,
      ramp_up_started_at: data.ramp_up_started_at || null,
      branding:           data.branding || null,
    }
    if (accountModal?.mode === "edit") {
      await fetch(`/api/threads-accounts/${accountModal.account.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
    } else {
      await fetch("/api/threads-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
    }
    setAccountModal(null)
    load()
  }

  async function handleDeleteAccount() {
    if (accountModal?.mode !== "edit") return
    await fetch(`/api/threads-accounts/${accountModal.account.id}`, { method: "DELETE" })
    setAccountModal(null)
    load()
  }

  async function handleSaveBatch(data: { drive_folder_url: string; posts_count: number; date: string }) {
    if (!batchModal) return
    const account = batchModal.account

    if (batchModal.existing) {
      await fetch(`/api/threads-batches/${batchModal.existing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drive_folder_url: data.drive_folder_url, posts_count: data.posts_count, images_count: data.posts_count * 2 }),
      })
    } else {
      await fetch("/api/threads-batches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id:       account.id,
          date:             data.date,
          drive_folder_url: data.drive_folder_url,
          posts_count:      data.posts_count,
          images_count:     data.posts_count * 2,
          status:           "ready",
        }),
      })
    }
    setBatchModal(null)
    load()
  }

  async function handleDispatchAll() {
    setDispatching(true)
    setDispatchMsg(null)
    const res  = await fetch(`/api/cron/dispatch-threads`, {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}` },
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setDispatchMsg(`✅ ${data.dispatched ?? 0} Batch${data.dispatched !== 1 ? "es" : ""} per Telegram gesendet`)
    } else {
      setDispatchMsg(`❌ ${data.error ?? "Dispatch fehlgeschlagen"}`)
    }
    setDispatching(false)
    load()
  }

  async function handleDispatchSingle(batchId: string) {
    const res  = await fetch(`/api/cron/dispatch-threads`, {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}` },
    })
    if (res.ok) load()
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Threads</h1>
          <p className="text-gray-500 text-sm mt-1">
            {accounts.length} Accounts · {activeAccounts.length} aktiv · {warmupAccounts.length} Warmup
          </p>
        </div>
        <button
          onClick={() => setAccountModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Account hinzufügen
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Aktive Accounts",  value: activeAccounts.length,  color: "text-emerald-400" },
          { label: "Im Warmup",        value: warmupAccounts.length,  color: "text-yellow-400"  },
          { label: "Heute noch offen", value: pendingToday.length,    color: "text-orange-400"  },
          { label: "Heute erledigt",   value: doneToday,              color: "text-blue-400"    },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {(["heute", "accounts"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-950" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}>
            {t === "heute" ? `Heute (${todayBatches.length}/${activeAccounts.length})` : "Accounts"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full"/>
        </div>
      ) : tab === "heute" ? (
        // ── HEUTE TAB ──────────────────────────────────────────
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">{toDisplayDate(new Date())}</p>
            <div className="flex items-center gap-3">
              {dispatchMsg && (
                <span className="text-sm text-gray-300">{dispatchMsg}</span>
              )}
              <button
                onClick={handleDispatchAll}
                disabled={dispatching || todayBatches.filter(b => b.status === "ready").length === 0}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                {dispatching ? "Sendet..." : `📤 Alle senden (${todayBatches.filter(b => b.status === "ready").length})`}
              </button>
            </div>
          </div>

          {activeAccounts.length === 0 ? (
            <div className="border border-dashed border-gray-800 rounded-xl py-16 text-center">
              <p className="text-gray-500 text-sm">Keine aktiven Accounts. Accounts hinzufügen und auf "Aktiv" setzen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAccounts.map(account => {
                const batch       = todayBatches.find(b => b.account_id === account.id) ?? null
                const postsToday  = calcPostsPerDay(account.ramp_up_started_at)
                const times       = getPostingTimes(postsToday)

                return (
                  <div key={account.id} className={`bg-gray-900 border rounded-xl p-5 ${batch ? "border-gray-800" : "border-orange-900/40"}`}>
                    <div className="flex items-center gap-4">
                      {/* Left: account info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${CREATOR_COLOR[account.creator] ?? "bg-gray-500"}`}/>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">@{account.username}</span>
                            <span className="text-gray-500 text-xs">{account.creator}{account.branding ? ` · ${account.branding}` : ""}</span>
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">{account.mitarbeiter ?? "Kein Mitarbeiter"} · {postsToday} Posts/Tag · {postsToday * 2} Bilder</p>
                        </div>
                      </div>

                      {/* Middle: times or no-batch warning */}
                      <div className="hidden md:flex items-center gap-2 shrink-0">
                        {batch ? (
                          times.map((t, i) => (
                            <span key={i} className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{t}</span>
                          ))
                        ) : (
                          <span className="text-xs text-orange-400 bg-orange-900/20 border border-orange-800/40 px-2 py-0.5 rounded">
                            ⚠️ Kein Ordner
                          </span>
                        )}
                      </div>

                      {/* Right: status + actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        {batch ? (
                          <>
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${BATCH_STATUS_COLOR[batch.status]}`}>
                              {BATCH_STATUS_LABEL[batch.status]}
                            </span>
                            {batch.drive_folder_url && (
                              <a href={batch.drive_folder_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-900/20 transition-colors">
                                Drive öffnen ↗
                              </a>
                            )}
                            {batch.status === "ready" && (
                              <button
                                onClick={() => setBatchModal({ account, existing: batch })}
                                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800">
                                Bearbeiten
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => setBatchModal({ account, existing: null })}
                            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors">
                            + Ordner zuweisen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Batch progress if exists */}
                    {batch && (
                      <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-6 text-xs text-gray-500">
                        <span className={batch.dispatched_at ? "text-emerald-400" : ""}>
                          {batch.dispatched_at ? "✓ Gesendet" : "○ Ausstehend"}
                        </span>
                        <span className={batch.posted_confirmed_at ? "text-emerald-400" : ""}>
                          {batch.posted_confirmed_at ? "✓ Gepostet" : "○ Nicht gepostet"}
                        </span>
                        <span className={batch.deletion_confirmed_at ? "text-emerald-400" : ""}>
                          {batch.deletion_confirmed_at ? "✓ Bilder gelöscht" : "○ Bilder ausstehend"}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        // ── ACCOUNTS TAB ───────────────────────────────────────
        <div>
          {accounts.length === 0 ? (
            <div className="border border-dashed border-gray-800 rounded-xl py-20 text-center">
              <p className="text-white font-medium mb-2">Noch keine Threads Accounts</p>
              <p className="text-gray-500 text-sm mb-6">Füge deinen ersten Account hinzu um zu starten</p>
              <button onClick={() => setAccountModal({ mode: "add" })}
                className="px-5 py-2.5 bg-white text-gray-950 font-medium rounded-lg text-sm">
                Account hinzufügen
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(account => {
                const warmupDay  = calcWarmupDay(account.warmup_started_at)
                const postsToday = account.status === "active" ? calcPostsPerDay(account.ramp_up_started_at) : 0
                const rampDay    = account.ramp_up_started_at ? calcPostsPerDay(account.ramp_up_started_at) : 0

                return (
                  <div key={account.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-gray-700 transition-colors">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${CREATOR_COLOR[account.creator] ?? "bg-gray-500"}`}/>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">@{account.username}</span>
                        <span className="text-gray-500 text-xs">{account.creator}{account.branding ? ` · ${account.branding}` : ""}</span>
                        {account.mitarbeiter && (
                          <span className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">{account.mitarbeiter}</span>
                        )}
                      </div>

                      {account.status === "warmup" && (
                        <p className="text-xs text-yellow-400 mt-1">Warmup Tag {warmupDay} — noch nicht aktiv</p>
                      )}

                      {account.status === "active" && (
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${(postsToday / 5) * 100}%` }}/>
                            </div>
                            <span className="text-xs text-emerald-400 font-medium">{postsToday}/5 Posts/Tag</span>
                          </div>
                          {rampDay < 5 && (
                            <span className="text-xs text-gray-500">Ramp-up Tag {rampDay}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLOR[account.status]}`}>
                        {STATUS_LABEL[account.status]}
                      </span>
                      <button
                        onClick={() => setAccountModal({ mode: "edit", account })}
                        className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {accountModal && (
        <AccountModal
          account={accountModal.mode === "edit" ? accountModal.account : null}
          onClose={() => setAccountModal(null)}
          onSave={handleSaveAccount}
          onDelete={accountModal.mode === "edit" ? handleDeleteAccount : undefined}
        />
      )}

      {batchModal && (
        <BatchModal
          account={batchModal.account}
          existingBatch={batchModal.existing}
          onClose={() => setBatchModal(null)}
          onSave={handleSaveBatch}
        />
      )}
    </div>
  )
}
