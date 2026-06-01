import { NextResponse } from "next/server"

import { requireAnyPageAccess } from "@/lib/supabase/auth-server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireAnyPageAccess(["tracker", "posting-planer", "employees"])
  if (auth.response) return auth.response

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, telegram_chat_id, telegram_threads_thread_id, telegram_threads_status_thread_id")
    .eq("platform", "threads")
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    (data ?? []).map((employee) => {
      const telegramConnected = Boolean(employee.telegram_chat_id)
      const topicConfigured = Number.isInteger(employee.telegram_threads_thread_id)

      return {
        id: employee.id,
        name: employee.name,
        telegram_connected: telegramConnected,
        threads_topic_configured: topicConfigured,
        status_topic_configured: Number.isInteger(employee.telegram_threads_status_thread_id),
        ready: telegramConnected && topicConfigured,
      }
    })
  )
}
