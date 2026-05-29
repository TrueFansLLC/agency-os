import { NextResponse } from "next/server"

export async function GET() {
  const token  = process.env.RAFAEL_BOT_TOKEN
  const owner  = process.env.TELEGRAM_OWNER_CHAT_ID

  if (!token) return NextResponse.json({ error: "RAFAEL_BOT_TOKEN missing" })
  if (!owner) return NextResponse.json({ error: "TELEGRAM_OWNER_CHAT_ID missing" })

  const res  = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: owner, text: "✅ Rafael Test — Token & Owner ID funktionieren." }),
  })
  const data = await res.json()

  return NextResponse.json({ ok: data.ok, error: data.description ?? null, owner_id: owner, token_prefix: token.slice(0, 8) + "..." })
}
