import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"

const BANGKOK_UTC_OFFSET = 7
const CHECK_HOUR         = 9  // 09:00 Bangkok = 10:00 Philippines

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const force      = new URL(request.url).searchParams.get("force") === "true"

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !force) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now         = new Date()
  const bangkokHour = (now.getUTCHours() + BANGKOK_UTC_OFFSET) % 24
  if (!force && bangkokHour !== CHECK_HOUR) {
    return NextResponse.json({ ok: true, skipped: "not check hour", bangkokHour })
  }

  const supabase = createServerClient()
  const today    = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })
  const todayStr = now.toISOString().slice(0, 10)

  const { data: employees } = await supabase
    .from("employees")
    .select("name, telegram_chat_id, telegram_ig_status_thread_id, telegram_fb_status_thread_id")
    .not("telegram_chat_id", "is", null)

  if (!employees?.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0

  for (const emp of employees) {
    const empName = emp.name ?? ""

    const { data: pairs } = await supabase
      .from("account_pairs")
      .select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter")
      .or(`ig_mitarbeiter.ilike.%${empName}%,fb_mitarbeiter.ilike.%${empName}%`)

    if (!pairs?.length) continue

    const igAccounts = pairs
      .filter(p => p.ig_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.ig_username)
      .map(p => p.ig_username!)

    const fbAccounts = pairs
      .filter(p => p.fb_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.fb_username)
      .map(p => p.fb_username!)

    // ── IG status check ──────────────────────────────────────────
    if (emp.telegram_ig_status_thread_id && igAccounts.length > 0) {
      const names = igAccounts.map(u => `• @${u}`).join("\n")
      await sendMessage(
        emp.telegram_chat_id,
        `📊 <b>IG Daily Check — ${today}</b>\n\n${names}\n\n<i>Sind heute alle Accounts erreichbar?</i>`,
        emp.telegram_ig_status_thread_id,
        [[
          { text: "✅ Alle Active",     callback_data: "aa:ig" },
          { text: "⚠️ Problem melden", callback_data: "pm:ig" },
        ]]
      )

      await supabase.from("daily_status_screenshots").upsert({
        employee_name:  empName,
        date:           todayStr,
        platform:       "ig",
        expected_count: igAccounts.length,
        received_count: 0,
        check_sent_at:  now.toISOString(),
        chat_id:        emp.telegram_chat_id,
        thread_id:      emp.telegram_ig_status_thread_id,
      }, { onConflict: "employee_name,date,platform" })

      sent++
    }

    // ── FB status check ──────────────────────────────────────────
    if (emp.telegram_fb_status_thread_id && fbAccounts.length > 0) {
      const names = fbAccounts.map(u => `• @${u}`).join("\n")
      await sendMessage(
        emp.telegram_chat_id,
        `📊 <b>FB Daily Check — ${today}</b>\n\n${names}\n\n<i>Sind heute alle Accounts erreichbar?</i>`,
        emp.telegram_fb_status_thread_id,
        [[
          { text: "✅ Alle Active",     callback_data: "aa:fb" },
          { text: "⚠️ Problem melden", callback_data: "pm:fb" },
        ]]
      )

      await supabase.from("daily_status_screenshots").upsert({
        employee_name:  empName,
        date:           todayStr,
        platform:       "fb",
        expected_count: fbAccounts.length,
        received_count: 0,
        check_sent_at:  now.toISOString(),
        chat_id:        emp.telegram_chat_id,
        thread_id:      emp.telegram_fb_status_thread_id,
      }, { onConflict: "employee_name,date,platform" })

      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}
