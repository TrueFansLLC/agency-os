"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createAuthClient, hasAuthConfig } from "@/lib/supabase/auth-browser"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
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
    if (!hasAuthConfig()) {
      setError("Supabase ist lokal noch nicht konfiguriert.")
      return
    }

    setLoading(true)

    // 1. Create the account (server-side, no confirmation email needed)
    const res  = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? "Registrierung fehlgeschlagen.")
      setLoading(false)
      return
    }

    // 2. Log the new user straight in
    const supabase = createAuthClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      // Account exists but auto-login failed — send them to the login page
      router.push("/login")
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-white text-2xl font-semibold tracking-tight">Account erstellen</h1>
          <p className="text-gray-500 text-sm mt-1">Erstelle deinen Zugang zu Agency OS</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Dein Name"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="du@email.com"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Passwort</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Passwort bestätigen</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Nochmal eingeben"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || !confirm}
              className="w-full bg-white hover:bg-gray-100 text-gray-950 font-medium rounded-lg py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Account wird erstellt…" : "Account erstellen & loslegen"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Schon einen Account?{" "}
          <a href="/login" className="text-gray-400 hover:text-white underline">Einloggen</a>
        </p>
      </div>
    </div>
  )
}
