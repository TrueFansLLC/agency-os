const RAFAEL_TOKEN  = process.env.RAFAEL_BOT_TOKEN ?? ""
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""

export const BUSINESS_CONTEXT = `
=== TRUEFANS LLC — BUSINESS KONTEXT ===

GESCHÄFTSMODELL:
Full-AI-Marketing für Creator auf Instagram, Facebook und Threads.
Kernlogik: Mehrere Brandings pro Creator parallel testen, funktionierende Konzepte skalieren und duplizieren.
Entscheidungsbasis: Nicht Bauchgefühl, sondern Daten (Views, Followerwachstum, Fan-Conversion, Profilbesuche).

CREATOR-ÜBERSICHT (in DB: Cathy=Gina/Katie, Neyla=Naila):

Cathy/Gina (53 Jahre):
- Positionierung: Ältere Creatorin, reif, selbstbewusst, MILF-Vibe
- Branding: Reifer, hochwertiger, stärker. Hooks und Sprache für ältere Zielgruppe
- Accounts: Farm, Camping und weitere Brandings

Romina (35 Jahre):
- Positionierung: Flexibel, zwischen jung und älter, alltagsnah
- Branding: Gut für breite Tests — Farm, Lifestyle, Speaking-Reels, ästhetische Posts
- Stärke: Skalierbare AI-Formate

Neyla/Naila (19 Jahre):
- Positionierung: Junge Creatorin, süß, verspielt, leicht
- Branding: Jung, fresh, neugierig, weich, social-media-tauglich
- Wichtig: Klar erwachsen positionieren, aber nicht zu hart/mature

BRANDING-SYSTEM:
- Creator = Person/Persona hinter dem Content
- Branding = visuelle und psychologische Content-Welt (Outfit, Hooks, Szenen, Sprache)
- Account = Distributionskanal (Instagram/Facebook/Threads)
- Format = Content-Art (Speaking-Reel, Feed-Slide, POV-Clip)

SKALIERUNGSLOGIK:
1. Neues Branding testen (mehrere Accounts parallel)
2. Performance bewerten: Views, Followerwachstum, Fan-Conversion
3. Was funktioniert → in Varianten produzieren (neue Hooks, Szenen, Outfits)
4. Auf weitere Accounts, Creator oder Märkte duplizieren
5. Dabei: Creator-Alter und Persona müssen zum Branding passen

PLATTFORMEN:
- Instagram: Hauptkanal für Reels, Feed-Aufbau, Branding-Tests
- Facebook: Ergänzender Cross-Posting-Kanal für mehr Reichweite
- Threads: Neuer Traffic-Kanal, verbunden mit Instagram-Accounts

WICHTIGE KPIs:
- Views pro Reel (wichtigster Indikator)
- Follower-Wachstum (Qualität des Brandings)
- Fan-Conversion (Conversion vom Follower zum zahlenden Fan)
- Profilbesuche (Interesse am Creator)
- Completion Rate der Posts (operativer Gesundheitsindex)
=== ENDE BUSINESS KONTEXT ===
`

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
