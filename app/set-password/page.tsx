"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createAuthClient, hasAuthConfig } from "@/lib/supabase/auth-browser"

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.")
      return
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.")
      return
    }

    setLoading(true)
    if (!hasAuthConfig()) {
      setError("Supabase ist lokal noch nicht konfiguriert.")
      setLoading(false)
      return
    }

    const supabase = createAuthClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Passwort erstellen</h1>
          <p className="text-gray-500 text-sm mt-2">Wähle ein Passwort für deinen Account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Passwort bestätigen
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Nochmal eingeben"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full bg-white hover:bg-gray-100 text-gray-950 font-medium py-3 rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? "Wird gespeichert…" : "Passwort speichern & einloggen"}
          </button>
        </form>
      </div>
    </div>
  )
}
