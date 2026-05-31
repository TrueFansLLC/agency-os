"use client"

import { useState, useEffect, useMemo } from "react"

type Employee = {
  id: string
  name: string
  devices: number
  notes: string | null
  platform: string | null
  created_at: string
}

type Pair = {
  id: string
  creator: string
  branding: string | null
  content_creator: string | null
  ig_mitarbeiter: string | null
  fb_mitarbeiter: string | null
  ig_status: string
  fb_status: string
  ig_posting: boolean
  fb_posting: boolean
  ig_link: string | null
  fb_link: string | null
  archived: boolean
  archive_reason: string | null
  archived_at: string | null
  archived_by: string | null
}

const ARCHIVE_REASONS = [
  "Wurde gebannt",
  "Hat nicht funktioniert",
  "Creator hat aufgehört",
  "Wurde ersetzt",
  "Anderer Grund",
]

const EMPTY_EMP = { name: "", devices: 0, notes: "" }

function EmpModal({ employee, onClose, onSave, onDelete }: {
  employee: Employee | null
  onClose: () => void
  onSave: (data: typeof EMPTY_EMP) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const isNew = !employee?.id
  const [form, setForm] = useState({ name: employee?.name ?? "", devices: employee?.devices ?? 0, notes: employee?.notes ?? "" })
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{isNew ? "Add Employee" : "Edit Employee"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Davide"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Number of Devices</label>
            <input type="number" min={0} value={form.devices} onChange={e => setForm(f => ({ ...f, devices: Number(e.target.value) }))}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500"/>
            {form.devices > 0 && (
              <p className="text-gray-600 text-xs mt-1">Max Instagram capacity: {form.devices * 2} accounts ({form.devices} × 2)</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              placeholder="Any notes about this employee..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3">
          {!isNew && onDelete && (
            <button onClick={async () => { await onDelete() }}
              className="px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">Delete</button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }}
            disabled={saving || !form.name}
            className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm disabled:opacity-50">
            {saving ? "Saving…" : isNew ? "Add Employee" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ArchiveModal({ pair, employeeName, onClose, onArchive }: {
  pair: Pair
  employeeName: string
  onClose: () => void
  onArchive: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState(ARCHIVE_REASONS[0])
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">Account entfernen</h2>
          <p className="text-gray-500 text-sm mt-1.5">
            <span className="text-white font-medium">{pair.creator}{pair.branding ? ` — ${pair.branding}` : ""}</span> wird in den Verlauf verschoben. Kein Datenverlust, zählt nicht mehr zur Kapazität.
          </p>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Grund</label>
          <select value={reason} onChange={e => setReason(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-500">
            {ARCHIVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
          <button
            onClick={async () => { setSaving(true); await onArchive(reason); setSaving(false) }}
            disabled={saving}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-sm disabled:opacity-50">
            {saving ? "Wird entfernt…" : "Account entfernen"}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  )
}

export default function EmployeesPage() {
  const [employees,      setEmployees]      = useState<Employee[]>([])
  const [pairs,          setPairs]          = useState<Pair[]>([])
  const [archivedPairs,  setArchivedPairs]  = useState<Pair[]>([])
  const [loading,        setLoading]        = useState(true)
  const [modal,          setModal]          = useState<{ mode: "add" } | { mode: "edit"; employee: Employee } | null>(null)
  const [selected,       setSelected]       = useState<string | null>(null)
  const [archiveTarget,  setArchiveTarget]  = useState<Pair | null>(null)
  const [platformTab,    setPlatformTab]    = useState<"ig_fb" | "threads">("ig_fb")

  const visibleEmployees = employees.filter(e => (e.platform ?? "ig_fb") === platformTab)

  async function load() {
    setLoading(true)
    const [empRes, pairRes, archRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/creator-accounts"),
      fetch("/api/creator-accounts?archived=1"),
    ])
    const [emps, prs, arch] = await Promise.all([empRes.json(), pairRes.json(), archRes.json()])
    setEmployees(Array.isArray(emps) ? emps : [])
    setPairs(Array.isArray(prs) ? prs : [])
    setArchivedPairs(Array.isArray(arch) ? arch : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function getStats(name: string) {
    const igManaged = pairs.filter(p => p.ig_mitarbeiter === name)
    const fbManaged = pairs.filter(p => p.fb_mitarbeiter === name)
    const content   = pairs.filter(p => p.content_creator === name)
    const igMissing = igManaged.filter(p => p.ig_status === "Fehlt" || !p.ig_posting || !p.ig_link).length
    const fbMissing = fbManaged.filter(p => p.fb_status === "Fehlt" || !p.fb_posting || !p.fb_link).length
    return { igManaged: igManaged.length, fbManaged: fbManaged.length, content: content.length, igMissing, fbMissing }
  }

  const selectedPairs = useMemo(() => {
    if (!selected) return []
    return pairs.filter(p =>
      p.ig_mitarbeiter === selected || p.fb_mitarbeiter === selected || p.content_creator === selected
    )
  }, [selected, pairs])

  const selectedArchived = useMemo(() => {
    if (!selected) return []
    return archivedPairs.filter(p =>
      p.ig_mitarbeiter === selected || p.fb_mitarbeiter === selected || p.content_creator === selected
    )
  }, [selected, archivedPairs])

  async function handleSave(data: typeof EMPTY_EMP) {
    if (modal?.mode === "edit") {
      await fetch(`/api/employees/${modal.employee.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })
    } else {
      await fetch("/api/employees", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, platform: platformTab }),
      })
    }
    setModal(null)
    load()
  }

  async function handleDelete() {
    if (modal?.mode !== "edit") return
    await fetch(`/api/employees/${modal.employee.id}`, { method: "DELETE" })
    setModal(null)
    load()
  }

  async function handleArchive(reason: string) {
    if (!archiveTarget || !selected) return
    await fetch(`/api/creator-accounts/${archiveTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        archived: true,
        archive_reason: reason,
        archived_at: new Date().toISOString(),
        archived_by: selected,
      }),
    })
    setArchiveTarget(null)
    load()
  }

  async function handlePermanentDelete(pair: Pair) {
    if (!confirm(`"${pair.creator}${pair.branding ? ` — ${pair.branding}` : ""}" wirklich permanent löschen? Das kann nicht rückgängig gemacht werden.`)) return
    await fetch(`/api/creator-accounts/${pair.id}`, { method: "DELETE" })
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">{visibleEmployees.length} team members</p>
        </div>
        <button onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {platformTab === "threads" ? "Add Threads Employee" : "Add Employee"}
        </button>
      </div>

      {/* Platform toggle */}
      <div className="flex gap-2 mb-6">
        {([["ig_fb", "Instagram & Facebook"], ["threads", "Threads"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setPlatformTab(key); setSelected(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              platformTab === key ? "bg-white text-gray-950" : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full"/>
        </div>
      ) : visibleEmployees.length === 0 ? (
        <div className="border border-gray-800 border-dashed rounded-2xl p-20 text-center">
          <p className="text-white font-medium mb-2">{platformTab === "threads" ? "Noch keine Threads-Mitarbeiter" : "No employees yet"}</p>
          <p className="text-gray-500 text-sm mb-6">{platformTab === "threads" ? "Füge die Mitarbeiter hinzu, die deine Threads-Accounts betreuen" : "Add your team members to track their accounts and capacity"}</p>
          <button onClick={() => setModal({ mode: "add" })} className="px-5 py-2.5 bg-white text-gray-950 font-medium rounded-lg text-sm">
            Add Employee
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee cards */}
          <div className="lg:col-span-1 space-y-3">
            {visibleEmployees.map(emp => {
              const stats    = getStats(emp.name)
              const capacity = emp.devices * 2
              const igUsed   = stats.igManaged
              const slots    = capacity - igUsed
              const isActive = selected === emp.name

              return (
                <button key={emp.id} onClick={() => setSelected(isActive ? null : emp.name)}
                  className={`w-full text-left rounded-xl border p-5 transition-colors ${isActive ? "bg-gray-800 border-gray-600" : "bg-gray-900 border-gray-800 hover:border-gray-700"}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">
                        {emp.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{emp.name}</p>
                        {emp.devices > 0 && <p className="text-gray-500 text-xs mt-0.5">{emp.devices} device{emp.devices !== 1 ? "s" : ""}</p>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setModal({ mode: "edit", employee: emp }) }}
                      className="text-gray-600 hover:text-gray-300 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <StatPill label="IG accounts managed" value={stats.igManaged} color="text-purple-400"/>
                    <StatPill label="FB accounts managed" value={stats.fbManaged} color="text-blue-400"/>
                    <StatPill label="Content created for"  value={stats.content}  color="text-gray-300"/>
                    {(stats.igMissing + stats.fbMissing) > 0 && (
                      <StatPill label="Tasks missing" value={stats.igMissing + stats.fbMissing} color="text-red-400"/>
                    )}
                  </div>

                  {emp.devices > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-700/50">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-500">IG Capacity</span>
                        <span className={slots > 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                          {igUsed}/{capacity} — {slots > 0 ? `${slots} free` : "full"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${slots <= 0 ? "bg-red-500" : slots <= 2 ? "bg-amber-400" : "bg-green-400"}`}
                          style={{ width: `${Math.min((igUsed / capacity) * 100, 100)}%` }}/>
                      </div>
                    </div>
                  )}

                  {emp.notes && <p className="text-gray-600 text-xs mt-3 line-clamp-2">{emp.notes}</p>}
                </button>
              )
            })}
          </div>

          {/* Account list for selected employee */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="border border-gray-800 border-dashed rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
                <p className="text-gray-500 text-sm">Click an employee to see their accounts</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active accounts */}
                <div>
                  <h2 className="text-white font-semibold mb-4">
                    {selected}&apos;s Accounts
                    <span className="text-gray-500 font-normal text-sm ml-2">({selectedPairs.length} active)</span>
                  </h2>
                  {selectedPairs.length === 0 ? (
                    <p className="text-gray-500 text-sm">Keine aktiven Accounts zugewiesen.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedPairs.map(p => {
                        const igOk = p.ig_status === "Fertig" && p.ig_posting && !!p.ig_link
                        const fbOk = p.fb_status === "Fertig" && p.fb_posting && !!p.fb_link
                        return (
                          <div key={p.id} className={`bg-gray-900 border rounded-xl p-4 ${!igOk || !fbOk ? "border-red-900/40" : "border-gray-800"}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <span className="text-white font-medium text-sm">{p.creator}</span>
                                {p.branding && <span className="text-gray-500 text-xs ml-2">{p.branding}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex gap-2 text-xs">
                                  {p.ig_mitarbeiter === selected && <span className="text-purple-400 bg-purple-900/20 border border-purple-800 px-2 py-0.5 rounded-full">IG Manager</span>}
                                  {p.fb_mitarbeiter === selected && <span className="text-blue-400 bg-blue-900/20 border border-blue-800 px-2 py-0.5 rounded-full">FB Manager</span>}
                                  {p.content_creator === selected && <span className="text-gray-300 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">Content</span>}
                                </div>
                                <button
                                  onClick={() => setArchiveTarget(p)}
                                  title="Account entfernen"
                                  className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="space-y-1">
                                <p className="text-purple-400 font-medium mb-1">Instagram</p>
                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${p.ig_status === "Fertig" ? "bg-green-400" : "bg-red-400"}`}/><span className="text-gray-400">Account {p.ig_status === "Fertig" ? "live" : "fehlt"}</span></div>
                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${p.ig_posting ? "bg-green-400" : "bg-red-400"}`}/><span className="text-gray-400">Posting {p.ig_posting ? "aktiv" : "inaktiv"}</span></div>
                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${p.ig_link ? "bg-green-400" : "bg-red-400"}`}/><span className="text-gray-400">Link {p.ig_link ? "gesetzt" : "fehlt"}</span></div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-blue-400 font-medium mb-1">Facebook</p>
                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${p.fb_status === "Fertig" ? "bg-green-400" : "bg-red-400"}`}/><span className="text-gray-400">Page {p.fb_status === "Fertig" ? "live" : "fehlt"}</span></div>
                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${p.fb_posting ? "bg-green-400" : "bg-red-400"}`}/><span className="text-gray-400">Posting {p.fb_posting ? "aktiv" : "inaktiv"}</span></div>
                                <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${p.fb_link ? "bg-green-400" : "bg-red-400"}`}/><span className="text-gray-400">Link {p.fb_link ? "gesetzt" : "fehlt"}</span></div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* History section */}
                {selectedArchived.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-gray-800"/>
                      <span className="text-gray-600 text-xs uppercase tracking-wider font-medium">Verlauf ({selectedArchived.length})</span>
                      <div className="h-px flex-1 bg-gray-800"/>
                    </div>
                    <div className="space-y-2">
                      {selectedArchived.map(p => (
                        <div key={p.id} className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-gray-400 font-medium text-sm">{p.creator}</span>
                              {p.branding && <span className="text-gray-600 text-xs">{p.branding}</span>}
                              {p.archive_reason && (
                                <span className="text-xs text-amber-500/80 bg-amber-900/20 border border-amber-800/30 px-2 py-0.5 rounded-full">
                                  {p.archive_reason}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {p.archived_at && (
                                <span className="text-gray-700 text-xs">
                                  {new Date(p.archived_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                </span>
                              )}
                              <button
                                onClick={() => handlePermanentDelete(p)}
                                title="Permanent löschen"
                                className="text-gray-700 hover:text-red-500 transition-colors p-1 rounded">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {modal && (
        <EmpModal
          employee={modal.mode === "edit" ? modal.employee : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
        />
      )}

      {archiveTarget && selected && (
        <ArchiveModal
          pair={archiveTarget}
          employeeName={selected}
          onClose={() => setArchiveTarget(null)}
          onArchive={handleArchive}
        />
      )}
    </div>
  )
}
