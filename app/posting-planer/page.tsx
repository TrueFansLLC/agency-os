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
  status: "geplant" | "bereit" | "gesendet" | "gepostet"
}

interface ModalState {
  mode: "add" | "edit"
  post?: Post
  account: string
  creator: string
  platform: string
  date: string
  reelNumber: number
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

const CREATOR_COLORS: Record<string, string> = {
  Cathy:  "bg-pink-500",
  Neyla:  "bg-purple-500",
  Romina: "bg-blue-500",
}

const STATUS_STYLE: Record<string, string> = {
  geplant:  "bg-gray-800 text-gray-400 border border-gray-700",
  bereit:   "bg-emerald-900/50 text-emerald-300 border border-emerald-700",
  gesendet: "bg-yellow-900/50 text-yellow-300 border border-yellow-700",
  gepostet: "bg-green-900/50 text-green-300 border border-green-700",
}

const STATUS_LABEL: Record<string, string> = {
  geplant:  "Geplant",
  bereit:   "Bereit",
  gesendet: "Gesendet",
  gepostet: "Gepostet",
}

function addDays(date: Date, n: number) {
  return new Date(date.getTime() + n * 86400000)
}
function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}
function formatDayLabel(date: Date) {
  return date.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })
}
function isToday(date: Date) {
  return toDateStr(date) === toDateStr(new Date())
}

export default function PostingPlaner() {
  const [activeCreator, setActiveCreator] = useState<"Alle" | "Cathy" | "Neyla" | "Romina">("Alle")
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d
  })
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState({ post_text: "", caption: "", video_link: "", send_time: "09:00", platform: "Instagram" })
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const fromStr = toDateStr(weekStart)
  const toStr   = toDateStr(addDays(weekStart, 6))

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/posting-schedule?from=${fromStr}&to=${toStr}`)
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [fromStr, toStr])

  useEffect(() => { loadPosts() }, [loadPosts])

  const visibleAccounts =
    (activeCreator === "Alle" ? Object.keys(CREATOR_ACCOUNTS) : [activeCreator])
      .flatMap(c => CREATOR_ACCOUNTS[c].map(a => ({ creator: c, ...a })))

  function getCellPosts(account: string, date: Date) {
    const d = toDateStr(date)
    return posts.filter(p => p.account === account && p.send_date === d).sort((a, b) => a.reel_number - b.reel_number)
  }

  async function toggleBereit(post: Post) {
    setTogglingId(post.id)
    const newStatus = post.status === "geplant" ? "bereit" : "geplant"
    await fetch(`/api/posting-schedule/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, status: newStatus } : p))
    setTogglingId(null)
  }

  function openAdd(account: string, creator: string, platform: string, date: Date) {
    const existing = getCellPosts(account, date)
    const usedReels = existing.map(p => p.reel_number)
    const nextReel = [1, 2, 3].find(r => !usedReels.includes(r))
    if (!nextReel) return
    setModal({ mode: "add", account, creator, platform, date: toDateStr(date), reelNumber: nextReel })
    setForm({ post_text: "", caption: "", video_link: "", send_time: REEL_TIMES[nextReel], platform })
  }

  function openEdit(post: Post) {
    setModal({ mode: "edit", post, account: post.account, creator: post.creator, platform: post.platform, date: post.send_date, reelNumber: post.reel_number })
    setForm({ post_text: post.post_text, caption: post.caption, video_link: post.video_link, send_time: post.send_time.slice(0, 5), platform: post.platform })
  }

  async function handleSave() {
    if (!modal) return
    setSaving(true)
    try {
      if (modal.mode === "add") {
        await fetch("/api/posting-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creator: modal.creator, account: modal.account, platform: form.platform,
            reel_number: modal.reelNumber, send_date: modal.date, send_time: form.send_time,
            post_text: form.post_text, caption: form.caption, video_link: form.video_link,
            status: "geplant",
          }),
        })
      } else if (modal.post) {
        await fetch(`/api/posting-schedule/${modal.post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: form.platform, send_time: form.send_time, post_text: form.post_text, caption: form.caption, video_link: form.video_link }),
        })
      }
      setModal(null)
      await loadPosts()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!modal?.post) return
    setSaving(true)
    try {
      await fetch(`/api/posting-schedule/${modal.post.id}`, { method: "DELETE" })
      setModal(null)
      await loadPosts()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Posting Planer</h1>
          <p className="text-sm text-gray-400">Plane Posts vor · markiere sie als <span className="text-emerald-400 font-medium">Bereit</span> wenn der Content fertig ist</p>
        </div>
        <div className="flex gap-1.5">
          {(["Alle", "Cathy", "Neyla", "Romina"] as const).map(c => (
            <button key={c} onClick={() => setActiveCreator(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeCreator === c ? "bg-white text-gray-900" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Status legend + week nav */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setWeekStart(d => addDays(d, -7))} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="text-sm text-gray-300 font-medium min-w-[220px] text-center">
            {weekStart.toLocaleDateString("de-DE", { day: "numeric", month: "long" })} – {addDays(weekStart, 6).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setWeekStart(d) }} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800">
            Heute
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-600 inline-block"/> Geplant</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> Bereit</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/> Gesendet</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/> Gepostet</span>
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
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CREATOR_COLORS[creator]}`} />
                      <span className="text-sm text-gray-200 font-medium truncate max-w-[120px]">@{account}</span>
                    </div>
                    {platform !== "Instagram" && <span className="text-xs text-gray-500 ml-4">{platform}</span>}
                  </td>
                  {days.map(day => {
                    const cellPosts = getCellPosts(account, day)
                    const canAdd = cellPosts.length < 3
                    return (
                      <td key={day.toISOString()} className={`px-2 py-2 align-top border-r border-gray-800 ${isToday(day) ? "bg-gray-800/10" : ""}`}>
                        <div className="flex flex-col gap-1">
                          {cellPosts.map(post => (
                            <div key={post.id} className={`w-full rounded text-xs border transition-colors ${STATUS_STYLE[post.status]}`}>
                              <button className="w-full text-left px-2 py-1.5" onClick={() => openEdit(post)}>
                                <div className="font-medium">R{post.reel_number} · {post.send_time.slice(0,5)}</div>
                                {post.post_text && (
                                  <div className="truncate mt-0.5 opacity-60" style={{ fontSize: "10px" }}>{post.post_text.slice(0, 28)}</div>
                                )}
                              </button>
                              {/* Only show toggle for geplant/bereit */}
                              {(post.status === "geplant" || post.status === "bereit") && (
                                <button
                                  onClick={() => toggleBereit(post)}
                                  disabled={togglingId === post.id}
                                  className={`w-full text-center py-1 border-t text-xs font-medium transition-colors ${
                                    post.status === "geplant"
                                      ? "border-gray-700 text-gray-500 hover:text-emerald-400 hover:bg-emerald-900/20"
                                      : "border-emerald-800 text-emerald-400 hover:text-gray-400 hover:bg-gray-800"
                                  }`}
                                >
                                  {togglingId === post.id ? "..." : post.status === "geplant" ? "→ Bereit" : "✓ Bereit"}
                                </button>
                              )}
                            </div>
                          ))}
                          {canAdd && (
                            <button onClick={() => openAdd(account, creator, platform, day)}
                              className="w-full text-xs text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded py-1.5 transition-colors border border-dashed border-gray-800 hover:border-gray-600">
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

      {/* Modal */}
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
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Sendezeit</label>
                <input type="time" value={form.send_time} onChange={e => setForm(f => ({...f, send_time: e.target.value}))}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500" />
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
                  placeholder="Worum geht es in diesem Post?" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Caption</label>
                <textarea value={form.caption} onChange={e => setForm(f => ({...f, caption: e.target.value}))} rows={3}
                  placeholder="Caption für Instagram/Facebook..." className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Video Link</label>
                <input type="url" value={form.video_link} onChange={e => setForm(f => ({...f, video_link: e.target.value}))}
                  placeholder="https://drive.google.com/..." className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-3">
              {modal.mode === "edit" && (
                <button onClick={handleDelete} disabled={saving} className="text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-900/20">Löschen</button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50">
                {saving ? "Speichert..." : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
