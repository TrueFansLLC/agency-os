import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { BUSINESS_CONTEXT, PRIVACY_RULES } from "@/lib/rafael"
import Anthropic from "@anthropic-ai/sdk"
import { requireAdminUser } from "@/lib/supabase/auth-server"

// Rafael's brain (web chat). Same identity + business context as the Telegram Rafael
// (shared from lib/rafael.ts), plus German full-text search over Elijah's saved knowledge.
const MODEL = "claude-sonnet-4-6" // good balance of quality and cost for a personal assistant

// Identical persona/knowledge to the Telegram Rafael, so it's one assistant in two places.
const SYSTEM_PROMPT = `Du bist Rafael, der persönliche AI-Assistent und Second Brain von Elijah Bulut für seine Creator Agency TrueFans LLC.
Du antwortest immer auf Deutsch, präzise, handlungsorientiert und in klarer Sprache.

So arbeitest du:
- Nutze das WISSEN, das dir aus Elijahs Wissensspeicher mitgegeben wird, wenn es zur Frage passt.
- Wenn etwas aus einem gespeicherten Dokument stammt, sag bei Bedarf, aus welchem.
- Wenn der Wissensspeicher nichts Passendes enthält, hilf trotzdem mit deinem Business-Wissen — aber erfinde keine Fakten über Elijah oder seine Agentur.

${PRIVACY_RULES}

${BUSINESS_CONTEXT}`

// Returns the saved messages history (most recent first → reversed to chronological).
export async function GET() {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("raphael_messages")
    .select("id, role, content, created_at")
    .eq("channel", "web")
    .order("created_at", { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Rafael ist noch nicht mit der Claude-API verbunden. Bitte den ANTHROPIC_API_KEY hinterlegen.",
        needsKey: true,
      },
      { status: 503 }
    )
  }

  const supabase = createServerClient()

  let body: { message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 })
  }
  const userMessage = (body.message ?? "").trim()
  if (!userMessage) return NextResponse.json({ error: "Leere Nachricht." }, { status: 400 })

  // 1) Find relevant knowledge via German full-text search.
  let context = ""
  const sources: { title: string; type: string }[] = []
  try {
    const { data: chunks } = await supabase
      .from("raphael_chunks")
      .select("content, document:raphael_documents(title, source_type)")
      .textSearch("content_tsv", userMessage, { type: "websearch", config: "german" })
      .limit(8)

    if (chunks && chunks.length > 0) {
      const seen = new Set<string>()
      context = chunks
        .map((c) => {
          // Supabase types the joined relation loosely; normalize it.
          const doc = (c as { document?: { title?: string; source_type?: string } | null }).document
          const title = doc?.title ?? "Unbekannt"
          if (!seen.has(title)) {
            seen.add(title)
            sources.push({ title, type: doc?.source_type ?? "note" })
          }
          return `[Aus: ${title}]\n${(c as { content: string }).content}`
        })
        .join("\n\n---\n\n")
    }
  } catch {
    // If search fails, continue without context rather than blocking the answer.
  }

  // 2) Recent conversation history for continuity.
  const { data: history } = await supabase
    .from("raphael_messages")
    .select("role, content")
    .eq("channel", "web")
    .order("created_at", { ascending: false })
    .limit(10)
  const priorMessages = (history ?? [])
    .reverse()
    .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }))

  // 3) Save the user's message.
  await supabase.from("raphael_messages").insert({ role: "user", content: userMessage, channel: "web" })

  // 4) Ask Claude.
  const anthropic = new Anthropic({ apiKey })
  const knowledgeBlock = context
    ? `Hier ist relevantes Wissen aus Elijahs Speicher:\n\n${context}`
    : `Im Wissensspeicher wurde nichts Passendes zu dieser Frage gefunden.`

  let reply = ""
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        ...priorMessages,
        { role: "user", content: `${knowledgeBlock}\n\n---\n\nElijahs Frage: ${userMessage}` },
      ],
    })
    reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler"
    return NextResponse.json({ error: `Claude-Fehler: ${msg}` }, { status: 502 })
  }

  if (!reply) reply = "(Keine Antwort erhalten.)"

  // 5) Save Rafael's answer.
  await supabase.from("raphael_messages").insert({ role: "assistant", content: reply, channel: "web" })

  return NextResponse.json({ reply, sources })
}
