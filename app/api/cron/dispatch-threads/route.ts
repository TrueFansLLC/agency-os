import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"
import { getPostingTimes } from "@/types/threads"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const today    = new Date().toISOString().slice(0, 10)

  const { data: batches, error } = await supabase
    .from("threads_daily_batches")
    .select("*, account:threads_accounts(*)")
    .eq("date", today)
    .eq("status", "ready")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let dispatched = 0

  for (const batch of batches ?? []) {
    const account = batch.account
    if (!account?.mitarbeiter) continue

    const { data: emp } = await supabase
      .from("employees")
      .select("telegram_chat_id, telegram_posting_thread_id")
      .ilike("name", `%${account.mitarbeiter}%`)
      .maybeSingle()

    if (!emp?.telegram_chat_id) continue

    const times   = getPostingTimes(batch.posts_count)
    const timeStr = times.join(" / ")
    const label   = `${account.creator}${account.branding ? ` · ${account.branding}` : ""}`

    const lines = [
      `📱 <b>Threads — @${account.username}</b>`,
      `📅 Today: <b>${batch.posts_count} Posts</b> (${label})`,
      `🕘 Times: ${timeStr} (Bangkok)`,
      `📁 <a href="${batch.drive_folder_url}">Open Google Drive folder</a>`,
      ``,
      `——————————————`,
      `📌 Format: 2 images each as a carousel + caption`,
      `💡 Caption: copy a viral post from your FYP (1000+ likes in 24h)`,
      `⚠️ Use each image only <b>once</b> — delete it immediately after posting!`,
      `——————————————`,
      ``,
      `✅ Reply with <b>✅</b> once all ${batch.posts_count} posts are done.`,
    ]

    const msgId = await sendMessage(
      emp.telegram_chat_id,
      lines.join("\n"),
      emp.telegram_posting_thread_id ?? undefined
    )

    if (msgId) {
      await supabase
        .from("threads_daily_batches")
        .update({
          status:             "sent",
          telegram_message_id: msgId,
          chat_id:            emp.telegram_chat_id,
          dispatched_at:      new Date().toISOString(),
        })
        .eq("id", batch.id)
      dispatched++
    }
  }

  return NextResponse.json({ ok: true, dispatched, date: today })
}
