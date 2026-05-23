"use client"

import { useState } from "react"

export default function SettingsPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setStatus(null)

    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()

    if (data.error) {
      setStatus({ type: "error", message: data.error })
    } else {
      setStatus({ type: "success", message: `Invite sent to ${email}` })
      setEmail("")
    }
    setLoading(false)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-gray-400 mt-1 text-sm">Manage access to your Agency OS workspace.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium text-sm">Invite a teammate</p>
            <p className="text-gray-500 text-xs mt-0.5">They will receive an email to set up their account</p>
          </div>
        </div>

        <form onSubmit={handleInvite} className="flex gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "Sending…" : "Send invite"}
          </button>
        </form>

        {status && (
          <p className={`mt-3 text-sm px-4 py-3 rounded-lg border ${
            status.type === "success"
              ? "text-green-400 bg-green-900/20 border-green-800"
              : "text-red-400 bg-red-900/20 border-red-800"
          }`}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  )
}
