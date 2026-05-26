import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"

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
    const { data: post } = await supabase
      .from("posting_schedule")
      .select("*")
      .eq("telegram_message_id", replyToId)
      .eq("chat_id", chatId)
      .neq("status", "gepostet")
      .maybeSingle()

    if (post) {
      await supabase
        .from("posting_schedule")
        .update({ status: "gepostet", confirmed_at: new Date().toISOString() })
        .eq("id", post.id)

      await sendMessage(chatId,
        `✅ Danke! R${post.reel_number} für <b>@${post.account}</b> (${post.platform}) wurde als gepostet vermerkt.`,
        post.thread_id ?? undefined
      )
    }
  }

  return NextResponse.json({ ok: true })
}
