import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"
import { isCronAuthorized } from "@/lib/supabase/auth-server"

const BANGKOK_UTC_OFFSET = 7

export async function GET(request: Request) {
  const force      = new URL(request.url).searchParams.get("force") === "true"

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const now      = new Date()

  // Only send at 18:xx Bangkok time (bypass with ?force=true)
  const bangkokHour = (now.getUTCHours() + BANGKOK_UTC_OFFSET) % 24
  if (!force && bangkokHour !== 18) {
    return NextResponse.json({ ok: true, skipped: "not greeting hour", bangkokHour })
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("name, telegram_chat_id, telegram_posting_thread_id, telegram_fb_thread_id")
    .not("telegram_chat_id", "is", null)

  if (!employees?.length) return NextResponse.json({ ok: true, sent: 0 })

  const today = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })

  let sent = 0
  for (const emp of employees) {
    const firstName = emp.name?.split(" ")[0] ?? "there"
    const text = `👋 Hi ${firstName}!\n\n📅 <b>${today}</b>\n\nYour new posts for today are coming right up. Schedule them as soon as you receive them — they'll go live automatically at the right time.\n\nIf anything looks wrong or you have a problem, just write in the <b>General Group</b>. 💬`

    // Send to IG Posts topic
    if (emp.telegram_posting_thread_id) {
      await sendMessage(emp.telegram_chat_id, text, emp.telegram_posting_thread_id)
      sent++
    }

    // Send to FB Posts topic (if different from IG)
    if (emp.telegram_fb_thread_id && emp.telegram_fb_thread_id !== emp.telegram_posting_thread_id) {
      await sendMessage(emp.telegram_chat_id, text, emp.telegram_fb_thread_id)
      sent++
    }

    // Fallback: no topics, just send to main chat
    if (!emp.telegram_posting_thread_id && !emp.telegram_fb_thread_id) {
      await sendMessage(emp.telegram_chat_id, text)
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent, employees: employees.length })
}
