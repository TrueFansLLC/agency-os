const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const BASE      = `https://api.telegram.org/bot${BOT_TOKEN}`

type InlineButton = { text: string; callback_data: string }
type InlineKeyboard = InlineButton[][]

export async function sendMessage(
  chatId: string,
  text: string,
  threadId?: number,
  keyboard?: InlineKeyboard
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id:           chatId,
    text,
    parse_mode:        "HTML",
    message_thread_id: threadId,
  }
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard }

  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return data.ok ? data.result.message_id : null
}

export async function editMessage(
  chatId: string,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id:    chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  }
  if (keyboard !== undefined) body.reply_markup = { inline_keyboard: keyboard }

  const res = await fetch(`${BASE}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return data.ok
}

export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await fetch(`${BASE}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

export async function editMessageKeyboard(
  chatId: string,
  messageId: number,
  keyboard: InlineKeyboard
): Promise<void> {
  await fetch(`${BASE}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:      chatId,
      message_id:   messageId,
      reply_markup: { inline_keyboard: keyboard },
    }),
  })
}

export async function sendVideo(
  chatId: string,
  videoUrl: string,
  caption: string,
  threadId?: number
): Promise<number | null> {
  const res = await fetch(`${BASE}/sendVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:           chatId,
      video:             videoUrl,
      caption,
      parse_mode:        "HTML",
      message_thread_id: threadId,
    }),
  })
  const data = await res.json()
  if (data.ok) return data.result.message_id

  // Fallback: send as link if direct video fails (e.g. Google Drive)
  return sendMessage(chatId, `${caption}\n\n🎬 <a href="${videoUrl}">Video öffnen</a>`, threadId)
}
