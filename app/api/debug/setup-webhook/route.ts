import { NextResponse } from "next/server"

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: "No token" }, { status: 500 })

  const webhookUrl = "https://agency-os-q29n.vercel.app/api/telegram/webhook"

  const res  = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
  })
  const data = await res.json()

  const info     = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const infoData = await info.json()

  return NextResponse.json({
    set:     data.ok,
    webhook: infoData.result?.url,
    pending: infoData.result?.pending_update_count,
  })
}
