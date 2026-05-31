"use client"

import { useState, useEffect, useRef, useCallback } from "react"

type Doc = {
  id: string
  title: string
  source_type: string
  source_url: string | null
  chunk_count: number
  created_at: string
}

type Msg = { role: "user" | "assistant"; content: string }

const TYPE_LABEL: Record<string, string> = {
  note: "Notiz",
  text: "Text",
  pdf: "PDF",
  youtube: "YouTube",
}

// Loads pdf.js from a CDN once, so PDFs can be read straight in the browser
// (no server-side PDF library needed).
function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (w.pdfjsLib) return resolve(w.pdfjsLib)
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
    script.onload = () => {
      const lib = (window as any).pdfjsLib
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
      resolve(lib)
    }
    script.onerror = () => reject(new Error("PDF-Leser konnte nicht geladen werden."))
    document.body.appendChild(script)
  })
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  let out = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    out += content.items.map((it: any) => it.str).join(" ") + "\n\n"
  }
  return out.trim()
}

export default function RaphaelPage() {
  const [tab, setTab] = useState<"note" | "youtube" | "pdf">("note")
  const [docs, setDocs] = useState<Doc[]>([])
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  // feed inputs
  const [noteTitle, setNoteTitle] = useState("")
  const [noteText, setNoteText] = useState("")
  const [ytUrl, setYtUrl] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // chat
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [keyMissing, setKeyMissing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadDocs = useCallback(async () => {
    const res = await fetch("/api/raphael/documents")
    const data = await res.json()
    setDocs(Array.isArray(data.documents) ? data.documents : [])
  }, [])

  const loadMessages = useCallback(async () => {
    const res = await fetch("/api/raphael/chat")
    const data = await res.json()
    if (Array.isArray(data.messages)) {
      setMessages(data.messages.map((m: any) => ({ role: m.role, content: m.content })))
    }
  }, [])

  useEffect(() => {
    loadDocs()
    loadMessages()
  }, [loadDocs, loadMessages])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function showFlash(kind: "ok" | "err", text: string) {
    setFlash({ kind, text })
    setTimeout(() => setFlash(null), 6000)
  }

  async function ingest(payload: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch("/api/raphael/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        showFlash("err", data.error ?? "Fehler beim Speichern.")
        return false
      }
      showFlash("ok", `Gespeichert! Raphael hat ${data.chunks} Wissens-Häppchen dazugelernt.`)
      await loadDocs()
      return true
    } catch {
      showFlash("err", "Netzwerkfehler.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    if (!noteText.trim()) return showFlash("err", "Bitte etwas Text eingeben.")
    const ok = await ingest({ source_type: "note", title: noteTitle, text: noteText })
    if (ok) {
      setNoteTitle("")
      setNoteText("")
    }
  }

  async function saveYoutube() {
    if (!ytUrl.trim()) return showFlash("err", "Bitte einen YouTube-Link einfügen.")
    const ok = await ingest({ source_type: "youtube", url: ytUrl })
    if (ok) setYtUrl("")
  }

  async function savePdf(file: File) {
    setBusy(true)
    showFlash("ok", "Lese PDF… einen Moment.")
    try {
      const text = await extractPdfText(file)
      if (!text) {
        showFlash("err", "Aus diesem PDF konnte kein Text gelesen werden (evtl. ein gescanntes Bild).")
        setBusy(false)
        return
      }
      await ingest({ source_type: "pdf", title: file.name.replace(/\.pdf$/i, ""), text })
    } catch (e) {
      showFlash("err", e instanceof Error ? e.message : "PDF-Fehler.")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Dieses Wissen wirklich löschen? Raphael vergisst es dann.")) return
    await fetch(`/api/raphael/documents?id=${id}`, { method: "DELETE" })
    await loadDocs()
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setMessages((m) => [...m, { role: "user", content: text }])
    setSending(true)
    try {
      const res = await fetch("/api/raphael/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsKey) setKeyMissing(true)
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${data.error}` }])
        return
      }
      setKeyMissing(false)
      setMessages((m) => [...m, { role: "assistant", content: data.reply }])
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Netzwerkfehler." }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">🧠 Raphael</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Dein Second Brain. Füttere ihn mit Wissen — er merkt sich alles und beantwortet deine Fragen.
        </p>
      </div>

      {flash && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            flash.kind === "ok"
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              : "bg-red-500/10 text-red-300 border border-red-500/20"
          }`}
        >
          {flash.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: feed knowledge + library */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-medium mb-3">Wissen füttern</h2>
            <div className="flex gap-1 mb-4 bg-gray-950 rounded-lg p-1 w-fit">
              {(["note", "youtube", "pdf"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    tab === t ? "bg-indigo-500/20 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t === "note" ? "📝 Notiz" : t === "youtube" ? "▶️ YouTube" : "📄 PDF"}
                </button>
              ))}
            </div>

            {tab === "note" && (
              <div className="space-y-3">
                <input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Titel (optional)"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Schreib oder füg hier alles ein, was Raphael wissen soll — über dich, deine Agentur, Ideen, Notizen…"
                  rows={6}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-y"
                />
                <button
                  onClick={saveNote}
                  disabled={busy}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {busy ? "Speichere…" : "Speichern"}
                </button>
              </div>
            )}

            {tab === "youtube" && (
              <div className="space-y-3">
                <input
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-gray-500 text-xs">
                  Raphael holt sich das Transkript (den gesprochenen Text) automatisch. Klappt nur bei Videos mit Untertiteln.
                </p>
                <button
                  onClick={saveYoutube}
                  disabled={busy}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {busy ? "Lade Transkript…" : "Transkript holen & speichern"}
                </button>
              </div>
            )}

            {tab === "pdf" && (
              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) savePdf(f)
                  }}
                  disabled={busy}
                  className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-sm file:font-medium hover:file:bg-indigo-500 file:cursor-pointer"
                />
                <p className="text-gray-500 text-xs">
                  Der Text wird direkt in deinem Browser ausgelesen und gespeichert. (Gescannte Bild-PDFs ohne echten Text gehen nicht.)
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-medium mb-3">
              Raphaels Wissen <span className="text-gray-500 font-normal">({docs.length})</span>
            </h2>
            {docs.length === 0 ? (
              <p className="text-gray-500 text-sm">Noch nichts gespeichert. Füttere ihn oben mit dem ersten Wissen.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2"
                  >
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 shrink-0">
                      {TYPE_LABEL[d.source_type] ?? d.source_type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{d.title}</p>
                      <p className="text-gray-600 text-xs">{d.chunk_count} Häppchen</p>
                    </div>
                    <button
                      onClick={() => deleteDoc(d.id)}
                      title="Löschen"
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: chat */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col h-[640px]">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-white font-medium">Chat mit Raphael</h2>
          </div>

          {keyMissing && (
            <div className="mx-5 mt-4 rounded-lg px-4 py-3 text-sm bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Raphael ist noch nicht mit der Claude-API verbunden. Sobald der API-Schlüssel hinterlegt ist, kann er antworten.
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-gray-600 text-sm">
                Stell Raphael eine Frage. Er nutzt dein gespeichertes Wissen, um zu antworten.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-800 text-gray-400 rounded-2xl px-4 py-2.5 text-sm">Raphael denkt nach…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Frag Raphael etwas…"
              className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Senden
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
