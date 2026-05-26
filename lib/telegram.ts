const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const BASE      = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function sendMessage(chatId: string, text: string, threadId?: number): Promise<number | null> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:           chatId,
      text,
      parse_mode:        "HTML",
      message_thread_id: threadId,
    }),
  })
  const data = await res.json()
  return data.ok ? data.result.message_id : null
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
