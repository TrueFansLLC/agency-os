"use client"

import { useState, useEffect } from "react"

interface TeamMember {
  id: string
  email: string
  name: string
  allowed_pages: string[]
  created_at: string
  last_sign_in: string | null
}

const ALL_PAGES = [
  { key: "posting-planer", label: "Posting Planer" },
  { key: "content",        label: "Content Library" },
  { key: "social",         label: "Social Media" },
  { key: "tracker",        label: "Account Tracker" },
  { key: "creators",       label: "Creators" },
  { key: "ai-tools",       label: "AI Tools" },
]

export default function TeamPage() {
  const [members, setMembers]   = useState<TeamMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite]     = useState({ name: "", email: "", allowed_pages: ["posting-planer"] })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState("")

  async function load() {
    setLoading(true)
    const res  = await fetch("/api/team")
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function togglePage(member: TeamMember, page: string) {
    setSaving(member.id)
    const updated = member.allowed_pages.includes(page)
      ? member.allowed_pages.filter(p => p !== page)
      : [...member.allowed_pages, page]
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id, allowed_pages: updated }),
    })
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, allowed_pages: updated } : m))
    setSaving(null)
  }

  async function removeMember(id: string) {
    if (!confirm("Mitarbeiter wirklich entfernen?")) return
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    })
    setMembers(ms => ms.filter(m => m.id !== id))
  }

  async function handleInvite() {
    if (!invite.email.trim() || !invite.name.trim()) return
    setInviting(true)
    setInviteMsg("")
    const res  = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    })
    const data = await res.json()
    if (data.success) {
      setInviteMsg("✅ Einladung verschickt!")
      setInvite({ name: "", email: "", allowed_pages: ["posting-planer"] })
      setTimeout(() => { setInviteOpen(false); setInviteMsg(""); load() }, 1500)
    } else {
      setInviteMsg(`❌ ${data.error}`)
    }
    setInviting(false)
  }

  function toggleInvitePage(page: string) {
    setInvite(i => ({
      ...i,
      allowed_pages: i.allowed_pages.includes(page)
        ? i.allowed_pages.filter(p => p !== page)
        : [...i.allowed_pages, page],
    }))
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-900 text-white">
      <div className="px-6 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-white">Team</h1>
            <p className="text-sm text-gray-400 mt-0.5">Mitarbeiter einladen und Berechtigungen verwalten</p>
          </div>
          <button onClick={() => setInviteOpen(true)}
            className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors">
            + Mitarbeiter einladen
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-gray-500 text-sm py-10 text-center">Lädt...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-700 rounded-xl">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-400 font-medium">Noch keine Mitarbeiter eingeladen</p>
            <p className="text-sm text-gray-500 mt-1">Klick "+ Mitarbeiter einladen" um loszulegen</p>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/30">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Berechtigungen</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-32">Zuletzt aktiv</th>
                  <th className="w-12"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {members.map(member => (
                  <tr key={member.id} className="hover:bg-gray-800/20">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium text-sm">{member.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{member.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_PAGES.map(page => {
                          const active = member.allowed_pages.includes(page.key)
                          return (
                            <button key={page.key}
                              onClick={() => togglePage(member, page.key)}
                              disabled={saving === member.id}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                active
                                  ? "bg-emerald-900/50 text-emerald-300 border-emerald-700 hover:bg-red-900/30 hover:text-red-300 hover:border-red-700"
                                  : "bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700 hover:text-gray-300"
                              }`}>
                              {active ? "✓ " : "+ "}{page.label}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {member.last_sign_in
                        ? new Date(member.last_sign_in).toLocaleDateString("de-DE")
                        : "Noch nie"}
                    </td>
                    <td className="px-4 py-4">
                      <button onClick={() => removeMember(member.id)} className="text-gray-600 hover:text-red-400 transition-colors" title="Entfernen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setInviteOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Mitarbeiter einladen</h2>
              <button onClick={() => setInviteOpen(false)} className="text-gray-500 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Name</label>
                <input value={invite.name} onChange={e => setInvite(i => ({...i, name: e.target.value}))}
                  placeholder="Max Mustermann" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">E-Mail</label>
                <input type="email" value={invite.email} onChange={e => setInvite(i => ({...i, email: e.target.value}))}
                  placeholder="mitarbeiter@email.com" className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-gray-500 placeholder-gray-600"/>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-2">Berechtigungen</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PAGES.map(page => {
                    const active = invite.allowed_pages.includes(page.key)
                    return (
                      <button key={page.key} onClick={() => toggleInvitePage(page.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? "bg-emerald-900/50 text-emerald-300 border-emerald-700"
                            : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300"
                        }`}>
                        {active ? "✓ " : ""}{page.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {inviteMsg && (
                <p className={`text-sm ${inviteMsg.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>{inviteMsg}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
              <button onClick={() => setInviteOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Abbrechen</button>
              <button onClick={handleInvite} disabled={inviting || !invite.email.trim() || !invite.name.trim()}
                className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors">
                {inviting ? "Wird gesendet..." : "Einladung senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
