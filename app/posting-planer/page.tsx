"use client"

import { useState, useEffect, useCallback } from "react"
import { ThreadsAccount, ThreadsDailyBatch, calcPostsPerDay, getPostingTimes } from "@/types/threads"

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
    { account: "rominascamp",       platform: "Alle" },
  ],
}

const REEL_TIMES: Record<number, string> = { 1: "23:00", 2: "00:00", 3: "01:00" }
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

type CreatorTab = "Alle" | "Cathy" | "Neyla" | "Romina" | "Wartend" | "Threads"
type ReelForm = { caption: string; video_link: string; platform: string; existingId?: string; existingStatus?: string }

export default function PostingPlaner() {
  const [activeCreator, setActiveCreator] = useState<CreatorTab>("Alle")
  const [weekStart, setWeekStart] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [posts, setPosts]           = useState<Post[]>([])
  const [waitingPosts, setWaitingPosts] = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const [modal, setModal] = useState<{ account: string; creator: string; platform: string; date: string } | null>(null)
  const [reelForms, setReelForms] = useState<ReelForm[]>([
    { caption: "", video_link: "", platform: "Instagram" },
    { caption: "", video_link: "", platform: "Instagram" },
    { caption: "", video_link: "", platform: "Instagram" },
  ])

  // Wartend modals
  const [newWaitModal, setNewWaitModal]   = useState(false)
  const [activateModal, setActivateModal] = useState<{ accounts: Post[]; placeholder: string } | null>(null)
  const [realUsername, setRealUsername]   = useState("")
  const [waitForm, setWaitForm] = useState({ creator: "Cathy", account: "", platform: "Alle", reel_number: 1, send_date: toDateStr(new Date()), send_time: "09:00", caption: "", video_link: "" })

  // ── Threads state ────────────────────────────────────────────
  const [threadsAccounts, setThreadsAccounts] = useState<ThreadsAccount[]>([])
  const [threadsBatches,  setThreadsBatches]  = useState<ThreadsDailyBatch[]>([])
  const [threadsBatchModal, setThreadsBatchModal] = useState<{
    account: ThreadsAccount; date: string; existing: ThreadsDailyBatch | null
  } | null>(null)
  const [threadsBatchForm, setThreadsBatchForm] = useState({ drive_folder_url: "", posts_count: 1 })
  const [threadsSaving, setThreadsSaving] = useState(false)

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
    const res = await fetch(`/api/posting-schedule/${post.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, status: newStatus } : p))
    } else {
      const d = await res.json().catch(() => ({}))
      alert(`Fehler: ${d.error ?? "Status konnte nicht gespeichert werden"}`)
    }
    setTogglingId(null)
  }

  function openModal(account: string, creator: string, platform: string, date: Date) {
    const dateStr = toDateStr(date)
    const existing = [
      ...getCellPosts(account, date),
      ...waitingPosts.filter(p => p.account === account && p.send_date === dateStr),
    ]
    setReelForms([1, 2, 3].map(r => {
      const post = existing.find(p => p.reel_number === r)
      return post
        ? { caption: post.caption ?? "", video_link: post.video_link ?? "", platform: post.platform, existingId: post.id, existingStatus: post.status }
        : { caption: "", video_link: "", platform: "Alle" }
    }))
    setSaveError(null)
    setModal({ account, creator, platform, date: dateStr })
  }

  async function handleSave() {
    if (!modal) return
    setSaving(true)
    setSaveError(null)
    try {
      const toAdd: Post[] = []
      const toUpdate: { id: string; changes: Partial<Post> }[] = []
      for (let i = 0; i < 3; i++) {
        const rf = reelForms[i]
        const reel_number = i + 1
        const hasContent = rf.caption.trim() || rf.video_link.trim()
        if (rf.existingId) {
          const res = await fetch(`/api/posting-schedule/${rf.existingId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: rf.platform, caption: rf.caption, video_link: rf.video_link }),
          })
          if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Fehler beim Speichern"); return }
          toUpdate.push({ id: rf.existingId, changes: { platform: rf.platform, caption: rf.caption, video_link: rf.video_link } })
        } else if (hasContent) {
          const res = await fetch("/api/posting-schedule", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creator: modal.creator, account: modal.account, platform: rf.platform, reel_number, send_date: modal.date, send_time: REEL_TIMES[reel_number], caption: rf.caption, video_link: rf.video_link, status: "geplant" }),
          })
          const data = await res.json()
          if (!res.ok) { setSaveError(data.error ?? "Fehler beim Speichern"); return }
          toAdd.push(data)
        }
      }
      setPosts(ps => {
        const updated = ps.map(p => { const u = toUpdate.find(x => x.id === p.id); return u ? { ...p, ...u.changes } : p })
        return [...updated, ...toAdd]
      })
      setModal(null)
    } finally { setSaving(false) }
  }

  async function handleDeleteReel(reelIndex: number) {
    const rf = reelForms[reelIndex]
    if (!rf.existingId) {
      setReelForms(prev => prev.map((f, i) => i === reelIndex ? { ...f, caption: "", video_link: "" } : f))
      return
    }
    setSaving(true)
    try {
      await fetch(`/api/posting-schedule/${rf.existingId}`, { method: "DELETE" })
      setPosts(ps => ps.filter(p => p.id !== rf.existingId))
      setWaitingPosts(ps => ps.filter(p => p.id !== rf.existingId))
      setReelForms(prev => prev.map((f, i) => i === reelIndex ? { caption: "", video_link: "", platform: modal?.platform ?? "Instagram" } : f))
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
      setWaitForm({ creator: "Cathy", account: "", platform: "Instagram", reel_number: 1, send_date: toDateStr(new Date()), send_time: "09:00", caption: "", video_link: "" })
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

  // ── Threads load ─────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    const [accRes, batchRes] = await Promise.all([
      fetch("/api/threads-accounts"),
      fetch(`/api/threads-batches?from=${fromStr}&to=${toStr}`),
    ])
    const [accs, batches] = await Promise.all([accRes.json(), batchRes.json()])
    setThreadsAccounts(Array.isArray(accs) ? accs.filter((a: ThreadsAccount) => !a.archived) : [])
    setThreadsBatches(Array.isArray(batches) ? batches : [])
  }, [fromStr, toStr])

  useEffect(() => {
    if (activeCreator === "Threads") loadThreads()
  }, [activeCreator, loadThreads])

  function getThreadsBatch(accountId: string, date: Date) {
    return threadsBatches.find(b => b.account_id === accountId && b.date === toDateStr(date)) ?? null
  }

  function openThreadsBatchModal(account: ThreadsAccount, date: Date) {
    const existing = getThreadsBatch(account.id, date)
    const postsDefault = calcPostsPerDay(account.ramp_up_started_at)
    setThreadsBatchForm({
      drive_folder_url: existing?.drive_folder_url ?? "",
      posts_count:      existing?.posts_count      ?? postsDefault,
    })
    setThreadsBatchModal({ account, date: toDateStr(date), existing: existing ?? null })
  }

  async function handleSaveThreadsBatch() {
    if (!threadsBatchModal) return
    const { account, date, existing } = threadsBatchModal
    setThreadsSaving(true)
    try {
      if (existing) {
        const res = await fetch(`/api/threads-batches/${existing.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drive_folder_url: threadsBatchForm.drive_folder_url,
            posts_count:      threadsBatchForm.posts_count,
            images_count:     threadsBatchForm.posts_count * 2,
          }),
        })
        const updated = await res.json()
        setThreadsBatches(bs => bs.map(b => b.id === existing.id ? updated : b))
      } else {
        const res = await fetch("/api/threads-batches", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id:       account.id,
            date,
            drive_folder_url: threadsBatchForm.drive_folder_url,
            posts_count:      threadsBatchForm.posts_count,
            images_count:     threadsBatchForm.posts_count * 2,
            status:           "ready",
          }),
        })
        const created = await res.json()
        setThreadsBatches(bs => [...bs, created])
      }
      setThreadsBatchModal(null)
    } finally { setThreadsSaving(false) }
  }

  async function handleDeleteThreadsBatch() {
    if (!threadsBatchModal?.existing) return
    setThreadsSaving(true)
    try {
      await fetch(`/api/threads-batches/${threadsBatchModal.existing.id}`, { method: "DELETE" })
      setThreadsBatches(bs => bs.filter(b => b.id !== threadsBatchModal.existing!.id))
      setThreadsBatchModal(null)
    } finally { setThreadsSaving(false) }
  }

  const THREADS_BATCH_STYLE: Record<string, string> = {
    ready:   "bg-blue-900/40 text-blue-300 border-blue-700",
    sent:    "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    posted:  "bg-orange-900/40 text-orange-300 border-orange-700",
    deleted: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  }

  const THREADS_BATCH_LABEL: Record<string, string> = {
    ready: "Bereit", sent: "Gesendet", posted: "Gepostet", deleted: "Erledigt ✓",
  }

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
            Plane Posts vor · <span className="text-emerald-400 font-medium">Bereit</span> = Bot sendet ab 20:00 PH · Posts gehen live 23:00–01:00 · <span className="text-orange-400 font-medium">Wartend</span> = Account noch unbekannt
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["Alle", "Cathy", "Neyla", "Romina", "Wartend", "Threads"] as const).map(c => (
            <button key={c} onClick={() => setActiveCreator(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
                activeCreator === c
                  ? c === "Threads" ? "bg-violet-600 text-white" : "bg-white text-gray-900"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
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

      {/* ── THREADS VIEW ── */}
      {activeCreator === "Threads" ? (
        <div className="flex-1 overflow-auto">
          {/* Week nav */}
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
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Bereit</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>Gesendet</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Gepostet</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Erledigt</span>
            </div>
          </div>

          {threadsAccounts.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Keine aktiven Threads-Accounts. Accounts im Threads-Dashboard anlegen.
            </div>
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
                {threadsAccounts.map(acc => {
                  const postsPerDay = calcPostsPerDay(acc.ramp_up_started_at)
                  return (
                    <tr key={acc.id} className="border-b border-gray-800/60 hover:bg-gray-800/10">
                      <td className="sticky left-0 z-10 bg-gray-900 px-4 py-2 border-r border-gray-800">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-violet-500"/>
                          <span className="text-sm text-gray-200 font-medium truncate max-w-[100px]">@{acc.username}</span>
                        </div>
                        <div className="text-xs text-gray-500 ml-3.5 mt-0.5">{postsPerDay}×/Tag · {acc.mitarbeiter?.split(",")[0] ?? "–"}</div>
                      </td>
                      {days.map(day => {
                        const batch = getThreadsBatch(acc.id, day)
                        return (
                          <td key={day.toISOString()} className={`px-2 py-2 align-top border-r border-gray-800 ${isToday(day) ? "bg-gray-800/20" : ""}`}>
                            {batch ? (
                              <button onClick={() => openThreadsBatchModal(acc, day)}
                                className={`w-full rounded text-xs border px-2 py-1.5 text-left transition-colors hover:opacity-80 ${THREADS_BATCH_STYLE[batch.status] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
                                <div className="font-medium">{THREADS_BATCH_LABEL[batch.status] ?? batch.status}</div>
                                <div className="opacity-60 mt-0.5" style={{ fontSize:"10px" }}>{batch.posts_count} Posts · {batch.images_count} Bilder</div>
                              </button>
                            ) : (
                              <button onClick={() => openThreadsBatchModal(acc, day)}
                                className="w-full text-xs text-gray-600 hover:text-violet-300 hover:bg-violet-900/20 rounded py-1.5 border border-dashed border-gray-800 hover:border-violet-700">
                                +
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : activeCreator === "Wartend" ? (
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
                      <button onClick={() => { setActivateModal({ accounts: accountPosts, placeholder }); setRealUsername("") }}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors font-medium">
                        Account aktivieren →
                      </button>
                    </div>
                    <div className="divide-y divide-gray-700/50">
                      {sorted.map(post => (
                        <div key={post.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-800/40">
                          <div className="text-gray-400 text-sm w-20 shrink-0">{post.send_date}</div>
                          <div className="text-gray-400 text-xs w-12 shrink-0">R{post.reel_number}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-200 text-sm truncate">{post.caption || <span className="text-gray-500 italic">Keine Caption</span>}</p>
                          </div>
                          <button onClick={() => openModal(post.account, post.creator, post.platform, new Date(post.send_date + "T00:00:00"))}
                            className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Bearbeiten</button>
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
                  {visibleAccounts.map(({ creator, account, platform }) => {
                    const weekPostCount = days.reduce((n, d) => n + getCellPosts(account, d).length, 0)
                    return (
                    <tr key={account} className="border-b border-gray-800/60 hover:bg-gray-800/10">
                      <td className="sticky left-0 z-10 bg-gray-900 px-4 py-2 border-r border-gray-800">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CREATOR_COLORS[creator]}`}/>
                          <span className="text-sm text-gray-200 font-medium truncate max-w-[100px]">@{account}</span>
                          {weekPostCount > 0 && (
                            <span className="text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded-full shrink-0">
                              {weekPostCount}
                            </span>
                          )}
                        </div>
                        {platform !== "Instagram" && <span className="text-xs text-gray-500 ml-4">{platform}</span>}
                      </td>
                      {days.map(day => {
                        const cellPosts = getCellPosts(account, day)
                        const canAdd    = cellPosts.length < 3
                        return (
                          <td key={day.toISOString()} className={`px-2 py-2 align-top border-r border-gray-800 ${cellPosts.length > 0 ? "bg-emerald-950/20" : ""} ${isToday(day) ? "bg-gray-800/20" : ""}`}>
                            <div className="flex flex-col gap-1">
                              {cellPosts.map(post => (
                                <div key={post.id} className={`w-full rounded text-xs border ${STATUS_STYLE[post.status]}`}>
                                  <button className="w-full text-left px-2 py-1.5" onClick={() => openModal(account, creator, platform, day)}>
                                    <div className="font-medium">R{post.reel_number} · {post.send_time.slice(0,5)}</div>
                                    {post.caption && <div className="truncate mt-0.5 opacity-60" style={{ fontSize:"10px" }}>{post.caption.slice(0,28)}</div>}
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
                                <button onClick={() => openModal(account, creator, platform, day)}
                                  className="w-full text-xs text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded py-1.5 border border-dashed border-gray-800 hover:border-gray-600">
                                  +
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── MODAL: All reels for account + date ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-white font-semibold">@{modal.account}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{modal.date} · R1 = 23:00 · R2 = 00:00 · R3 = 01:00 Philippines</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-gray-800">
              {[0, 1, 2].map(i => {
                const rf = reelForms[i]
                const reel_number = i + 1
                const time = REEL_TIMES[reel_number]
                const isExisting = !!rf.existingId
                const hasContent = rf.caption.trim() || rf.video_link.trim()
                return (
                  <div key={i} className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isExisting ? "text-emerald-400" : "text-gray-500"}`}>R{reel_number}</span>
                        <span className="text-xs text-gray-500">{time} Uhr</span>
                        {rf.existingStatus && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_STYLE[rf.existingStatus] ?? ""}`}>
                            {rf.existingStatus}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={rf.platform}
                          onChange={e => setReelForms(prev => prev.map((f, j) => j === i ? { ...f, platform: e.target.value } : f))}
                          className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500">
                          <option value="Instagram">Instagram</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Alle">Alle</option>
                        </select>
                        {(isExisting || hasContent) && (
                          <button onClick={() => handleDeleteReel(i)} disabled={saving}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20 transition-colors">
                            Löschen
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      value={rf.caption}
                      onChange={e => setReelForms(prev => prev.map((f, j) => j === i ? { ...f, caption: e.target.value } : f))}
                      rows={3}
                      placeholder={`Caption für R${reel_number}...`}
                      className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600"
                    />
                    <input
                      type="url"
                      value={rf.video_link}
                      onChange={e => setReelForms(prev => prev.map((f, j) => j === i ? { ...f, video_link: e.target.value } : f))}
                      placeholder="Video Link (Google Drive)..."
                      className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600"
                    />
                  </div>
                )
              })}
            </div>

            {saveError && (
              <div className="mx-5 mb-2 px-3 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-xs shrink-0">
                ❌ {saveError}
              </div>
            )}
            <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-end gap-3 shrink-0">
              <button onClick={() => { setModal(null); setSaveError(null) }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
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
                    <option>Instagram</option><option>Facebook</option><option>Alle</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Platzhalter Name (z.B. "cathy-neues-branding")</label>
                <input value={waitForm.account} onChange={e => setWaitForm(f => ({...f, account: e.target.value}))}
                  placeholder="cathy-neues-branding-1" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Datum</label>
                  <input type="date" value={waitForm.send_date} onChange={e => setWaitForm(f => ({...f, send_date: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Reel #</label>
                  <select value={waitForm.reel_number} onChange={e => setWaitForm(f => ({...f, reel_number: Number(e.target.value), send_time: REEL_TIMES[Number(e.target.value)]}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500">
                    <option value={1}>R1 · 23:00</option><option value={2}>R2 · 00:00</option><option value={3}>R3 · 01:00</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Caption</label>
                <textarea value={waitForm.caption} onChange={e => setWaitForm(f => ({...f, caption: e.target.value}))} rows={3}
                  placeholder="Caption Text..." className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 resize-none placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Video Link (Google Drive)</label>
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
                  <div key={p.id} className="text-xs text-gray-400">R{p.reel_number} · {p.send_date} · {p.caption?.slice(0,40) || "–"}</div>
                ))}
                {activateModal.accounts.length > 5 && <div className="text-xs text-gray-500">+ {activateModal.accounts.length - 5} weitere...</div>}
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Echter Instagram Username</label>
                <input value={realUsername} onChange={e => setRealUsername(e.target.value.replace(/^@/, ""))}
                  placeholder="cathynewaccount (ohne @)" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-emerald-500 placeholder-gray-600"/>
              </div>
              <p className="text-xs text-gray-500">Status aller Posts wird auf <span className="text-gray-300">Geplant</span> gesetzt.</p>
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
      {/* ── MODAL: Threads Batch ── */}
      {threadsBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setThreadsBatchModal(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">@{threadsBatchModal.account.username}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{threadsBatchModal.date} · Threads Batch</p>
              </div>
              <button onClick={() => setThreadsBatchModal(null)} className="text-gray-500 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Drive Ordner Link</label>
                <input
                  type="url"
                  value={threadsBatchForm.drive_folder_url}
                  onChange={e => setThreadsBatchForm(f => ({ ...f, drive_folder_url: e.target.value }))}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-violet-500 placeholder-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Anzahl Posts</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setThreadsBatchForm(f => ({ ...f, posts_count: n }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        threadsBatchForm.posts_count === n
                          ? "bg-violet-600 border-violet-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-violet-600 hover:text-white"
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">{threadsBatchForm.posts_count * 2} Bilder benötigt im Ordner</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-400 font-medium mb-2">Posting-Zeiten (Bangkok)</p>
                <div className="flex flex-wrap gap-2">
                  {getPostingTimes(threadsBatchForm.posts_count).map(t => (
                    <span key={t} className="text-xs bg-violet-900/40 text-violet-300 border border-violet-700/50 px-2 py-1 rounded">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between">
              <div>
                {threadsBatchModal.existing && (
                  <button onClick={handleDeleteThreadsBatch} disabled={threadsSaving}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded hover:bg-red-900/20 transition-colors">
                    Löschen
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setThreadsBatchModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
                <button onClick={handleSaveThreadsBatch} disabled={threadsSaving || !threadsBatchForm.drive_folder_url.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                  {threadsSaving ? "Speichert..." : threadsBatchModal.existing ? "Aktualisieren" : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
