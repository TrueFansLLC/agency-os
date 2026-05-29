import { NextResponse } from "next/server"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ""
const OWNER = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

async function send(text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: OWNER, text, parse_mode: "HTML" }),
  })
}

export async function GET() {
  if (!TOKEN || !OWNER) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 })
  }

  await send(`——— 📌 Topic: <b>IG Posts</b> ———`)
  await send(`📲 <b>Instagram Posts</b>

Hier bekommst du täglich deine Reels zum Planen.

Sobald du einen Post in Creator Studio geplant hast → tippe ✅ <b>Scheduled</b> auf die Nachricht.

Falls ein Account eingeschränkt oder gesperrt ist → tippe 🟠 <b>Restricted</b> oder 🔴 <b>Banned</b> direkt auf die Post-Nachricht.`)

  await send(`——— 📌 Topic: <b>FB Posts</b> ———`)
  await send(`📲 <b>Facebook Posts</b>

Hier bekommst du täglich deine Facebook Videos zum Planen.

Sobald du einen Post geplant hast → tippe ✅ <b>Scheduled</b> auf die Nachricht.

Falls eine Seite eingeschränkt oder gesperrt ist → tippe 🟠 <b>Restricted</b> oder 🔴 <b>Banned</b> direkt auf die Post-Nachricht.`)

  await send(`——— 📌 Topic: <b>IG ACC Status</b> ———`)
  await send(`📊 <b>Instagram Account Status</b>

Jeden Morgen kommt hier eine Nachricht mit allen deinen Instagram Accounts.

✅ Alle erreichbar → tippe <b>Alle Active</b>
⚠️ Ein Account hat ein Problem → tippe <b>Problem melden</b>

Danach bitte einen Screenshot von jedem Account schicken als Beweis.`)

  await send(`——— 📌 Topic: <b>FB ACC Status</b> ———`)
  await send(`📊 <b>Facebook Account Status</b>

Jeden Morgen kommt hier eine Nachricht mit allen deinen Facebook Seiten.

✅ Alle erreichbar → tippe <b>Alle Active</b>
⚠️ Eine Seite hat ein Problem → tippe <b>Problem melden</b>

Danach bitte einen Screenshot von jeder Seite schicken als Beweis.`)

  return NextResponse.json({ ok: true })
}
