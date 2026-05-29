const RAFAEL_TOKEN  = process.env.RAFAEL_BOT_TOKEN ?? ""
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""

async function rafaelSend(text: string) {
  if (!RAFAEL_TOKEN || !OWNER_CHAT_ID) return
  await fetch(`https://api.telegram.org/bot${RAFAEL_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text, parse_mode: "HTML" }),
  })
}

async function rafaelAI(prompt: string, context: string): Promise<string> {
  if (!ANTHROPIC_KEY) return prompt
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `Du bist Rafael, AI-Assistent für Elijah Buluts Creator Agency TrueFans LLC.
Antworte kurz auf Deutsch, max 5 Sätze. Nutze HTML für Telegram (<b>fett</b>).
Sei direkt und handlungsorientiert — was soll Elijah jetzt tun?`,
      messages: [{ role: "user", content: `Kontext: ${context}\n\nAufgabe: ${prompt}` }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? ""
}

// ── Account Restricted/Banned Alert ─────────────────────────────
export async function alertAccountStatus(params: {
  account:    string
  platform:   string
  newStatus:  "restricted" | "banned"
  employee:   string
  postsToday: number
}) {
  const { account, platform, newStatus, employee, postsToday } = params
  const icon  = newStatus === "banned" ? "🔴" : "🟠"
  const label = newStatus === "banned" ? "BANNED" : "RESTRICTED"

  const context = `Account @${account} auf ${platform} wurde von Mitarbeiter ${employee} als ${label} gemeldet. Heute waren noch ${postsToday} Posts geplant für diesen Account.`
  const analysis = await rafaelAI(
    "Erkläre kurz was das bedeutet und was Elijah als nächstes tun sollte.",
    context
  )

  await rafaelSend(
    `${icon} <b>Alert: @${account} ${label}</b>\n` +
    `Gemeldet von: ${employee} · ${platform}\n` +
    `Posts heute betroffen: ${postsToday}\n\n` +
    analysis
  )
}

// ── Daily Completion Rate Check ──────────────────────────────────
export async function alertLowCompletionRate(params: {
  rate:    number
  posted:  number
  total:   number
  missing: string[]
}) {
  const { rate, posted, total, missing } = params

  const context = `Die heutige Post-Completion Rate liegt bei ${rate}% (${posted}/${total} Posts gepostet). Folgende Accounts haben noch nicht gepostet: ${missing.join(", ")}.`
  const analysis = await rafaelAI(
    "Bewerte die Situation und gib eine konkrete Empfehlung.",
    context
  )

  await rafaelSend(
    `⚠️ <b>Completion Rate niedrig: ${rate}%</b>\n` +
    `${posted}/${total} Posts gepostet\n\n` +
    analysis
  )
}

// ── All Posts Done ───────────────────────────────────────────────
export async function alertAllPostsDone(params: {
  total:    number
  platform: string
}) {
  await rafaelSend(
    `✅ <b>Alle ${params.platform} Posts heute erledigt!</b>\n${params.total} Posts erfolgreich gepostet.`
  )
}
