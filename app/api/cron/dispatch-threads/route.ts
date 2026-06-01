import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"
import { buildThreadsStatusCheckMessage, THREADS_STATUS_BUTTONS } from "@/lib/threads-telegram"
import { isAdminUser, isCronAuthorized } from "@/lib/supabase/auth-server"

type SkipReason = {
  account: string
  reason: string
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request) && !(await isAdminUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const today    = getBangkokDate()

  const { data: batches, error } = await supabase
    .from("threads_daily_batches")
    .select("*, account:threads_accounts(*)")
    .eq("date", today)
    .eq("status", "ready")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let dispatched = 0
  const skipped: SkipReason[] = []

  for (const batch of batches ?? []) {
    const account = batch.account
    if (!account?.employee_id && !account?.mitarbeiter) {
      skipped.push({ account: account?.username ?? batch.account_id, reason: "No Threads employee assigned." })
      continue
    }
    if (account.status !== "active") {
      skipped.push({ account: account.username, reason: `Account status is ${account.status}. Posting is paused.` })
      continue
    }

    let employeeQuery = supabase
      .from("employees")
      .select("id, name, telegram_chat_id, telegram_threads_thread_id")
    employeeQuery = account.employee_id
      ? employeeQuery.eq("id", account.employee_id)
      : employeeQuery.ilike("name", account.mitarbeiter)

    const { data: emp } = await employeeQuery.maybeSingle()

    if (!emp) {
      skipped.push({ account: account.username, reason: `Employee "${account.mitarbeiter}" has not been added yet.` })
      continue
    }
    if (!emp.telegram_chat_id) {
      skipped.push({ account: account.username, reason: `${emp.name}: Telegram group missing.` })
      continue
    }
    if (!Number.isInteger(emp.telegram_threads_thread_id)) {
      skipped.push({ account: account.username, reason: `${emp.name}: Threads topic missing.` })
      continue
    }

    const msgId = await sendMessage(
      emp.telegram_chat_id,
      buildThreadsStatusCheckMessage(batch),
      emp.telegram_threads_thread_id,
      THREADS_STATUS_BUTTONS(batch.id)
    )

    if (msgId) {
      await supabase
        .from("threads_daily_batches")
        .update({
          status:             "sent",
          telegram_message_id: msgId,
          chat_id:            emp.telegram_chat_id,
          thread_id:          emp.telegram_threads_thread_id,
          dispatched_at:      new Date().toISOString(),
        })
        .eq("id", batch.id)
      dispatched++
    } else {
      skipped.push({ account: account.username, reason: "Telegram delivery failed." })
    }
  }

  return NextResponse.json({ ok: true, dispatched, skipped, date: today })
}

function getBangkokDate() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}
