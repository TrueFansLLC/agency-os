import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const TOKEN = process.env.RAFAEL_BOT_TOKEN ?? ""
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

async function send(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.message) return NextResponse.json({ ok: true })

  const message  = body.message
  const chatId   = String(message.chat.id)
  const text     = (message.text ?? "").trim()
  const firstName = message.from?.first_name ?? "Elijah"

  // Only respond to the owner
  if (chatId !== OWNER_CHAT_ID) {
    await send(chatId, "⛔️ Kein Zugriff.")
    return NextResponse.json({ ok: true })
  }

  const supabase = createServerClient()

  // ── /start ───────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    await send(chatId,
      `👋 Hey ${firstName}, ich bin <b>Rafael</b> — dein AI-Assistent für TrueFans.\n\nIch habe Zugriff auf alle deine Daten. Du kannst mir Fragen stellen:\n\n• "Welche Accounts haben Probleme?"\n• "Wie viele Posts heute?"\n• "Status aller Mitarbeiter"\n\nOder tippe /hilfe für alle Befehle.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── /hilfe ───────────────────────────────────────────────────
  if (text.startsWith("/hilfe")) {
    await send(chatId,
      `📋 <b>Rafael — Befehle</b>\n\n/status — Account-Probleme heute\n/posts — Posts heute geplant\n/mitarbeiter — Übersicht alle Mitarbeiter\n/report — Tages-Report\n\nOder stell mir einfach eine Frage auf Deutsch.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── /status ──────────────────────────────────────────────────
  if (text.startsWith("/status")) {
    const { data: pairs } = await supabase
      .from("account_pairs")
      .select("ig_username, fb_username, status, status_since, status_note")
      .in("status", ["restricted", "banned"])

    if (!pairs?.length) {
      await send(chatId, "✅ <b>Keine Probleme</b>\n\nAlle Accounts sind aktuell Active.")
    } else {
      const lines = pairs.map(p => {
        const acc  = p.ig_username ?? p.fb_username
        const icon = p.status === "banned" ? "🔴" : "🟠"
        const since = p.status_since ? new Date(p.status_since).toLocaleDateString("de-DE") : "—"
        return `${icon} <b>@${acc}</b> — ${p.status} seit ${since}\n   ${p.status_note ?? ""}`
      }).join("\n\n")
      await send(chatId, `⚠️ <b>${pairs.length} Account-Problem${pairs.length > 1 ? "e" : ""}</b>\n\n${lines}`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── /posts ───────────────────────────────────────────────────
  if (text.startsWith("/posts")) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: posts } = await supabase
      .from("posting_schedule")
      .select("account, platform, status, reel_number")
      .eq("send_date", today)
      .neq("status", "wartet")

    if (!posts?.length) {
      await send(chatId, `📭 Heute (${today}) keine Posts geplant.`)
    } else {
      const gepostet = posts.filter(p => p.status === "gepostet").length
      const geplant  = posts.filter(p => p.status === "geplant").length
      const bereit   = posts.filter(p => p.status === "bereit").length
      await send(chatId,
        `📊 <b>Posts heute — ${today}</b>\n\nGesamt: ${posts.length}\n✅ Gepostet: ${gepostet}\n🟢 Bereit: ${bereit}\n⏳ Geplant: ${geplant}`
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── /mitarbeiter ─────────────────────────────────────────────
  if (text.startsWith("/mitarbeiter")) {
    const { data: employees } = await supabase
      .from("employees")
      .select("name, role, telegram_chat_id")
      .order("name")

    if (!employees?.length) {
      await send(chatId, "Keine Mitarbeiter gefunden.")
    } else {
      const lines = employees.map(e => {
        const connected = e.telegram_chat_id ? "🟢" : "🔴"
        return `${connected} <b>${e.name}</b> — ${e.role ?? "Mitarbeiter"}`
      }).join("\n")
      await send(chatId, `👥 <b>Mitarbeiter (${employees.length})</b>\n\n${lines}`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── /report ──────────────────────────────────────────────────
  if (text.startsWith("/report")) {
    const today = new Date().toISOString().slice(0, 10)

    const [{ data: posts }, { data: problems }, { data: employees }] = await Promise.all([
      supabase.from("posting_schedule").select("status").eq("send_date", today).neq("status", "wartet"),
      supabase.from("account_pairs").select("ig_username, fb_username, status").in("status", ["restricted", "banned"]),
      supabase.from("employees").select("name, telegram_chat_id"),
    ])

    const totalPosts    = posts?.length ?? 0
    const postedCount   = posts?.filter(p => p.status === "gepostet").length ?? 0
    const problemCount  = problems?.length ?? 0
    const connectedEmps = employees?.filter(e => e.telegram_chat_id).length ?? 0

    await send(chatId,
      `📋 <b>Tages-Report — ${today}</b>\n\n` +
      `📲 Posts: ${postedCount}/${totalPosts} gepostet\n` +
      `⚠️ Account-Probleme: ${problemCount}\n` +
      `👥 Mitarbeiter online: ${connectedEmps}/${employees?.length ?? 0}\n\n` +
      (problemCount > 0 ? `Tippe /status für Details zu den Problemen.` : `✅ Alles läuft gut heute.`)
    )
    return NextResponse.json({ ok: true })
  }

  // ── Default: unbekannte Nachricht ────────────────────────────
  await send(chatId,
    `Ich verstehe das noch nicht. Tippe /hilfe für alle Befehle.\n\n<i>AI-Freitext kommt bald.</i>`
  )

  return NextResponse.json({ ok: true })
}
