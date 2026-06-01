import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { isCronAuthorized } from "@/lib/supabase/auth-server"

export async function GET(request: Request) {
  if (!isCronAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data } = await supabase
    .from("employees")
    .select("id, name, telegram_chat_id, telegram_posting_thread_id, telegram_fb_thread_id")
    .order("name")
  return NextResponse.json(data)
}
