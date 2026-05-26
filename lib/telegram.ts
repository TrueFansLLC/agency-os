const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function sendMessage(chatId: string, text: string) {
  await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
}

export async function sendVideo(chatId: string, videoUrl: string, caption: string) {
  const res = await fetch(`${BASE}/sendVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:   chatId,
      video:     videoUrl,
      caption:   caption,
      parse_mode: "HTML",
    }),
  })
  const data = await res.json()
  // If video URL doesn't work (e.g. Google Drive direct), fall back to text with link
  if (!data.ok) {
    await sendMessage(chatId, `${caption}\n\n🎬 <a href="${videoUrl}">Video öffnen</a>`)
  }
}
