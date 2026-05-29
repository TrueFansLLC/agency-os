import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { BUSINESS_CONTEXT, PRIVACY_RULES } from "@/lib/rafael"

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

async function askClaude(question: string, context: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `Du bist Rafael, der persönliche AI-Assistent und Second Brain von Elijah Bulut für seine Creator Agency TrueFans LLC.
Antworte immer auf Deutsch, präzise und handlungsorientiert.
Heute: ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
Nutze HTML-Formatierung für Telegram (<b>fett</b>, keine Markdown).

${PRIVACY_RULES}

${BUSINESS_CONTEXT}

LIVE-DATEN:
${context}`,
      messages: [{ role: "user", content: question }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? "Fehler beim Abrufen der Antwort."
}

export async function POST(request: NextRequest) {
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
      `👋 Hey ${firstName}! Ich bin <b>Rafael</b> — dein AI-Assistent.\n\nIch habe Zugriff auf:\n• Instagram & Facebook Accounts (Follower, Views)\n• Posts & Completion Rate\n• Mitarbeiter & Zuständigkeiten\n• Account-Probleme in Echtzeit\n\nStell mir einfach eine Frage auf Deutsch.\n\nBeispiele:\n• "Wie läuft der Betrieb heute?"\n• "Welcher Account hat die meisten Views diese Woche?"\n• "Was hat Peter heute gemeldet?"\n\nOder tippe /hilfe.`
    )
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/hilfe")) {
    await send(chatId,
      `📋 <b>Rafael Befehle</b>\n\n/status — Account-Probleme\n/posts — Posts heute\n/mitarbeiter — Team-Übersicht\n/report — Tages-Report\n\n💬 Oder stell mir direkt eine Frage — ich nutze deine Live-Daten um zu antworten.`
    )
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

  // Freitext → Claude mit vollem Kontext
  if (text && !text.startsWith("/")) {
    await send(chatId, "🤔 Einen Moment...")
    const answer = await askClaude(text, context)
    await send(chatId, answer)
    return NextResponse.json({ ok: true })
  }

  await send(chatId, "Tippe /hilfe für alle Befehle.")
  return NextResponse.json({ ok: true })
}
