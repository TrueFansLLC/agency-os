import { createServerClient } from "@/lib/supabase/server"

type SB = ReturnType<typeof createServerClient>

// Splits long text into ~1000-character chunks on paragraph/sentence boundaries.
// Shared by the web ingest route, the seed route, and the Telegram webhook.
export function chunkText(text: string, target = 1000): string[] {
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

// Stores one document + its searchable chunks in Rafael's memory.
export async function ingestDocument(
  supabase: SB,
  params: { title: string; source_type: string; text: string; source_url?: string | null }
): Promise<{ ok: true; id: string; chunks: number } | { ok: false; error: string }> {
  const text = (params.text ?? "").trim()
  if (!text) return { ok: false, error: "Kein Text zum Speichern." }

  const chunks = chunkText(text)
  if (chunks.length === 0) return { ok: false, error: "Text konnte nicht aufbereitet werden." }

  const { data: doc, error } = await supabase
    .from("raphael_documents")
    .insert({
      title: params.title,
      source_type: params.source_type,
      source_url: params.source_url ?? null,
      raw_text: text,
      chunk_count: chunks.length,
    })
    .select()
    .single()
  if (error || !doc) return { ok: false, error: error?.message ?? "Speichern fehlgeschlagen." }

  const { error: chunkErr } = await supabase
    .from("raphael_chunks")
    .insert(chunks.map((content) => ({ document_id: doc.id, content })))
  if (chunkErr) {
    await supabase.from("raphael_documents").delete().eq("id", doc.id)
    return { ok: false, error: chunkErr.message }
  }
  return { ok: true, id: doc.id, chunks: chunks.length }
}

// Extracts a YouTube video id from any common URL shape.
export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  return m ? m[1] : null
}
