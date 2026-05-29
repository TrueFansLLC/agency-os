"use client"

import { useState, useEffect, useCallback } from "react"

interface Task {
  id:          string
  title:       string
  description: string | null
  assignee:    string
  status:      "offen" | "in_arbeit" | "erledigt"
  priority:    "hoch" | "mittel" | "niedrig"
  due_date:    string | null
  created_at:  string
  created_by:  string | null
}

const PRIORITY_STYLE: Record<string, string> = {
  hoch:    "text-red-400 bg-red-900/20 border-red-800/50",
  mittel:  "text-yellow-400 bg-yellow-900/20 border-yellow-800/50",
  niedrig: "text-gray-400 bg-gray-800/50 border-gray-700",
}

const STATUS_COLS = [
  { key: "offen",    label: "Offen",    color: "text-gray-400" },
  { key: "in_arbeit", label: "In Arbeit", color: "text-indigo-400" },
  { key: "erledigt", label: "Erledigt", color: "text-green-400" },
]

export default function TasksPage() {
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [filter,  setFilter]  = useState("alle")

  const [form, setForm] = useState({
    title:       "",
    description: "",
    assignee:    "Elijah",
    priority:    "mittel",
    due_date:    "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch("/api/tasks")
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, due_date: form.due_date || null, created_by: "Dashboard" }),
    })
    setModal(false)
    setForm({ title: "", description: "", assignee: "Elijah", priority: "mittel", due_date: "" })
    setSaving(false)
    await load()
  }

  async function handleStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: status as Task["status"] } : t))
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    setTasks(ts => ts.filter(t => t.id !== id))
  }

  const assignees = [...new Set(tasks.map(t => t.assignee))].sort()
  const filtered  = filter === "alle" ? tasks : tasks.filter(t => t.assignee === filter)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tasks</h1>
          <p className="text-gray-400 mt-1 text-sm">Aufgaben für dich und dein Team</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Neuer Task
        </button>
      </div>

      {/* Assignee filter */}
      {assignees.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {["alle", ...assignees].map(a => (
            <button key={a} onClick={() => setFilter(a)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === a ? "bg-indigo-600 text-white" : "bg-gray-900 border border-gray-700 text-gray-400 hover:text-white"
              }`}>
              {a === "alle" ? "Alle" : a}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-gray-700 border-t-indigo-500 rounded-full"/>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STATUS_COLS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.key)
            return (
              <div key={col.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {colTasks.map(task => (
                    <div key={task.id} className="bg-gradient-to-br from-gray-900 to-gray-800/60 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className={`text-sm font-medium ${task.status === "erledigt" ? "text-gray-500 line-through" : "text-white"}`}>
                          {task.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${PRIORITY_STYLE[task.priority]}`}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-gray-500 text-xs mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-medium">
                            {task.assignee.charAt(0)}
                          </div>
                          <span className="text-gray-500 text-xs">{task.assignee}</span>
                          {task.due_date && (
                            <span className="text-gray-600 text-xs">· {new Date(task.due_date).toLocaleDateString("de-DE")}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {task.status !== "in_arbeit" && task.status !== "erledigt" && (
                            <button onClick={() => handleStatus(task.id, "in_arbeit")}
                              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-900/20 transition-colors">
                              → In Arbeit
                            </button>
                          )}
                          {task.status === "in_arbeit" && (
                            <button onClick={() => handleStatus(task.id, "erledigt")}
                              className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-900/20 transition-colors">
                              ✓ Erledigt
                            </button>
                          )}
                          {task.status === "erledigt" && (
                            <button onClick={() => handleStatus(task.id, "offen")}
                              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors">
                              ↺ Wieder öffnen
                            </button>
                          )}
                          <button onClick={() => handleDelete(task.id)}
                            className="text-gray-600 hover:text-red-400 p-1 rounded hover:bg-red-900/20 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border border-dashed border-gray-800 rounded-xl p-6 text-center">
                      <p className="text-gray-600 text-sm">Keine Tasks</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Neuer Task</h2>
              <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Titel</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Was muss gemacht werden?" autoFocus
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-indigo-500 placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Beschreibung (optional)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={2} placeholder="Details..."
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-indigo-500 placeholder-gray-600 resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Zuständig</label>
                  <input value={form.assignee} onChange={e => setForm(f => ({...f, assignee: e.target.value}))}
                    placeholder="Elijah"
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-indigo-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">Priorität</label>
                  <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-indigo-500">
                    <option value="hoch">Hoch</option>
                    <option value="mittel">Mittel</option>
                    <option value="niedrig">Niedrig</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Deadline (optional)</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-indigo-500"/>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                {saving ? "Speichert..." : "Task erstellen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
