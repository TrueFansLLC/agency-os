import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"

// Telegram sends every message to this URL.
// When an employee writes /start, we save their chat_id to the employees table.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const message = body.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId   = String(message.chat.id)
  const text     = message.text ?? ""
  const firstName = message.from?.first_name ?? ""
  const lastName  = message.from?.last_name ?? ""
  const fullName  = [firstName, lastName].filter(Boolean).join(" ")

  if (text.startsWith("/start")) {
    const supabase = createServerClient()

    // Try to match employee by Telegram name or update by chat_id
    const { data: existing } = await supabase
      .from("employees")
      .select("id, name")
      .eq("telegram_chat_id", chatId)
      .maybeSingle()

    if (!existing) {
      // Save chat_id — admin will link it to the right employee via dashboard
      await supabase
        .from("employees")
        .upsert({ telegram_chat_id: chatId, name: fullName }, { onConflict: "telegram_chat_id" })
    }

    await sendMessage(chatId,
      `👋 Hallo ${firstName}!\n\nDu bist jetzt mit dem Agency Bot verbunden.\nSobald ein Post für dich freigegeben wird, bekommst du ihn automatisch hier.`
    )
  }

  return NextResponse.json({ ok: true })
}
