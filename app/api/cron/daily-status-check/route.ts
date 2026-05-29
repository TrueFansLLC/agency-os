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

  // Temporarily disabled — redesign in progress
  return NextResponse.json({ ok: true, skipped: "disabled" })
}
