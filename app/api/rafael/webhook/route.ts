import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { BUSINESS_CONTEXT, PRIVACY_RULES } from "@/lib/rafael"
import { ingestDocument, youtubeId } from "@/lib/rafaelBrain"
import { YoutubeTranscript } from "youtube-transcript"
import { isTelegramWebhookAuthorized } from "@/lib/supabase/auth-server"
// Trello removed — tasks now in Supabase

const TOKEN         = process.env.RAFAEL_BOT_TOKEN ?? ""
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""

async function send(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
}

// Builds a direct download URL for a file Elijah sent in Telegram.
async function tgFileUrl(fileId: string): Promise<string | null> {
  const res  = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`)
  const data = await res.json()
  if (!data.ok) return null
  return `https://api.telegram.org/file/bot${TOKEN}/${data.result.file_path}`
}

async function loadContext(supabase: ReturnType<typeof createServerClient>) {
  const today   = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)

  const [
    { data: problems },
    { data: todayPosts },
    { data: weekPosts },
    { data: employees },
    { data: pairs },
    { data: igAccounts },
    { data: fbAccounts },
    { data: igSnaps },
    { data: fbSnaps },
  ] = await Promise.all([
    supabase.from("account_pairs").select("ig_username, fb_username, status, status_since, status_note, ig_mitarbeiter, fb_mitarbeiter").in("status", ["restricted", "banned"]),
    supabase.from("posting_schedule").select("account, platform, status").eq("send_date", today).neq("status", "wartet"),
    supabase.from("posting_schedule").select("account, status, send_date").gte("send_date", weekAgo).neq("status", "wartet"),
    supabase.from("employees").select("name, role, telegram_chat_id"),
    supabase.from("account_pairs").select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter, creator, status"),
    supabase.from("instagram_accounts").select("id, username, status, archived").eq("archived", false),
    supabase.from("facebook_accounts").select("id, username, status, archived").eq("archived", false),
    supabase.from("instagram_metric_snapshots").select("account_id, date, followers, views, posts").gte("date", weekAgo).order("date", { ascending: false }),
    supabase.from("facebook_metric_snapshots").select("account_id, date, followers, video_views").gte("date", weekAgo).order("date", { ascending: false }),
  ])

  // Latest snapshot per IG account
  const igLatest: Record<string, { followers: number; views: number }> = {}
  for (const s of igSnaps ?? []) {
    if (!igLatest[s.account_id]) igLatest[s.account_id] = { followers: s.followers ?? 0, views: s.views ?? 0 }
  }

  // Latest snapshot per FB account
  const fbLatest: Record<string, { followers: number; views: number }> = {}
  for (const s of fbSnaps ?? []) {
    if (!fbLatest[s.account_id]) fbLatest[s.account_id] = { followers: s.followers ?? 0, views: s.video_views ?? 0 }
  }

  // Weekly post stats
  const weekTotal    = weekPosts?.length ?? 0
  const weekPosted   = weekPosts?.filter(p => p.status === "gepostet").length ?? 0
  const weekRate     = weekTotal > 0 ? Math.round(weekPosted / weekTotal * 100) : 0

  const igLines = (igAccounts ?? []).map(a => {
    const snap = igLatest[a.id]
    const pair = pairs?.find(p => p.ig_username?.toLowerCase() === a.username?.toLowerCase())
    return `  @${a.username} | ${snap?.followers?.toLocaleString() ?? "?"} Follower | ${snap?.views?.toLocaleString() ?? "?"} Views (7d) | Manager: ${pair?.ig_mitarbeiter ?? "—"} | Status: ${a.status}`
  }).join("\n")

  const fbLines = (fbAccounts ?? []).map(a => {
    const snap = fbLatest[a.id]
    const pair = pairs?.find(p => p.fb_username?.toLowerCase() === a.username?.toLowerCase())
    return `  @${a.username} | ${snap?.followers?.toLocaleString() ?? "?"} Follower | ${snap?.views?.toLocaleString() ?? "?"} Views (7d) | Manager: ${pair?.fb_mitarbeiter ?? "—"} | Status: ${a.status}`
  }).join("\n")

  return `
HEUTE (${today}):
Posts gesamt: ${todayPosts?.length ?? 0} | Gepostet: ${todayPosts?.filter(p => p.status === "gepostet").length ?? 0} | Bereit: ${todayPosts?.filter(p => p.status === "bereit").length ?? 0} | Geplant: ${todayPosts?.filter(p => p.status === "geplant").length ?? 0}

DIESE WOCHE (7 Tage):
${weekPosted}/${weekTotal} Posts gepostet (${weekRate}% Completion Rate)

ACCOUNT PROBLEME (${problems?.length ?? 0}):
${problems?.length ? problems.map(p => `  🔴 @${p.ig_username ?? p.fb_username}: ${p.status} | Gemeldet: ${p.status_note ?? "—"} | Seit: ${p.status_since?.slice(0,10) ?? "?"}`).join("\n") : "Keine Probleme ✅"}

INSTAGRAM ACCOUNTS (${igAccounts?.length ?? 0}):
${igLines || "Keine"}

FACEBOOK ACCOUNTS (${fbAccounts?.length ?? 0}):
${fbLines || "Keine"}

MITARBEITER (${employees?.length ?? 0}):
${employees?.map(e => `  ${e.telegram_chat_id ? "🟢" : "🔴"} ${e.name} (${e.role ?? "Mitarbeiter"})`).join("\n") ?? "Keine"}
`
}

async function askClaude(
  question: string,
  context: string,
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `Du bist Rafael, der persönliche AI-Assistent und Second Brain von Elijah Bulut für seine Creator Agency TrueFans LLC.
Antworte immer auf Deutsch, präzise und handlungsorientiert.
Heute: ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
Nutze HTML-Formatierung für Telegram (<b>fett</b>, keine Markdown).

DEIN GEDÄCHTNIS-SPEICHER: Du hast ein dauerhaftes, durchsuchbares Langzeit-Gedächtnis, das Elijah selbst füttert (Notizen, PDFs, YouTube-Transkripte) — sein "Second Brain". Bei jeder Frage wird dieser Speicher automatisch durchsucht; passende Treffer erscheinen weiter unten unter "WISSENSSPEICHER". Wenn dort etwas steht, nutze es als deine Wahrheit. Sage NIEMALS, du hättest keinen Datenbankzugriff oder würdest Dinge vergessen — dein Business-Wissen, die Live-Daten und alles von Elijah Gefütterte bleiben dauerhaft erhalten. Du erinnerst dich auch an euren bisherigen Gesprächsverlauf.

${PRIVACY_RULES}

${BUSINESS_CONTEXT}

LIVE-DATEN:
${context}`,
      messages: [...history, { role: "user", content: question }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? "Fehler beim Abrufen der Antwort."
}

// Searches Elijah's fed-in knowledge (PDFs, YouTube transcripts, notes) so the
// Telegram Rafael uses the same "second brain" memory as the web chat.
async function searchKnowledge(
  supabase: ReturnType<typeof createServerClient>,
  query: string
): Promise<string> {
  try {
    const { data: chunks } = await supabase
      .from("raphael_chunks")
      .select("content, document:raphael_documents(title)")
      .textSearch("content_tsv", query, { type: "websearch", config: "german" })
      .limit(6)
    if (!chunks?.length) return ""
    const blocks = chunks.map((c) => {
      const doc = (c as { document?: { title?: string } | null }).document
      return `[Aus: ${doc?.title ?? "Notiz"}]\n${(c as { content: string }).content}`
    })
    return `\n\nWISSENSSPEICHER (von Elijah gefüttert — Dokumente/Videos/Notizen):\n${blocks.join("\n\n")}`
  } catch {
    return ""
  }
}

export async function POST(request: NextRequest) {
  if (!isTelegramWebhookAuthorized(request, process.env.RAFAEL_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.message) return NextResponse.json({ ok: true })

  const message   = body.message
  const chatId    = String(message.chat.id)
  const text      = (message.text ?? "").trim()
  const firstName = message.from?.first_name ?? "Elijah"

  if (chatId !== OWNER_CHAT_ID) {
    await send(chatId, "⛔️ Kein Zugriff.")
    return NextResponse.json({ ok: true })
  }

  const supabase = createServerClient()

  if (text.startsWith("/start")) {
    await send(chatId,
      `👋 Hey ${firstName}! Ich bin <b>Rafael</b> — dein AI-Assistent &amp; Second Brain.\n\nIch habe Zugriff auf:\n• Instagram & Facebook Accounts (Follower, Views)\n• Posts & Completion Rate\n• Mitarbeiter & Zuständigkeiten\n• Account-Probleme in Echtzeit\n• Alles, was du mir fütterst (dauerhaft gemerkt) 🧠\n\nStell mir einfach eine Frage auf Deutsch.\n\n🧠 <b>Neu — merk dir alles:</b>\n• <code>/merke &lt;Text&gt;</code>\n• Schick mir ein PDF oder einen YouTube-Link\n\nTippe /hilfe für alle Befehle.`
    )
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/hilfe")) {
    await send(chatId,
      `📋 <b>Rafael Befehle</b>\n\n/status — Account-Probleme\n/posts — Posts heute\n/mitarbeiter — Team-Übersicht\n/report — Tages-Report\n\n🧠 <b>Mir etwas merken (für immer):</b>\n• <code>/merke &lt;Text&gt;</code> — oder schreib „merk dir: …"\n• Schick mir ein <b>PDF</b> oder eine Textdatei\n• Schick mir einen <b>YouTube-Link</b> → ich speichere das Transkript\n\n💬 Oder stell mir einfach eine Frage — ich nutze deine Live-Daten und alles Gemerkte.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Dokument (PDF / Textdatei) → dauerhaft ins Gedächtnis ──
  if (message.document) {
    const file     = message.document
    const fileName = (file.file_name ?? "Dokument") as string
    const mime     = (file.mime_type ?? "") as string
    const isPdf    = mime === "application/pdf" || /\.pdf$/i.test(fileName)
    const isText   = mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(fileName)
    if (!isPdf && !isText) {
      await send(chatId, "📎 Diesen Dateityp kann ich noch nicht lesen — schick mir PDF oder Textdateien.")
      return NextResponse.json({ ok: true })
    }
    await send(chatId, "📥 Lese die Datei…")
    try {
      const url = await tgFileUrl(file.file_id)
      if (!url) { await send(chatId, "⚠️ Konnte die Datei nicht laden."); return NextResponse.json({ ok: true }) }
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
      let content = ""
      if (isPdf) {
        const { PDFParse } = await import("pdf-parse")
        const parser = new PDFParse({ data: buf })
        try {
          content = (await parser.getText()).text
        } finally {
          await parser.destroy()
        }
      } else {
        content = buf.toString("utf8")
      }
      const title = ((message.caption as string) ?? fileName).replace(/\.(pdf|txt|md|csv)$/i, "").trim()
      const r = await ingestDocument(supabase, { title, source_type: isPdf ? "pdf" : "text", text: content })
      await send(chatId, r.ok
        ? `✅ Gespeichert: <b>${title}</b> (${r.chunks} Häppchen). Das merke ich mir dauerhaft. 🧠`
        : `⚠️ ${r.error}`)
    } catch {
      await send(chatId, "⚠️ Aus dieser Datei konnte ich keinen Text lesen (evtl. ein gescanntes Bild-PDF).")
    }
    return NextResponse.json({ ok: true })
  }

  // ── "/merke …" oder "merk dir: …" → Notiz dauerhaft speichern ──
  const saveMatch = text.match(/^\/(?:merke?|lerne?|speichere?|remember)\b[:\s]*([\s\S]*)$/i)
    ?? text.match(/^(?:merk(?:e)? dir|speicher(?:e)? dir|lern(?:e)? dir)[:\s]+([\s\S]*)$/i)
  if (saveMatch) {
    const content = (saveMatch[1] ?? "").trim()
    if (content.length < 3) {
      await send(chatId, "✍️ Sag mir, was ich mir merken soll, z.B.:\n<code>/merke Mein bestes Format ist das Speaking-Reel mit Farm-Branding.</code>")
      return NextResponse.json({ ok: true })
    }
    const title = content.slice(0, 60) + (content.length > 60 ? "…" : "")
    const r = await ingestDocument(supabase, { title, source_type: "note", text: content })
    await send(chatId, r.ok ? `✅ Gemerkt: <b>${title}</b> 🧠` : `⚠️ ${r.error}`)
    return NextResponse.json({ ok: true })
  }

  // ── Reiner YouTube-Link → Transkript dauerhaft speichern ──
  const ytOnly = /^https?:\/\/\S+$/.test(text) ? youtubeId(text) : null
  if (ytOnly) {
    await send(chatId, "▶️ Hole das Transkript…")
    try {
      let parts: { text: string }[] = []
      try { parts = await YoutubeTranscript.fetchTranscript(ytOnly, { lang: "de" }) }
      catch { parts = await YoutubeTranscript.fetchTranscript(ytOnly) }
      const transcript = parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim()
      const r = await ingestDocument(supabase, {
        title: `YouTube-Video ${ytOnly}`,
        source_type: "youtube",
        source_url: text,
        text: transcript,
      })
      await send(chatId, r.ok ? `✅ YouTube-Transkript gemerkt (${r.chunks} Häppchen). 🧠` : `⚠️ ${r.error}`)
    } catch {
      await send(chatId, "⚠️ Konnte das Transkript nicht laden (Video hat evtl. keine Untertitel).")
    }
    return NextResponse.json({ ok: true })
  }

  // Daten laden
  const context = await loadContext(supabase)
  const today   = new Date().toISOString().slice(0, 10)

  if (text.startsWith("/status")) {
    const { data: problems } = await supabase.from("account_pairs").select("ig_username, fb_username, status, status_since, status_note").in("status", ["restricted", "banned"])
    if (!problems?.length) {
      await send(chatId, "✅ <b>Keine Probleme</b> — Alle Accounts sind Active.")
    } else {
      const lines = problems.map(p => `${p.status === "banned" ? "🔴" : "🟠"} <b>@${p.ig_username ?? p.fb_username}</b> — ${p.status}\n   ${p.status_note ?? ""}`).join("\n\n")
      await send(chatId, `⚠️ <b>${problems.length} Problem${problems.length > 1 ? "e" : ""}</b>\n\n${lines}`)
    }
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/posts")) {
    const { data: posts } = await supabase.from("posting_schedule").select("account, platform, status").eq("send_date", today).neq("status", "wartet")
    const total = posts?.length ?? 0
    await send(chatId, total === 0
      ? "📭 Heute keine Posts geplant."
      : `📊 <b>Posts heute</b>\n\nGesamt: ${total}\n✅ Gepostet: ${posts?.filter(p => p.status === "gepostet").length}\n🟢 Bereit: ${posts?.filter(p => p.status === "bereit").length}\n⏳ Geplant: ${posts?.filter(p => p.status === "geplant").length}`
    )
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/mitarbeiter")) {
    const { data: employees } = await supabase.from("employees").select("name, role, telegram_chat_id").order("name")
    const lines = employees?.map(e => `${e.telegram_chat_id ? "🟢" : "🔴"} <b>${e.name}</b> — ${e.role ?? "Mitarbeiter"}`).join("\n") ?? "Keine"
    await send(chatId, `👥 <b>Mitarbeiter (${employees?.length ?? 0})</b>\n\n${lines}`)
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/report")) {
    await send(chatId, "📋 Erstelle Report...")
    const answer = await askClaude("Erstelle einen übersichtlichen Tages-Report. Fasse die wichtigsten Punkte zusammen: Probleme, Post-Performance heute und diese Woche, Team-Status. Halte es kurz und klar.", context)
    await send(chatId, answer)
    return NextResponse.json({ ok: true })
  }

  // ── Tasks anzeigen ───────────────────────────────────────────
  if (text.startsWith("/tasks") || (/\b(tasks?|aufgaben|to.?dos?)\b/i.test(text) && /\b(zeig|was|alle|mein|offen)\b/i.test(text))) {
    const { data: tasks } = await supabase.from("tasks").select("*").neq("status", "erledigt").order("created_at", { ascending: false })
    if (!tasks?.length) {
      await send(chatId, "📋 Keine offenen Tasks.")
    } else {
      const grouped: Record<string, typeof tasks> = {}
      for (const t of tasks) {
        if (!grouped[t.status]) grouped[t.status] = []
        grouped[t.status].push(t)
      }
      const lines = Object.entries(grouped).map(([status, items]) =>
        `<b>${status === "offen" ? "Offen" : "In Arbeit"} (${items.length})</b>\n` +
        items.map(t => `• ${t.title}${t.assignee !== "Elijah" ? ` — ${t.assignee}` : ""}${t.due_date ? ` (bis ${t.due_date})` : ""}`).join("\n")
      ).join("\n\n")
      await send(chatId, `📋 <b>Tasks</b>\n\n${lines}`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Task erstellen ───────────────────────────────────────────
  if (/\b(füge?|erstell|neue?[rns]?)\b/i.test(text) && /\b(task|aufgabe)\b/i.test(text)) {
    const name = text
      .replace(/füge?\s+(einen?\s+)?/i, "")
      .replace(/\s*(neue?[rns]?\s+)?(task|aufgabe)(\s+hinzu)?/i, "")
      .replace(/^(task|aufgabe)[:\s]+/i, "")
      .trim()
    if (name.length > 2) {
      await supabase.from("tasks").insert({ title: name, assignee: "Elijah", created_by: "Rafael via Telegram" })
      await send(chatId, `✅ Task erstellt: <b>${name}</b>`)
    } else {
      await send(chatId, "Sag mir den Task-Namen, z.B.: <i>Füge Task hinzu: Website überarbeiten</i>")
    }
    return NextResponse.json({ ok: true })
  }

  // Freitext → Claude mit vollem Kontext + Gesprächs-Gedächtnis
  if (text && !text.startsWith("/")) {
    await send(chatId, "🤔 Einen Moment...")
    const { data: tasks } = await supabase.from("tasks").select("title, assignee, status").neq("status", "erledigt").limit(20)
    const taskCtx = tasks?.length ? `\nOFFENE TASKS:\n${tasks.map(t => `- ${t.title} (${t.assignee}, ${t.status})`).join("\n")}` : ""
    const knowledge = await searchKnowledge(supabase, text)

    // Letzte Telegram-Unterhaltung als Gedächtnis (getrennt vom Web-Chat per channel).
    let history: { role: "user" | "assistant"; content: string }[] = []
    try {
      const { data: past } = await supabase
        .from("raphael_messages")
        .select("role, content")
        .eq("channel", "telegram")
        .order("created_at", { ascending: false })
        .limit(12)
      history = (past ?? [])
        .reverse()
        .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }))
    } catch {
      // channel-Spalte evtl. noch nicht vorhanden → ohne Verlauf weiter
    }

    const answer = await askClaude(text, context + taskCtx + knowledge, history)
    await send(chatId, answer)

    // Unterhaltung dauerhaft merken (Fehler ignorieren, falls Spalte noch fehlt).
    await supabase.from("raphael_messages").insert([
      { role: "user", content: text, channel: "telegram" },
      { role: "assistant", content: answer, channel: "telegram" },
    ])
    return NextResponse.json({ ok: true })
  }

  await send(chatId, "Tippe /hilfe für alle Befehle.")
  return NextResponse.json({ ok: true })
}
