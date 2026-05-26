import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"
import { markAsConfirmed } from "@/lib/notion"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const message = body.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId    = String(message.chat.id)
  const text      = (message.text ?? "").trim()
  const firstName = message.from?.first_name ?? ""
  const fullName  = [firstName, message.from?.last_name ?? ""].filter(Boolean).join(" ")
  const replyToId = message.reply_to_message?.message_id ?? null

  const supabase = createServerClient()

  // ── /start: register employee ────────────────────────────────────
  if (text.startsWith("/start")) {
    const { data: existing } = await supabase
      .from("employees")
      .select("id, name")
      .eq("telegram_chat_id", chatId)
      .maybeSingle()

    if (!existing) {
      await supabase
        .from("employees")
        .upsert({ telegram_chat_id: chatId, name: fullName }, { onConflict: "telegram_chat_id" })
    }

    await sendMessage(chatId,
      `👋 Hallo ${firstName}!\n\nDu bist jetzt mit dem Agency Bot verbunden.\nSobald ein Post für dich bereit ist, bekommst du ihn automatisch hier.\n\n<b>Wichtig:</b> Antworte auf den jeweiligen Post-Nachrichten mit ✅ wenn du gepostet hast.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Confirmation: reply to a bot message ─────────────────────────
  if (replyToId) {
    const { data: log } = await supabase
      .from("post_dispatch_log")
      .select("*")
      .eq("telegram_message_id", replyToId)
      .eq("chat_id", chatId)
      .is("confirmed_at", null)
      .maybeSingle()

    if (log) {
      await supabase
        .from("post_dispatch_log")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("id", log.id)

      await markAsConfirmed(log.notion_page_id)

      await sendMessage(chatId,
        `✅ Danke! Post für <b>${log.account}</b> (${log.platform}) wurde als gepostet vermerkt.`,
        log.thread_id ?? undefined
      )
    }
  }

  return NextResponse.json({ ok: true })
}
