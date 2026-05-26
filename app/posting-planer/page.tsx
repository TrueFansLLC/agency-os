"use client"

import { useState, useEffect, useCallback } from "react"

interface Post {
  id: string
  creator: string
  account: string
  platform: string
  reel_number: number
  send_date: string
  send_time: string
  post_text: string
  caption: string
  video_link: string
  status: "geplant" | "bereit" | "gesendet" | "gepostet" | "wartet"
}

const CREATOR_ACCOUNTS: Record<string, { account: string; platform: string }[]> = {
  Cathy: [
    { account: "cathyycamping",  platform: "Instagram" },
    { account: "itscathylane",   platform: "Instagram" },
    { account: "cathysfarm",     platform: "Instagram" },
  ],
  Neyla: [
    { account: "neylasranch",      platform: "Instagram" },
    { account: "neylaspeaks",      platform: "Instagram" },
    { account: "neylaonthestreet", platform: "Instagram" },
    { account: "neylaasks",        platform: "Instagram" },
    { account: "neylaleftalone",   platform: "Instagram" },
    { account: "christianneylaa",  platform: "Instagram" },
  ],
  Romina: [
    { account: "rominahomealone",   platform: "Instagram" },
    { account: "rominaspeaks",      platform: "Instagram" },
    { account: "rominasfarm",       platform: "Instagram" },
    { account: "rominaonthestreet", platform: "Instagram" },
    { account: "domrominaa",        platform: "Instagram" },
    { account: "rominascamp",       platform: "IG + FB" },
  ],
}

const REEL_TIMES: Record<number, string> = { 1: "09:00", 2: "14:00", 3: "19:00" }
const CREATOR_COLORS: Record<string, string> = { Cathy: "bg-pink-500", Neyla: "bg-purple-500", Romina: "bg-blue-500" }
const CREATOR_TEXT: Record<string, string>   = { Cathy: "text-pink-400", Neyla: "text-purple-400", Romina: "text-blue-400" }

const STATUS_STYLE: Record<string, string> = {
  geplant:  "bg-gray-800 text-gray-400 border border-gray-700",
  bereit:   "bg-emerald-900/50 text-emerald-300 border border-emerald-700",
  gesendet: "bg-yellow-900/50 text-yellow-300 border border-yellow-700",
  gepostet: "bg-green-900/50 text-green-300 border border-green-700",
  wartet:   "bg-orange-900/50 text-orange-300 border border-orange-700",
}

function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000) }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function formatDayLabel(d: Date) { return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" }) }
function isToday(d: Date) { return toDateStr(d) === toDateStr(new Date()) }

type CreatorTab = "Alle" | "Cathy" | "Neyla" | "Romina" | "Wartend"

export default function PostingPlaner() {
  const [activeCreator, setActiveCreator] = useState<CreatorTab>("Alle")
  const [weekStart, setWeekStart] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [posts, setPosts]           = useState<Post[]>([])
  const [waitingPosts, setWaitingPosts] = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Regular calendar modal
  const [modal, setModal] = useState<{ mode:"add"|"edit"; post?: Post; account: string; creator: string; platform: string; date: string; reelNumber: number } | null>(null)
  const [form, setForm]   = useState({ post_text: "", caption: "", video_link: "", send_time: "09:00", platform: "Instagram" })

  // Wartend modals
  const [newWaitModal, setNewWaitModal]     = useState(false)
  const [activateModal, setActivateModal]   = useState<{ accounts: Post[]; placeholder: string } | null>(null)
  const [realUsername, setRealUsername]     = useState("")
  const [waitForm, setWaitForm] = useState({ creator: "Cathy", account: "", platform: "Instagram", reel_number: 1, send_date: toDateStr(new Date()), send_time: "09:00", post_text: "", caption: "", video_link: "" })

  const days    = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const fromStr = toDateStr(weekStart)
  const toStr   = toDateStr(addDays(weekStart, 6))

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const [weekRes, waitRes] = await Promise.all([
        fetch(`/api/posting-schedule?from=${fromStr}&to=${toStr}`),
        fetch(`/api/posting-schedule?status=wartet`),
      ])
      const weekData = await weekRes.json()
      const waitData = await waitRes.json()
      setPosts(Array.isArray(weekData) ? weekData : [])
      setWaitingPosts(Array.isArray(waitData) ? waitData : [])
    } finally {
      setLoading(false)
    }
  }, [fromStr, toStr])

  useEffect(() => { loadPosts() }, [loadPosts])

  const visibleAccounts =
    (activeCreator === "Alle" ? Object.keys(CREATOR_ACCOUNTS) : activeCreator === "Wartend" ? [] : [activeCreator])
      .flatMap(c => CREATOR_ACCOUNTS[c].map(a => ({ creator: c, ...a })))

  function getCellPosts(account: string, date: Date) {
    const d = toDateStr(date)
    return posts.filter(p => p.account === account && p.send_date === d && p.status !== "wartet").sort((a, b) => a.reel_number - b.reel_number)
  }

  async function toggleBereit(post: Post) {
    setTogglingId(post.id)
    const newStatus = post.status === "geplant" ? "bereit" : "geplant"
    await fetch(`/api/posting-schedule/${post.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, status: newStatus } : p))
    setTogglingId(null)
  }

  function openAdd(account: string, creator: string, platform: string, date: Date) {
    const existing  = getCellPosts(account, date)
    const usedReels = existing.map(p => p.reel_number)
    const nextReel  = [1, 2, 3].find(r => !usedReels.includes(r))
    if (!nextReel) return
    setModal({ mode: "add", account, creator, platform, date: toDateStr(date), reelNumber: nextReel })
    setForm({ post_text: "", caption: "", video_link: "", send_time: REEL_TIMES[nextReel], platform })
  }

  function openEdit(post: Post) {
    setModal({ mode: "edit", post, account: post.account, creator: post.creator, platform: post.platform, date: post.send_date, reelNumber: post.reel_number })
    setForm({ post_text: post.post_text, caption: post.caption, video_link: post.video_link, send_time: post.send_time.slice(0,5), platform: post.platform })
  }

  async function handleSave() {
    if (!modal) return
    setSaving(true)
    try {
      if (modal.mode === "add") {
        await fetch("/api/posting-schedule", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creator: modal.creator, account: modal.account, platform: form.platform, reel_number: modal.reelNumber, send_date: modal.date, send_time: form.send_time, post_text: form.post_text, caption: form.caption, video_link: form.video_link, status: "geplant" }),
        })
      } else if (modal.post) {
        await fetch(`/api/posting-schedule/${modal.post.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: form.platform, send_time: form.send_time, post_text: form.post_text, caption: form.caption, video_link: form.video_link }),
        })
      }
      setModal(null); await loadPosts()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!modal?.post) return
    setSaving(true)
    try {
      await fetch(`/api/posting-schedule/${modal.post.id}`, { method: "DELETE" })
      setModal(null); await loadPosts()
    } finally { setSaving(false) }
  }

  async function handleSaveWaiting() {
    setSaving(true)
    try {
      await fetch("/api/posting-schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...waitForm, status: "wartet" }),
      })
      setNewWaitModal(false)
      setWaitForm({ creator: "Cathy", account: "", platform: "Instagram", reel_number: 1, send_date: toDateStr(new Date()), send_time: "09:00", post_text: "", caption: "", video_link: "" })
      await loadPosts()
    } finally { setSaving(false) }
  }

  async function handleActivate() {
    if (!activateModal || !realUsername.trim()) return
    setSaving(true)
    try {
      for (const post of activateModal.accounts) {
        await fetch(`/api/posting-schedule/${post.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: realUsername.trim().replace(/^@/, ""), status: "geplant" }),
        })
      }
      setActivateModal(null); setRealUsername(""); await loadPosts()
    } finally { setSaving(false) }
  }

  // Group waiting posts by placeholder account name
  const waitingGroups = waitingPosts.reduce<Record<string, Post[]>>((acc, p) => {
    if (!acc[p.account]) acc[p.account] = []
    acc[p.account].push(p)
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Posting Planer</h1>
          <p className="text-sm text-gray-400">
            Plane Posts vor · <span className="text-emerald-400 font-medium">Bereit</span> = Bot sendet ab 19:00 · <span className="text-orange-400 font-medium">Wartend</span> = Account noch unbekannt
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["Alle", "Cathy", "Neyla", "Romina", "Wartend"] as const).map(c => (
            <button key={c} onClick={() => setActiveCreator(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
                activeCreator === c ? "bg-white text-gray-900" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              {c}
              {c === "Wartend" && Object.keys(waitingGroups).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-white text-xs flex items-center justify-center">
                  {Object.keys(waitingGroups).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── WARTEND VIEW ── */}
      {activeCreator === "Wartend" ? (
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-medium">Wartende Accounts</h2>
              <p className="text-sm text-gray-400 mt-0.5">Content für Accounts die noch keinen Username haben. Sobald der Account aktiv ist → "Aktivieren".</p>
            </div>
            <button onClick={() => setNewWaitModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors">
              + Neuer wartender Account
            </button>
          </div>

          {Object.keys(waitingGroups).length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-3">⏳</div>
              <p className="font-medium text-gray-400">Keine wartenden Accounts</p>
              <p className="text-sm mt-1">Klick "+ Neuer wartender Account" um Content für einen noch unbekannten Account vorzubereiten.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(waitingGroups).map(([placeholder, accountPosts]) => {
                const creator = accountPosts[0]?.creator ?? ""
                const sorted  = [...accountPosts].sort((a, b) => a.send_date.localeCompare(b.send_date))
                return (
                  <div key={placeholder} className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between border-b border-gray-700">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${CREATOR_COLORS[creator] ?? "bg-gray-500"}`} />
                        <div>
                          <p className="text-white font-medium">@{placeholder}</p>
                          <p className={`text-xs ${CREATOR_TEXT[creator] ?? "text-gray-400"}`}>{creator} · {accountPosts.length} Post{accountPosts.length !== 1 ? "s" : ""} vorbereitet</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setActivateModal({ accounts: accountPosts, placeholder }); setRealUsername("") }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors font-medium">
                          Account aktivieren →
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-700/50">
                      {sorted.map(post => (
                        <div key={post.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-800/40">
                          <div className="text-gray-400 text-sm w-20 shrink-0">{post.send_date}</div>
                          <div className="text-gray-400 text-xs w-12 shrink-0">R{post.reel_number}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-200 text-sm truncate">{post.post_text || <span className="text-gray-500 italic">Kein Text</span>}</p>
                            {post.caption && <p className="text-gray-500 text-xs truncate mt-0.5">{post.caption}</p>}
                          </div>
                          {post.video_link && <span className="text-xs text-blue-400 shrink-0">🎬 Video</span>}
                          <button onClick={() => { openEdit(post); setActiveCreator("Alle") }} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Bearbeiten</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Week nav + legend */}
          <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setWeekStart(d => addDays(d, -7))} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-sm text-gray-300 font-medium min-w-[220px] text-center">
                {weekStart.toLocaleDateString("de-DE", { day: "numeric", month: "long" })} – {addDays(weekStart, 6).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
              </span>
              <button onClick={() => setWeekStart(d => addDays(d, 7))} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setWeekStart(d) }} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800">Heute</button>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-600 inline-block"/>Geplant</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Bereit</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>Gesendet</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Gepostet</span>
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Lädt...</div>
            ) : (
              <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="sticky left-0 z-10 bg-gray-900 text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-44 border-r border-gray-800">Account</th>
                    {days.map(day => (
                      <th key={day.toISOString()} className={`px-3 py-3 text-center text-xs font-medium uppercase tracking-wider border-r border-gray-800 ${isToday(day) ? "bg-gray-800/50" : ""}`} style={{ minWidth: "115px" }}>
                        <div className={isToday(day) ? "text-blue-400 font-semibold" : "text-gray-400"}>{formatDayLabel(day)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleAccounts.map(({ creator, account, platform }) => (
                    <tr key={account} className="border-b border-gray-800/60 hover:bg-gray-800/10">
                      <td className="sticky left-0 z-10 bg-gray-900 px-4 py-2 border-r border-gray-800">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CREATOR_COLORS[creator]}`}/>
                          <span className="text-sm text-gray-200 font-medium truncate max-w-[120px]">@{account}</span>
                        </div>
                        {platform !== "Instagram" && <span className="text-xs text-gray-500 ml-4">{platform}</span>}
                      </td>
                      {days.map(day => {
                        const cellPosts = getCellPosts(account, day)
                        const canAdd    = cellPosts.length < 3
                        return (
                          <td key={day.toISOString()} className={`px-2 py-2 align-top border-r border-gray-800 ${isToday(day) ? "bg-gray-800/10" : ""}`}>
                            <div className="flex flex-col gap-1">
                              {cellPosts.map(post => (
                                <div key={post.id} className={`w-full rounded text-xs border ${STATUS_STYLE[post.status]}`}>
                                  <button className="w-full text-left px-2 py-1.5" onClick={() => openEdit(post)}>
                                    <div className="font-medium">R{post.reel_number} · {post.send_time.slice(0,5)}</div>
                                    {post.post_text && <div className="truncate mt-0.5 opacity-60" style={{ fontSize:"10px" }}>{post.post_text.slice(0,28)}</div>}
                                  </button>
                                  {(post.status === "geplant" || post.status === "bereit") && (
                                    <button onClick={() => toggleBereit(post)} disabled={togglingId === post.id}
                                      className={`w-full text-center py-1 border-t text-xs font-medium transition-colors ${post.status === "geplant" ? "border-gray-700 text-gray-500 hover:text-emerald-400 hover:bg-emerald-900/20" : "border-emerald-800 text-emerald-400 hover:text-gray-400 hover:bg-gray-800"}`}>
                                      {togglingId === post.id ? "..." : post.status === "geplant" ? "→ Bereit" : "✓ Bereit"}
                                    </button>
                                  )}
                                </div>
                              ))}
                              {canAdd && (
                                <button onClick={() => openAdd(account, creator, platform, day)}
                                  className="w-full text-xs text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded py-1.5 border border-dashed border-gray-800 hover:border-gray-600">
                                  + R{cellPosts.length + 1}
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── MODAL: Regular add/edit ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">{modal.mode === "add" ? "Post hinzufügen" : "Post bearbeiten"}</h2>
                <p className="text-xs text-gray-400 mt-0.5">@{modal.account} · R{modal.reelNumber} · {modal.date}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {modal.mode === "add" && (
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Reel Nummer</label>
                  <div className="flex gap-2">
                    {[1,2,3].map(r => (
                      <button key={r} onClick={() => { setModal(m => m ? {...m, reelNumber: r} : null); setForm(f => ({...f, send_time: REEL_TIMES[r]})) }}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${modal.reelNumber === r ? "bg-white text-gray-900 border-white" : "text-gray-400 border-gray-700 hover:border-gray-500"}`}>
                        R{r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Sendezeit (Info für Mitarbeiter)</label>
                <input type="time" value={form.send_time} onChange={e => setForm(f => ({...f, send_time: e.target.value}))}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500"/>
              </div>
              {modal.platform === "IG + FB" && (
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Plattform</label>
                  <select value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500">
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="IG + FB">Instagram + Facebook</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Post Text / Hook</label>
                <textarea value={form.post_text} onChange={e => setForm(f => ({...f, post_text: e.target.value}))} rows={3}
                  placeholder="Worum geht es in diesem Post?" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Caption</label>
                <textarea value={form.caption} onChange={e => setForm(f => ({...f, caption: e.target.value}))} rows={3}
                  placeholder="Caption für Instagram/Facebook..." className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Video Link</label>
                <input type="url" value={form.video_link} onChange={e => setForm(f => ({...f, video_link: e.target.value}))}
                  placeholder="https://drive.google.com/..." className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600"/>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-3">
              {modal.mode === "edit" && <button onClick={handleDelete} disabled={saving} className="text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-900/20">Löschen</button>}
              <div className="flex-1"/>
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50">
                {saving ? "Speichert..." : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Neuer wartender Account ── */}
      {newWaitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setNewWaitModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Neuer wartender Account</h2>
                <p className="text-xs text-gray-400 mt-0.5">Account Username noch unbekannt — Content trotzdem vorbereiten</p>
              </div>
              <button onClick={() => setNewWaitModal(false)} className="text-gray-500 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Creator</label>
                  <select value={waitForm.creator} onChange={e => setWaitForm(f => ({...f, creator: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500">
                    {["Cathy","Neyla","Romina"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Plattform</label>
                  <select value={waitForm.platform} onChange={e => setWaitForm(f => ({...f, platform: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500">
                    <option>Instagram</option><option>Facebook</option><option>IG + FB</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Platzhalter Name (z.B. "cathy-neues-branding")</label>
                <input value={waitForm.account} onChange={e => setWaitForm(f => ({...f, account: e.target.value}))}
                  placeholder="cathy-neues-branding-1" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600"/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Datum</label>
                  <input type="date" value={waitForm.send_date} onChange={e => setWaitForm(f => ({...f, send_date: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Reel #</label>
                  <select value={waitForm.reel_number} onChange={e => setWaitForm(f => ({...f, reel_number: Number(e.target.value), send_time: REEL_TIMES[Number(e.target.value)]}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500">
                    <option value={1}>R1</option><option value={2}>R2</option><option value={3}>R3</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Zeit</label>
                  <input type="time" value={waitForm.send_time} onChange={e => setWaitForm(f => ({...f, send_time: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Post Text / Hook</label>
                <textarea value={waitForm.post_text} onChange={e => setWaitForm(f => ({...f, post_text: e.target.value}))} rows={2}
                  placeholder="Worum geht es?" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Caption</label>
                <textarea value={waitForm.caption} onChange={e => setWaitForm(f => ({...f, caption: e.target.value}))} rows={2}
                  placeholder="Caption Text..." className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Video Link</label>
                <input type="url" value={waitForm.video_link} onChange={e => setWaitForm(f => ({...f, video_link: e.target.value}))}
                  placeholder="https://drive.google.com/..." className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600"/>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
              <button onClick={() => setNewWaitModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
              <button onClick={handleSaveWaiting} disabled={saving || !waitForm.account.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                {saving ? "Speichert..." : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Account aktivieren ── */}
      {activateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActivateModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold">Account aktivieren</h2>
              <p className="text-xs text-gray-400 mt-0.5">Platzhalter "@{activateModal.placeholder}" mit echtem Username ersetzen</p>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">
                <p className="font-medium text-white mb-2">{activateModal.accounts.length} Posts werden aktualisiert:</p>
                {activateModal.accounts.slice(0,5).map(p => (
                  <div key={p.id} className="text-xs text-gray-400">R{p.reel_number} · {p.send_date} · {p.post_text?.slice(0,40) || "–"}</div>
                ))}
                {activateModal.accounts.length > 5 && <div className="text-xs text-gray-500">+ {activateModal.accounts.length - 5} weitere...</div>}
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Echter Instagram Username</label>
                <input value={realUsername} onChange={e => setRealUsername(e.target.value.replace(/^@/, ""))}
                  placeholder="cathynewaccount (ohne @)" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-emerald-500 placeholder-gray-600"/>
              </div>
              <p className="text-xs text-gray-500">Status aller Posts wird auf <span className="text-gray-300">Geplant</span> gesetzt. Du kannst sie danach manuell auf Bereit stellen.</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
              <button onClick={() => setActivateModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
              <button onClick={handleActivate} disabled={saving || !realUsername.trim()}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                {saving ? "Aktiviert..." : "Account aktivieren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
