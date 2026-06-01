import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"
import { isCronAuthorized } from "@/lib/supabase/auth-server"

const BANGKOK_UTC_OFFSET = 7
const CHECK_DAY          = 1  // Monday (cron fires Mon 02:00 UTC = 09:00 Bangkok)

const INSTRUCTION =
  "Please send 4 screenshots from Insights for <b>EACH</b> account:\n" +
  "  1️⃣ 7 days – Views\n  2️⃣ 7 days – Countries\n  3️⃣ 30 days – Views\n  4️⃣ 30 days – Countries"

export async function GET(request: Request) {
  const force      = new URL(request.url).searchParams.get("force") === "true"

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const bkk = new Date(now.getTime() + BANGKOK_UTC_OFFSET * 3600 * 1000)
  if (!force && bkk.getUTCDay() !== CHECK_DAY) {
    return NextResponse.json({ ok: true, skipped: "not Monday", bkkDay: bkk.getUTCDay() })
  }

  const supabase  = createServerClient()
  const weekStart = bkk.toISOString().slice(0, 10)  // Monday's date

  const { data: employees } = await supabase
    .from("employees")
    .select("name, telegram_chat_id, telegram_ig_weekly_thread_id, telegram_fb_weekly_thread_id")
    .not("telegram_chat_id", "is", null)

  if (!employees || !employees.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0

  for (const emp of employees) {
    const empName = emp.name ?? ""
    if (!empName) continue

    const { data: pairs } = await supabase
      .from("account_pairs")
      .select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter, status, archived")
      .or(`ig_mitarbeiter.ilike.%${empName}%,fb_mitarbeiter.ilike.%${empName}%`)

    if (!pairs || !pairs.length) continue

    // Banned accounts drop out of the count; restricted stays in.
    const active = pairs.filter(p => p.status !== "banned" && p.archived !== true)

    const igAccounts = active
      .filter(p => p.ig_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.ig_username)
      .map(p => p.ig_username!)

    const fbAccounts = active
      .filter(p => p.fb_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.fb_username)
      .map(p => p.fb_username!)

    // ── IG weekly ─────────────────────────────────────────────────
    if (emp.telegram_ig_weekly_thread_id && igAccounts.length > 0) {
      const expected = igAccounts.length * 4
      const names    = igAccounts.map(u => `• @${u}`).join("\n")
      await sendMessage(
        emp.telegram_chat_id,
        `📈 <b>Weekly Stats — Instagram</b>\n\n${INSTRUCTION}\n\n<b>Your accounts (${igAccounts.length}):</b>\n${names}\n\n➡️ Total expected: <b>${igAccounts.length} × 4 = ${expected}</b> screenshots`,
        emp.telegram_ig_weekly_thread_id
      )
      await supabase.from("weekly_stats_screenshots").upsert({
        employee_name:  empName,
        week_start:     weekStart,
        platform:       "ig",
        expected_count: expected,
        received_count: 0,
        check_sent_at:  now.toISOString(),
        chat_id:        emp.telegram_chat_id,
        thread_id:      emp.telegram_ig_weekly_thread_id,
      }, { onConflict: "employee_name,week_start,platform" })
      sent++
    }

    // ── FB weekly ─────────────────────────────────────────────────
    if (emp.telegram_fb_weekly_thread_id && fbAccounts.length > 0) {
      const expected = fbAccounts.length * 4
      const names    = fbAccounts.map(u => `• @${u}`).join("\n")
      await sendMessage(
        emp.telegram_chat_id,
        `📈 <b>Weekly Stats — Facebook</b>\n\n${INSTRUCTION}\n\n<b>Your accounts (${fbAccounts.length}):</b>\n${names}\n\n➡️ Total expected: <b>${fbAccounts.length} × 4 = ${expected}</b> screenshots`,
        emp.telegram_fb_weekly_thread_id
      )
      await supabase.from("weekly_stats_screenshots").upsert({
        employee_name:  empName,
        week_start:     weekStart,
        platform:       "fb",
        expected_count: expected,
        received_count: 0,
        check_sent_at:  now.toISOString(),
        chat_id:        emp.telegram_chat_id,
        thread_id:      emp.telegram_fb_weekly_thread_id,
      }, { onConflict: "employee_name,week_start,platform" })
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}
