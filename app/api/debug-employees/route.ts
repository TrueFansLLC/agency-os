import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data } = await supabase
    .from("employees")
    .select("id, name, telegram_chat_id, telegram_posting_thread_id, telegram_fb_thread_id")
    .order("name")
  return NextResponse.json(data)
}
