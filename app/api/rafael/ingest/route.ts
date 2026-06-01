import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { YoutubeTranscript } from "youtube-transcript"
import { requireAdminUser } from "@/lib/supabase/auth-server"

// Splits long text into ~1000-character chunks, breaking on paragraph/sentence
// boundaries so each chunk stays readable. Raphael searches these chunks.
function chunkText(text: string, target = 1000): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (!clean) return []

  const paragraphs = clean.split(/\n\n+/)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > target && current) {
      chunks.push(current.trim())
      current = ""
    }
    if (para.length > target * 1.5) {
      // Very long paragraph: split on sentence ends.
      const sentences = para.split(/(?<=[.!?])\s+/)
      for (const s of sentences) {
        if ((current + " " + s).length > target && current) {
          chunks.push(current.trim())
          current = ""
        }
        current += (current ? " " : "") + s
      }
    } else {
      current += (current ? "\n\n" : "") + para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

// Pulls the YouTube video id out of any common URL shape.
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return m ? m[1] : null
}

export async function POST(req: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()

  let body: {
    source_type?: string
    title?: string
    text?: string
    url?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 })
  }

  const sourceType = body.source_type ?? "note"
  let title = (body.title ?? "").trim()
  let text = (body.text ?? "").trim()
  const url = (body.url ?? "").trim() || null

  // For YouTube we fetch the transcript on the server.
  if (sourceType === "youtube") {
    if (!url) return NextResponse.json({ error: "Bitte einen YouTube-Link angeben." }, { status: 400 })
    const id = youtubeId(url)
    if (!id) return NextResponse.json({ error: "Das sieht nicht wie ein gültiger YouTube-Link aus." }, { status: 400 })
    try {
      // Try German captions first, then fall back to whatever exists.
      let parts: { text: string }[] = []
      try {
        parts = await YoutubeTranscript.fetchTranscript(id, { lang: "de" })
      } catch {
        parts = await YoutubeTranscript.fetchTranscript(id)
      }
      text = parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim()
      if (!title) title = `YouTube-Video ${id}`
    } catch {
      return NextResponse.json(
        {
          error:
            "Konnte das Transkript nicht automatisch laden (Video hat evtl. keine Untertitel). " +
            "Tipp: Öffne das Video, klick auf '...' → 'Transkript anzeigen', kopiere den Text und füg ihn als Notiz ein.",
        },
        { status: 422 }
      )
    }
  }

  if (!text) {
    return NextResponse.json({ error: "Es gibt keinen Text zum Speichern." }, { status: 400 })
  }
  if (!title) title = text.slice(0, 60) + (text.length > 60 ? "…" : "")

  const chunks = chunkText(text)
  if (chunks.length === 0) {
    return NextResponse.json({ error: "Konnte den Text nicht aufbereiten." }, { status: 400 })
  }

  // Save the document.
  const { data: doc, error: docErr } = await supabase
    .from("raphael_documents")
    .insert({
      title,
      source_type: sourceType,
      source_url: url,
      raw_text: text,
      chunk_count: chunks.length,
    })
    .select()
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: docErr?.message ?? "Speichern fehlgeschlagen." }, { status: 500 })
  }

  // Save the searchable chunks.
  const { error: chunkErr } = await supabase
    .from("raphael_chunks")
    .insert(chunks.map((content) => ({ document_id: doc.id, content })))

  if (chunkErr) {
    // Roll back the document so we don't leave an empty shell.
    await supabase.from("raphael_documents").delete().eq("id", doc.id)
    return NextResponse.json({ error: chunkErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, document: doc, chunks: chunks.length })
}
