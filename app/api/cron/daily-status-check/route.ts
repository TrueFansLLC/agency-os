import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"
import { isCronAuthorized } from "@/lib/supabase/auth-server"
import { buildThreadsDailyStatusMessage, THREADS_ACCOUNT_STATUS_BUTTONS } from "@/lib/threads-telegram"

const BANGKOK_UTC_OFFSET = 7
const CHECK_HOUR         = 7  // 07:00 Bangkok, before Threads dispatch at 08:00

export async function GET(request: Request) {
  const force      = new URL(request.url).searchParams.get("force") === "true"

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now         = new Date()
  const bangkokHour = (now.getUTCHours() + BANGKOK_UTC_OFFSET) % 24
  if (!force && bangkokHour !== CHECK_HOUR) {
    return NextResponse.json({ ok: true, skipped: "not check hour", bangkokHour })
  }

  const supabase = createServerClient()
  const today    = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })
  const todayStr = now.toISOString().slice(0, 10)

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, telegram_chat_id, telegram_ig_status_thread_id, telegram_fb_status_thread_id, telegram_threads_status_thread_id")
    .not("telegram_chat_id", "is", null)

  if (!employees || !employees.length) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0

  for (const emp of employees) {
    const empName = emp.name ?? ""

    const { data: pairs } = await supabase
      .from("account_pairs")
      .select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter")
      .or(`ig_mitarbeiter.ilike.%${empName}%,fb_mitarbeiter.ilike.%${empName}%`)

    const igAccounts = (pairs ?? [])
      .filter(p => p.ig_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.ig_username)
      .map(p => p.ig_username!)

    const fbAccounts = (pairs ?? [])
      .filter(p => p.fb_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.fb_username)
      .map(p => p.fb_username!)

    // ── IG status check ──────────────────────────────────────────
    if (emp.telegram_ig_status_thread_id && igAccounts.length > 0) {
      const names = igAccounts.map(u => `• @${u}`).join("\n")
      await sendMessage(
        emp.telegram_chat_id,
        `📊 <b>IG Daily Check — ${today}</b>\n\n${names}\n\n<i>Are all accounts reachable today?</i>`,
        emp.telegram_ig_status_thread_id,
        [[
          { text: "✅ All Active",      callback_data: "aa:ig" },
          { text: "⚠️ Report Problem", callback_data: "pm:ig" },
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
        `📊 <b>FB Daily Check — ${today}</b>\n\n${names}\n\n<i>Are all accounts reachable today?</i>`,
        emp.telegram_fb_status_thread_id,
        [[
          { text: "✅ All Active",      callback_data: "aa:fb" },
          { text: "⚠️ Report Problem", callback_data: "pm:fb" },
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

    // ── Threads status check ────────────────────────────────────
    if (emp.telegram_threads_status_thread_id) {
      const { data: threadsAccounts } = await supabase
        .from("threads_accounts")
        .select("id, username, creator, branding, status")
        .eq("employee_id", emp.id)
        .eq("archived", false)
        .order("username")

      if (threadsAccounts?.length) {
        await sendMessage(
          emp.telegram_chat_id,
          `📊 <b>Threads Daily Account Status — ${today}</b>\n\nCheck every account before posting. If an account is restricted or banned, report it immediately and do not publish anything.`,
          emp.telegram_threads_status_thread_id
        )

        for (const account of threadsAccounts) {
          await sendMessage(
            emp.telegram_chat_id,
            buildThreadsDailyStatusMessage(account),
            emp.telegram_threads_status_thread_id,
            THREADS_ACCOUNT_STATUS_BUTTONS(account.id, account.status)
          )
        }

        sent++
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
