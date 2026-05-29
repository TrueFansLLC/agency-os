import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const TOKEN         = process.env.RAFAEL_BOT_TOKEN ?? ""
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""

async function send(text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text, parse_mode: "HTML" }),
  })
}

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "true"
  const auth  = request.headers.get("authorization")

  if (auth !== `Bearer ${process.env.CRON_SECRET}` && !force) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const today    = new Date().toISOString().slice(0, 10)
  const weekAgo  = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)

  const [
    { data: problems },
    { data: todayPosts },
    { data: weekPosts },
    { data: employees },
    { data: igAccounts },
    { data: fbAccounts },
    { data: igSnaps },
    { data: fbSnaps },
  ] = await Promise.all([
    supabase.from("account_pairs").select("ig_username, fb_username, status, status_note").in("status", ["restricted", "banned"]),
    supabase.from("posting_schedule").select("account, platform, status").eq("send_date", today).neq("status", "wartet"),
    supabase.from("posting_schedule").select("status").gte("send_date", weekAgo).neq("status", "wartet"),
    supabase.from("employees").select("name, telegram_chat_id"),
    supabase.from("instagram_accounts").select("id, username").eq("archived", false),
    supabase.from("facebook_accounts").select("id, username").eq("archived", false),
    supabase.from("instagram_metric_snapshots").select("account_id, followers, views").gte("date", weekAgo).order("date", { ascending: false }),
    supabase.from("facebook_metric_snapshots").select("account_id, followers, video_views").gte("date", weekAgo).order("date", { ascending: false }),
  ])

  const weekPosted = weekPosts?.filter(p => p.status === "gepostet").length ?? 0
  const weekTotal  = weekPosts?.length ?? 0
  const weekRate   = weekTotal > 0 ? Math.round(weekPosted / weekTotal * 100) : 0

  const igLatest: Record<string, number> = {}
  for (const s of igSnaps ?? []) {
    if (!igLatest[s.account_id]) igLatest[s.account_id] = s.followers ?? 0
  }
  const fbLatest: Record<string, number> = {}
  for (const s of fbSnaps ?? []) {
    if (!fbLatest[s.account_id]) fbLatest[s.account_id] = s.followers ?? 0
  }

  const totalIgFollowers = Object.values(igLatest).reduce((a, b) => a + b, 0)
  const totalFbFollowers = Object.values(fbLatest).reduce((a, b) => a + b, 0)

  const context = `
Heute: ${today}
Posts heute geplant: ${todayPosts?.length ?? 0}
Diese Woche: ${weekPosted}/${weekTotal} Posts gepostet (${weekRate}% Rate)
Account-Probleme: ${problems?.length ?? 0}
${problems?.length ? problems.map(p => `- @${p.ig_username ?? p.fb_username}: ${p.status}`).join("\n") : "Keine"}
Instagram Accounts: ${igAccounts?.length ?? 0} | Gesamt Follower: ${totalIgFollowers.toLocaleString()}
Facebook Accounts: ${fbAccounts?.length ?? 0} | Gesamt Follower: ${totalFbFollowers.toLocaleString()}
Mitarbeiter online: ${employees?.filter(e => e.telegram_chat_id).length ?? 0}/${employees?.length ?? 0}
`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `Du bist Rafael, AI-Assistent für Elijah Bulut (TrueFans LLC Creator Agency).
Schreibe einen kurzen, prägnanten Morgen-Report auf Deutsch.
Format: Begrüßung + 3-4 wichtigste Punkte + eine konkrete Empfehlung für heute.
Nutze HTML für Telegram (<b>fett</b>). Keine Markdown. Max 300 Wörter.`,
      messages: [{ role: "user", content: `Hier sind die aktuellen Daten. Erstelle den Morgen-Report:\n${context}` }],
    }),
  })
  const ai   = await res.json()
  const text = ai.content?.[0]?.text ?? "Fehler beim Erstellen des Reports."

  await send(`🌅 <b>Guten Morgen, Elijah!</b>\n\n${text}`)

  return NextResponse.json({ ok: true })
}
