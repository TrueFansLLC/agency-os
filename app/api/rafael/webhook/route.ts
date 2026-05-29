import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const TOKEN        = process.env.RAFAEL_BOT_TOKEN ?? ""
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""

async function send(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
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
      system: `Du bist Rafael, der AI-Assistent von Elijah Bulut für seine Creator Agency TrueFans LLC.
Du hast Zugriff auf Live-Daten aus der Datenbank. Antworte immer auf Deutsch, kurz und präzise.
Heute ist der ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Aktuelle Daten aus der Datenbank:
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

  // ── /start ───────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    await send(chatId,
      `👋 Hey ${firstName}, ich bin <b>Rafael</b> — dein AI-Assistent für TrueFans.\n\nIch habe Zugriff auf alle deine Live-Daten und bin mit Claude AI verbunden. Stell mir einfach Fragen auf Deutsch.\n\nBeispiele:\n• "Welche Accounts haben Probleme?"\n• "Wie viele Posts wurden heute gepostet?"\n• "Gib mir den Tages-Report"\n\nOder tippe /hilfe für alle Befehle.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── /hilfe ───────────────────────────────────────────────────
  if (text.startsWith("/hilfe")) {
    await send(chatId,
      `📋 <b>Rafael — Befehle</b>\n\n/status — Account-Probleme\n/posts — Posts heute\n/mitarbeiter — Alle Mitarbeiter\n/report — Tages-Report\n\n💬 Oder stell mir einfach eine Frage auf Deutsch — ich antworte mit AI.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Daten für Kontext laden ───────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: problems }, { data: posts }, { data: employees }] = await Promise.all([
    supabase.from("account_pairs").select("ig_username, fb_username, status, status_since, status_note").in("status", ["restricted", "banned"]),
    supabase.from("posting_schedule").select("account, platform, status, reel_number").eq("send_date", today).neq("status", "wartet"),
    supabase.from("employees").select("name, role, telegram_chat_id"),
  ])

  const dbContext = `
ACCOUNT PROBLEME (${problems?.length ?? 0}):
${problems?.length ? problems.map(p => `- @${p.ig_username ?? p.fb_username}: ${p.status} seit ${p.status_since?.slice(0,10) ?? "?"} (${p.status_note ?? ""})`).join("\n") : "Keine Probleme"}

POSTS HEUTE (${today}):
Gesamt: ${posts?.length ?? 0} | Gepostet: ${posts?.filter(p => p.status === "gepostet").length ?? 0} | Bereit: ${posts?.filter(p => p.status === "bereit").length ?? 0} | Geplant: ${posts?.filter(p => p.status === "geplant").length ?? 0}

MITARBEITER (${employees?.length ?? 0}):
${employees?.map(e => `- ${e.name} (${e.role ?? "Mitarbeiter"}) ${e.telegram_chat_id ? "🟢 verbunden" : "🔴 nicht verbunden"}`).join("\n") ?? "Keine"}
`

  // ── /status, /posts, /mitarbeiter, /report → Schnellantwort ─
  if (text.startsWith("/status")) {
    if (!problems?.length) {
      await send(chatId, "✅ <b>Keine Probleme</b> — Alle Accounts sind Active.")
    } else {
      const lines = problems.map(p => {
        const icon = p.status === "banned" ? "🔴" : "🟠"
        return `${icon} <b>@${p.ig_username ?? p.fb_username}</b> — ${p.status}\n   ${p.status_note ?? ""}`
      }).join("\n\n")
      await send(chatId, `⚠️ <b>${problems.length} Problem${problems.length > 1 ? "e" : ""}</b>\n\n${lines}`)
    }
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/posts")) {
    const total    = posts?.length ?? 0
    const gepostet = posts?.filter(p => p.status === "gepostet").length ?? 0
    const bereit   = posts?.filter(p => p.status === "bereit").length ?? 0
    const geplant  = posts?.filter(p => p.status === "geplant").length ?? 0
    await send(chatId, total === 0
      ? `📭 Heute keine Posts geplant.`
      : `📊 <b>Posts heute</b>\n\nGesamt: ${total}\n✅ Gepostet: ${gepostet}\n🟢 Bereit: ${bereit}\n⏳ Geplant: ${geplant}`
    )
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/mitarbeiter")) {
    const lines = employees?.map(e =>
      `${e.telegram_chat_id ? "🟢" : "🔴"} <b>${e.name}</b> — ${e.role ?? "Mitarbeiter"}`
    ).join("\n") ?? "Keine"
    await send(chatId, `👥 <b>Mitarbeiter (${employees?.length ?? 0})</b>\n\n${lines}`)
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith("/report")) {
    await send(chatId,
      `📋 <b>Tages-Report — ${today}</b>\n\n` +
      `📲 Posts: ${posts?.filter(p => p.status === "gepostet").length ?? 0}/${posts?.length ?? 0} gepostet\n` +
      `⚠️ Account-Probleme: ${problems?.length ?? 0}\n` +
      `👥 Mitarbeiter online: ${employees?.filter(e => e.telegram_chat_id).length ?? 0}/${employees?.length ?? 0}\n\n` +
      (problems?.length ? `Tippe /status für Details.` : `✅ Alles läuft gut.`)
    )
    return NextResponse.json({ ok: true })
  }

  // ── Freitext → Claude AI ─────────────────────────────────────
  if (text && !text.startsWith("/")) {
    await send(chatId, "🤔 Einen Moment...")
    const answer = await askClaude(text, dbContext)
    await send(chatId, answer)
    return NextResponse.json({ ok: true })
  }

  await send(chatId, `Ich verstehe das nicht. Tippe /hilfe für alle Befehle.`)
  return NextResponse.json({ ok: true })
}
