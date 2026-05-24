"use client"

import { useState, useEffect, useMemo } from "react"

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
  created_at: string
}

const EMPTY: Omit<Pair, "id" | "created_at"> = {
  creator: "", branding: "",
  content_creator: "", ig_mitarbeiter: "", fb_mitarbeiter: "",
  ig_username: "", ig_status: "Fehlt", ig_posting: false, ig_link: "",
  fb_username: "", fb_status: "Fehlt", fb_posting: false, fb_link: "",
  notes: "",
}

// ── Small helpers ────────────────────────────────────────────
function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-red-500"}`} />
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <StatusDot ok={ok} />
      <span className={ok ? "text-gray-400" : "text-red-400 font-medium"}>{label}</span>
      {detail && <span className="text-gray-600 truncate max-w-[100px]">{detail}</span>}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? "bg-green-500" : "bg-gray-700"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  )
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex-1 min-w-[130px]">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-400 text-xs font-medium mt-1">{label}</p>
      {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Pair card ─────────────────────────────────────────────────
function PairCard({ pair, onClick }: { pair: Pair; onClick: () => void }) {
  const hasIssue =
    pair.ig_status === "Fehlt" || pair.fb_status === "Fehlt" ||
    !pair.ig_posting || !pair.fb_posting ||
    !pair.ig_link || !pair.fb_link

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border rounded-xl overflow-hidden hover:bg-gray-800/60 transition-colors ${hasIssue ? "border-red-900/60" : "border-gray-800"}`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-white font-semibold text-sm leading-tight">{pair.creator}</p>
          {pair.branding && <span className="text-gray-500 text-xs shrink-0">{pair.branding}</span>}
        </div>
        {pair.content_creator && (
          <div className="flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span className="text-gray-500 text-xs">Content: {pair.content_creator}</span>
          </div>
        )}
      </div>

      {/* Split: IG + FB */}
      <div className="grid grid-cols-2 divide-x divide-gray-800">
        {/* Instagram */}
        <div className="px-3 py-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-purple-400 mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
            <span className="text-xs font-semibold">Instagram</span>
          </div>
          {pair.ig_username && <p className="text-gray-400 text-xs truncate">@{pair.ig_username}</p>}
          <Row label="Account" ok={pair.ig_status === "Fertig"} />
          <Row label="Posting" ok={pair.ig_posting} />
          <Row label="Link" ok={!!pair.ig_link} detail={pair.ig_link ?? undefined} />
          {pair.ig_mitarbeiter && (
            <div className="flex items-center gap-1 text-xs text-gray-600 pt-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {pair.ig_mitarbeiter}
            </div>
          )}
        </div>

        {/* Facebook */}
        <div className="px-3 py-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-blue-400 mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
            <span className="text-xs font-semibold">Facebook</span>
          </div>
          {pair.fb_username && <p className="text-gray-400 text-xs truncate">{pair.fb_username}</p>}
          <Row label="Page" ok={pair.fb_status === "Fertig"} />
          <Row label="Posting" ok={pair.fb_posting} />
          <Row label="Link" ok={!!pair.fb_link} detail={pair.fb_link ?? undefined} />
          {pair.fb_mitarbeiter && (
            <div className="flex items-center gap-1 text-xs text-gray-600 pt-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {pair.fb_mitarbeiter}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
    />
  )
}

function Modal({ pair, creators, onClose, onSave, onDelete }: {
  pair: Pair | null
  creators: string[]
  onClose: () => void
  onSave: (data: Omit<Pair, "id" | "created_at">) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const isNew = !pair?.id
  const [form, setForm] = useState<Omit<Pair, "id" | "created_at">>({ ...EMPTY, ...pair })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.creator) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{isNew ? "Add Account Pair" : "Edit Account Pair"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Creator + Branding + Employee */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Creator">
              <input
                list="creators-list"
                value={form.creator}
                onChange={e => set("creator", e.target.value)}
                placeholder="e.g. Romina"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
              <datalist id="creators-list">{creators.map(c => <option key={c} value={c}/>)}</datalist>
            </Field>
            <Field label="Branding / Niche">
              <Input value={form.branding ?? ""} onChange={v => set("branding", v)} placeholder="e.g. Farmgirl" />
            </Field>
          </div>
          <Field label="Content Creator (who makes the content)">
            <Input value={form.content_creator ?? ""} onChange={v => set("content_creator", v)} placeholder="e.g. Romina" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Instagram Manager">
              <Input value={form.ig_mitarbeiter ?? ""} onChange={v => set("ig_mitarbeiter", v)} placeholder="e.g. Davide" />
            </Field>
            <Field label="Facebook Manager">
              <Input value={form.fb_mitarbeiter ?? ""} onChange={v => set("fb_mitarbeiter", v)} placeholder="e.g. Ilmije" />
            </Field>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800"/>

          {/* Instagram */}
          <div>
            <div className="flex items-center gap-2 text-purple-400 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
              <span className="font-semibold text-sm">Instagram Account</span>
            </div>
            <div className="space-y-4">
              <Field label="Username">
                <Input value={form.ig_username ?? ""} onChange={v => set("ig_username", v)} placeholder="@username" />
              </Field>
              <Field label="Funnel Link (link in bio)">
                <Input value={form.ig_link ?? ""} onChange={v => set("ig_link", v)} placeholder="https://..." />
              </Field>
              <div className="flex items-center justify-between">
                <Field label="Account exists">
                  <div className="flex gap-2 mt-1">
                    {["Fertig", "Fehlt", "In Arbeit"].map(s => (
                      <button key={s} type="button" onClick={() => set("ig_status", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          form.ig_status === s ? "bg-white text-gray-950 border-white" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
                        {s === "Fertig" ? "Yes" : s === "Fehlt" ? "No" : "In Progress"}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Posting active">
                  <div className="flex items-center gap-2 mt-1">
                    <Toggle value={form.ig_posting} onChange={v => set("ig_posting", v)} />
                    <span className="text-xs text-gray-500">{form.ig_posting ? "Yes" : "No"}</span>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800"/>

          {/* Facebook */}
          <div>
            <div className="flex items-center gap-2 text-blue-400 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
              <span className="font-semibold text-sm">Facebook Page</span>
            </div>
            <div className="space-y-4">
              <Field label="Page Name">
                <Input value={form.fb_username ?? ""} onChange={v => set("fb_username", v)} placeholder="Page name" />
              </Field>
              <Field label="Funnel Link (link in page)">
                <Input value={form.fb_link ?? ""} onChange={v => set("fb_link", v)} placeholder="https://..." />
              </Field>
              <div className="flex items-center justify-between">
                <Field label="Page exists">
                  <div className="flex gap-2 mt-1">
                    {["Fertig", "Fehlt", "In Arbeit"].map(s => (
                      <button key={s} type="button" onClick={() => set("fb_status", s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          form.fb_status === s ? "bg-white text-gray-950 border-white" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
                        {s === "Fertig" ? "Yes" : s === "Fehlt" ? "No" : "In Progress"}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Posting active">
                  <div className="flex items-center gap-2 mt-1">
                    <Toggle value={form.fb_posting} onChange={v => set("fb_posting", v)} />
                    <span className="text-xs text-gray-500">{form.fb_posting ? "Yes" : "No"}</span>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-gray-800 pt-4">
            <Field label="Notes">
              <textarea
                value={form.notes ?? ""}
                onChange={e => set("notes", e.target.value)}
                placeholder="Any notes..."
                rows={2}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3">
          {!isNew && onDelete && (
            <button onClick={async () => { setDeleting(true); await onDelete(); setDeleting(false) }}
              disabled={deleting}
              className="px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <div className="flex-1"/>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.creator}
            className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm disabled:opacity-50">
            {saving ? "Saving…" : isNew ? "Add" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function TrackerPage() {
  const [pairs,   setPairs]   = useState<Pair[]>([])
  const [loading, setLoading] = useState(true)
  const [creator, setCreator] = useState("all")
  const [modal,   setModal]   = useState<{ mode: "add" } | { mode: "edit"; pair: Pair } | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/creator-accounts")
    const data = await res.json()
    setPairs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const creators = useMemo(() => [...new Set(pairs.map(p => p.creator))].sort(), [pairs])
  const filtered = useMemo(() => creator === "all" ? pairs : pairs.filter(p => p.creator === creator), [pairs, creator])

  const stats = useMemo(() => ({
    total:      pairs.length,
    igLive:     pairs.filter(p => p.ig_status === "Fertig").length,
    igMissing:  pairs.filter(p => p.ig_status === "Fehlt").length,
    fbLive:     pairs.filter(p => p.fb_status === "Fertig").length,
    fbMissing:  pairs.filter(p => p.fb_status === "Fehlt").length,
    noIgLink:   pairs.filter(p => !p.ig_link).length,
    noFbLink:   pairs.filter(p => !p.fb_link).length,
    noPosting:  pairs.filter(p => !p.ig_posting || !p.fb_posting).length,
  }), [pairs])

  async function handleSave(data: Omit<Pair, "id" | "created_at">) {
    if (modal?.mode === "edit") {
      await fetch(`/api/creator-accounts/${modal.pair.id}`, {
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
    await fetch(`/api/creator-accounts/${modal.pair.id}`, { method: "DELETE" })
    setModal(null)
    load()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Account Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">{pairs.length} account pairs tracked</p>
        </div>
        <button onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Account Pair
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-white rounded-full"/>
        </div>
      ) : (
        <>
          {/* Stats */}
          {pairs.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-8">
              <StatCard label="Total Pairs"        value={stats.total}      color="text-white" />
              <StatCard label="Instagram Live"     value={stats.igLive}     color="text-purple-400" sub={stats.igMissing > 0 ? `${stats.igMissing} missing` : undefined} />
              <StatCard label="Facebook Live"      value={stats.fbLive}     color="text-blue-400"   sub={stats.fbMissing > 0 ? `${stats.fbMissing} missing` : undefined} />
              <StatCard label="Missing Links"      value={stats.noIgLink + stats.noFbLink} color={stats.noIgLink + stats.noFbLink > 0 ? "text-amber-400" : "text-green-400"} />
              <StatCard label="Not Posting"        value={stats.noPosting}  color={stats.noPosting > 0 ? "text-red-400" : "text-green-400"} />
            </div>
          )}

          {/* Creator tabs */}
          {creators.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {["all", ...creators].map(c => (
                <button key={c} onClick={() => setCreator(c)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    creator === c ? "bg-white text-gray-950" : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                  }`}>
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

          {/* Cards */}
          {pairs.length === 0 ? (
            <div className="border border-gray-800 border-dashed rounded-2xl p-20 text-center">
              <p className="text-white font-medium mb-2">No accounts yet</p>
              <p className="text-gray-500 text-sm mb-6">Click "Add Account Pair" to add your first Instagram + Facebook pair</p>
              <button onClick={() => setModal({ mode: "add" })}
                className="px-5 py-2.5 bg-white text-gray-950 font-medium rounded-lg text-sm">
                Add Account Pair
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(p => (
                <PairCard key={p.id} pair={p} onClick={() => setModal({ mode: "edit", pair: p })}/>
              ))}
            </div>
          )}
        </>
      )}

      {modal && (
        <Modal
          pair={modal.mode === "edit" ? modal.pair : null}
          creators={creators}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
