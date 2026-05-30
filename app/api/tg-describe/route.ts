import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"

// TEMPORARY — sends a description into every topic. Remove after use.
const TOKEN = "Qp9Wm3Zx7Lt2Rb8Kv5Nc1Hd4Yf6Sg0"

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get("t") !== TOKEN)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServerClient()
  const { data: employees } = await supabase
    .from("employees")
    .select(
      "name, telegram_chat_id, telegram_general_thread_id, telegram_posting_thread_id, telegram_fb_thread_id, telegram_ig_status_thread_id, telegram_fb_status_thread_id, telegram_ig_weekly_thread_id, telegram_fb_weekly_thread_id, telegram_salary_thread_id"
    )
    .not("telegram_chat_id", "is", null)

  if (!employees || !employees.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  const log: string[] = []

  for (const e of employees) {
    const n = e.name ?? "this employee"
    const topics: [number | null | undefined, string, string][] = [
      [e.telegram_general_thread_id,   "General",                `Hi ${n}! This is your General channel — for announcements and general communication. No automated posts here.`],
      [e.telegram_posting_thread_id,   "Instagram Posts",        `Instagram Posts for ${n}. The bot sends your daily IG posts here — tap ✅ Scheduled once each one is scheduled.`],
      [e.telegram_fb_thread_id,        "Facebook Posts",         `Facebook Posts for ${n}. The bot sends your daily FB posts here — tap ✅ Scheduled once each one is scheduled.`],
      [e.telegram_ig_status_thread_id, "Instagram Status",       `Instagram Account Status for ${n}. Daily check — confirm your accounts are active and send the requested screenshots here.`],
      [e.telegram_fb_status_thread_id, "Facebook Status",        `Facebook Account Status for ${n}. Daily check — confirm your accounts are active and send the requested screenshots here.`],
      [e.telegram_ig_weekly_thread_id, "Instagram Weekly Stats", `Instagram Weekly Stats for ${n}. Every Monday: send 4 insight screenshots per account (7d Views, 7d Countries, 30d Views, 30d Countries).`],
      [e.telegram_fb_weekly_thread_id, "Facebook Weekly Stats",  `Facebook Weekly Stats for ${n}. Every Monday: send 4 insight screenshots per account (7d Views, 7d Countries, 30d Views, 30d Countries).`],
      [e.telegram_salary_thread_id,    "Salary",                 `Salary topic for ${n}. On the 1st & 14th of each month you'll get a payment notice — confirm ✅ Received or report ❌ Not received.`],
    ]

    for (const [thread, label, desc] of topics) {
      if (!thread) continue
      await sendMessage(e.telegram_chat_id, `📌 <b>${label}</b>\n\n${desc}`, thread)
      sent++
      log.push(`${n} → ${label}`)
    }
  }

  return NextResponse.json({ ok: true, sent, log })
}
