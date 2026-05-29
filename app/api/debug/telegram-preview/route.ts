import { NextResponse } from "next/server"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ""
const OWNER = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

async function send(chatId: string, text: string, keyboard?: object[][]) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  }
  if (keyboard) {
    body.reply_markup = { inline_keyboard: keyboard }
  }
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function GET() {
  if (!TOKEN || !OWNER) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 })
  }

  const accounts = ["Cathyycampp", "Rominaonthestreet", "Romina domm", "Romina speakss", "neylasraanch", "Neylaspeekss", "Cathysfarm"]
  const list = accounts.map(a => `• @${a}`).join("\n")

  // Message 1: New "Alle Active" design
  await send(OWNER,
    `📊 <b>FB Daily Check — Do., 29 Mai</b>\n\n${list}\n\n<i>Tap ✅ wenn alle Accounts heute erreichbar sind. Tap ⚠️ wenn ein Account ein Problem hat.</i>`,
    [
      [
        { text: "✅ Alle Active", callback_data: "_" },
        { text: "⚠️ Problem melden", callback_data: "_" },
      ]
    ]
  )

  // Message 2: What "Problem melden" would look like — one account at a time
  await send(OWNER,
    `⬆️ <b>So sieht der Normaltag aus — 1 Tap fertig.</b>\n\nWenn du auf ⚠️ <b>Problem melden</b> tippst, kommen die Accounts einzeln:\n\n👇`,
  )

  await send(OWNER,
    `<b>@Cathysfarm</b> — Facebook\n\nWelcher Status?`,
    [
      [
        { text: "✅ Active", callback_data: "_" },
        { text: "🟠 Restricted", callback_data: "_" },
        { text: "🔴 Banned", callback_data: "_" },
      ]
    ]
  )

  await send(OWNER,
    `<b>@neylasraanch</b> — Facebook\n\nWelcher Status?`,
    [
      [
        { text: "✅ Active", callback_data: "_" },
        { text: "🟠 Restricted", callback_data: "_" },
        { text: "🔴 Banned", callback_data: "_" },
      ]
    ]
  )

  await send(OWNER,
    `⬆️ <b>Einzelne Nachrichten pro Account.</b> Kein Multi-Select möglich — jeder Account ist isoliert. Nach dem Tap collapsed die Nachricht zu:\n\n🟠 @neylasraanch — ✓ Restricted (Peter, 09:14)`,
  )

  return NextResponse.json({ ok: true })
}
