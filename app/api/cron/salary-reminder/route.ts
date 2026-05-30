import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"

const BANGKOK_UTC_OFFSET = 7
const PAY_DAYS           = [1, 14]  // 1st and 14th of each month

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const force      = new URL(request.url).searchParams.get("force") === "true"

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !force) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const bkk = new Date(now.getTime() + BANGKOK_UTC_OFFSET * 3600 * 1000)
  if (!force && !PAY_DAYS.includes(bkk.getUTCDate())) {
    return NextResponse.json({ ok: true, skipped: "not a pay day", day: bkk.getUTCDate() })
  }

  const supabase = createServerClient()
  const { data: employees } = await supabase
    .from("employees")
    .select("name, telegram_chat_id, telegram_salary_thread_id")
    .not("telegram_chat_id", "is", null)

  if (!employees || !employees.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  for (const emp of employees) {
    if (!emp.telegram_salary_thread_id) continue
    await sendMessage(
      emp.telegram_chat_id,
      `💰 <b>Salary</b>\n\nYour salary will be paid within the next <b>12 hours</b>.\n\nIf nothing has arrived by then, please tap <b>❌ Not received</b> below so we can look into it right away.`,
      emp.telegram_salary_thread_id,
      [[
        { text: "✅ Received",     callback_data: "sal:ok" },
        { text: "❌ Not received", callback_data: "sal:no" },
      ]]
    )
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
