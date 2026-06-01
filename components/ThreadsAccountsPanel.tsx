"use client"

import { useState, useEffect, useCallback } from "react"
import { ThreadsAccount, ThreadsAccountStatus, ThreadsEmployeeOption, calcPostsPerDay, calcWarmupDay } from "@/types/threads"

const today = () => new Date().toISOString().slice(0, 10)

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

const CREATOR_COLOR: Record<string, string> = {
  Cathy:  "bg-pink-500",
  Neyla:  "bg-purple-500",
  Romina: "bg-blue-500",
}

const CREATORS = ["Cathy", "Neyla", "Romina"]

const EMPTY_ACCOUNT = {
  username:           "",
  creator:            "Cathy",
  branding:           "",
  mitarbeiter:        "",
  employee_id:        "",
  warmup_started_at:  today(),
  ramp_up_started_at: "",
  status:             "warmup" as ThreadsAccountStatus,
  notes:              "",
}

// ── Account Modal ─────────────────────────────────────────────────
function AccountModal({
  account, onClose, onSave, onDelete, employees,
}: {
  account: ThreadsAccount | null
  onClose: () => void
  onSave:  (data: typeof EMPTY_ACCOUNT) => Promise<void>
  onDelete?: () => Promise<void>
  employees: ThreadsEmployeeOption[]
}) {
  const isNew = !account?.id
  const [form, setForm] = useState<typeof EMPTY_ACCOUNT>({
    username:           account?.username           ?? "",
    creator:            account?.creator            ?? "Cathy",
    branding:           account?.branding           ?? "",
    mitarbeiter:        account?.mitarbeiter        ?? "",
    employee_id:        account?.employee_id        ?? "",
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
          <h2 className="text-white font-semibold">{isNew ? "Threads-Account hinzufügen" : "Threads-Account bearbeiten"}</h2>
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
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Threads-Mitarbeiter</label>
              <select value={form.employee_id} onChange={e => {
                const employee = employees.find(option => option.id === e.target.value)
                setForm(current => ({
                  ...current,
                  employee_id: e.target.value,
                  mitarbeiter: employee?.name ?? "",
                }))
              }}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500">
                <option value="">{form.mitarbeiter ? `Nicht onboarded: ${form.mitarbeiter}` : "Nicht zugewiesen"}</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.ready ? "✓ " : "⚠ "}{employee.name}
                  </option>
                ))}
              </select>
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

// ── Panel ─────────────────────────────────────────────────────────
export default function ThreadsAccountsPanel() {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([])
  const [employees, setEmployees] = useState<ThreadsEmployeeOption[]>([])
  const [loading,  setLoading]  = useState(true)
  const [accountModal, setAccountModal] = useState<{ mode: "add" } | { mode: "edit"; account: ThreadsAccount } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [accountRes, employeeRes] = await Promise.all([
      fetch("/api/threads-accounts"),
      fetch("/api/threads-employees"),
    ])
    const [ac, em] = await Promise.all([
      accountRes.json().catch(() => []),
      employeeRes.json().catch(() => []),
    ])
    setAccounts(Array.isArray(ac) ? ac : [])
    setEmployees(Array.isArray(em) ? em : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const activeAccounts = accounts.filter(a => a.status === "active")
  const warmupAccounts = accounts.filter(a => a.status === "warmup")

  async function handleSaveAccount(data: typeof EMPTY_ACCOUNT) {
    const payload = { ...data, ramp_up_started_at: data.ramp_up_started_at || null, branding: data.branding || null }
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

  return (
    <div>
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-400">
          {accounts.length} Threads-Accounts · {activeAccounts.length} aktiv · {warmupAccounts.length} Warmup
        </p>
        <button onClick={() => setAccountModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Account hinzufügen
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full"/>
        </div>
      ) : accounts.length === 0 ? (
        <div className="border border-dashed border-gray-800 rounded-xl py-20 text-center">
          <p className="text-white font-medium mb-2">Noch keine Threads-Accounts</p>
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
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(postsToday / 5) * 100}%` }}/>
                        </div>
                        <span className="text-xs text-emerald-400 font-medium">{postsToday}/5 Posts/Tag</span>
                      </div>
                      {rampDay < 5 && <span className="text-xs text-gray-500">Ramp-up Tag {rampDay}</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLOR[account.status]}`}>
                    {STATUS_LABEL[account.status]}
                  </span>
                  <button onClick={() => setAccountModal({ mode: "edit", account })}
                    className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {accountModal && (
        <AccountModal
          account={accountModal.mode === "edit" ? accountModal.account : null}
          onClose={() => setAccountModal(null)}
          onSave={handleSaveAccount}
          onDelete={accountModal.mode === "edit" ? handleDeleteAccount : undefined}
          employees={employees}
        />
      )}
    </div>
  )
}
