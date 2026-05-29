import { NextResponse } from "next/server"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ""
const OWNER = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

export async function GET() {
  if (!TOKEN) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN missing" })
  if (!OWNER) return NextResponse.json({ error: "TELEGRAM_OWNER_CHAT_ID missing" })

  // Check bot is alive
  const meRes  = await fetch(`https://api.telegram.org/bot${TOKEN}/getMe`)
  const meData = await meRes.json()

  // Try sending a test message
  const sendRes  = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: OWNER, text: "✅ Test — Bot funktioniert!" }),
  })
  const sendData = await sendRes.json()

  return NextResponse.json({
    bot:        meData.ok ? meData.result.username : "bot error",
    owner_id:   OWNER.slice(0, 4) + "****",
    send_ok:    sendData.ok,
    send_error: sendData.ok ? null : sendData.description,
  })
}
