import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"

const BANGKOK_UTC_OFFSET = 7
const CHECK_HOUR         = 9  // 09:00 Bangkok = 10:00 Philippines

function statusIcon(s: string) { return s === "banned" ? "🔴" : s === "restricted" ? "🟠" : "🟢" }

function buildKeyboard(accounts: { username: string; status: string }[], platform: "ig" | "fb") {
  return accounts.map(acc => {
    const name  = acc.username.slice(0, 25)
    const icon  = acc.status === "banned" ? "🔴" : acc.status === "restricted" ? "🟠" : "✅"
    const label = acc.status === "banned" ? "Banned" : acc.status === "restricted" ? "Restricted" : "Active"
    return [{ text: `${icon}  ${name}  —  ${label}`, callback_data: `sc:${platform}:${name}` }]
  })
}

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

  const supabase  = createServerClient()
  const today     = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })
  const todayStr  = now.toISOString().slice(0, 10)

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
      .select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter, status")
      .or(`ig_mitarbeiter.ilike.%${empName}%,fb_mitarbeiter.ilike.%${empName}%`)

    if (!pairs?.length) continue

    const igAccounts = pairs
      .filter(p => p.ig_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.ig_username)
      .map(p => ({ username: p.ig_username!, status: p.status ?? "active" }))

    const fbAccounts = pairs
      .filter(p => p.fb_mitarbeiter?.toLowerCase().includes(empName.toLowerCase()) && p.fb_username)
      .map(p => ({ username: p.fb_username!, status: p.status ?? "active" }))

    // ── IG status check ──────────────────────────────────────────
    if (emp.telegram_ig_status_thread_id && igAccounts.length > 0) {
      const keyboard = buildKeyboard(igAccounts, "ig")
      await sendMessage(
        emp.telegram_chat_id,
        `📊 <b>Daily Account Check — ${today}</b>\n\nSet the current status for each account:`,
        emp.telegram_ig_status_thread_id,
        keyboard
      )

      // Expected screenshots = non-banned accounts
      const expectedIg = igAccounts.filter(a => a.status !== "banned").length
      const screenshotMsg = buildScreenshotInstruction(igAccounts, "Instagram", expectedIg)
      await sendMessage(emp.telegram_chat_id, screenshotMsg, emp.telegram_ig_status_thread_id)

      // Store tracking record
      await supabase.from("daily_status_screenshots").upsert({
        employee_name: empName,
        date: todayStr,
        platform: "ig",
        expected_count: expectedIg,
        received_count: 0,
        check_sent_at: now.toISOString(),
        chat_id: emp.telegram_chat_id,
        thread_id: emp.telegram_ig_status_thread_id,
      }, { onConflict: "employee_name,date,platform" })

      sent++
    }

    // ── FB status check ──────────────────────────────────────────
    if (emp.telegram_fb_status_thread_id && fbAccounts.length > 0) {
      const keyboard = buildKeyboard(fbAccounts, "fb")
      await sendMessage(
        emp.telegram_chat_id,
        `📊 <b>Daily Account Check — ${today}</b>\n\nSet the current status for each account:`,
        emp.telegram_fb_status_thread_id,
        keyboard
      )

      const expectedFb = fbAccounts.filter(a => a.status !== "banned").length
      const screenshotMsg = buildScreenshotInstruction(fbAccounts, "Facebook", expectedFb)
      await sendMessage(emp.telegram_chat_id, screenshotMsg, emp.telegram_fb_status_thread_id)

      await supabase.from("daily_status_screenshots").upsert({
        employee_name: empName,
        date: todayStr,
        platform: "fb",
        expected_count: expectedFb,
        received_count: 0,
        check_sent_at: now.toISOString(),
        chat_id: emp.telegram_chat_id,
        thread_id: emp.telegram_fb_status_thread_id,
      }, { onConflict: "employee_name,date,platform" })

      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}

function buildScreenshotInstruction(
  accounts: { username: string; status: string }[],
  platform: string,
  expected: number
) {
  const activeList = accounts
    .filter(a => a.status !== "banned")
    .map(a => `• ${a.username}${a.status === "restricted" ? " 🟠" : ""}`)
    .join("\n")

  return [
    `📸 <b>Now send screenshots for each active ${platform} account (${expected} expected):</b>\n`,
    activeList,
    `\n<b>One screenshot per account</b> showing the account is accessible.`,
    `Screenshots must be sent in this topic within the next 2 hours.`,
  ].join("\n")
}
