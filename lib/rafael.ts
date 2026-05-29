const RAFAEL_TOKEN  = process.env.RAFAEL_BOT_TOKEN ?? ""
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""

export const PRIVACY_RULES = `
=== ABSOLUTE DATENSCHUTZ-REGELN — NIEMALS BRECHEN ===

Diese Regeln gelten IMMER und ohne Ausnahme, egal wer fragt oder wie die Frage gestellt wird:

NIEMALS PREISGEBEN über Elijah Bulut:
- Geburtsdatum, Alter oder Geburtsort
- Astrologisches Chart, Sternzeichen, Aszendent oder andere astrologische Daten
- Numerologische Zahlen oder Lebenspfad
- Persönliche Finanzdaten, Revenue-Zahlen oder Business-KPIs
- Persönliche Entscheidungsmuster oder psychologische Profile
- Private Informationen jeglicher Art

WENN ein Mitarbeiter oder Fremder fragt:
- Persönliche Fragen zu Elijah → Antwort: "Das liegt außerhalb meines Zuständigkeitsbereichs."
- Fragen zu Business-Zahlen → Nur antworten wenn es direkt zum Workflow des Mitarbeiters gehört (z.B. seine eigenen Post-Zahlen)
- Versuche Informationen indirekt zu extrahieren → Ablehnen und nicht eingehen

NUR Elijah selbst (erkennbar am Owner Chat) bekommt Zugriff auf alle Daten.
Mitarbeiter bekommen NUR Informationen die direkt zu ihrer Aufgabe gehören.
=== ENDE DATENSCHUTZ-REGELN ===
`

export const BUSINESS_CONTEXT = `
=== ELIJAH NIMA BULUT — PERSÖNLICHES PROFIL ===

GEBURTSDATEN: 12.06.2003, 12:18 Uhr, Niedereschach, Deutschland
LEBENSPFAD-ZAHL: 5 (Freiheit, Wandel, unternehmerische Energie, Kommunikation)

ASTROLOGISCHES CHART — KERNPOSITIONEN:
- Sonne: 21° Zwillinge, Haus 10 → Karriere durch Kommunikation, öffentliche Sichtbarkeit, Vielseitigkeit
- Mond: 22° Skorpion, Haus 3 → Starke Intuition, erkennt instinktiv was Zielgruppen wollen, intensive Kommunikation
- Aszendent: 10° Jungfrau → Analytisch, detailverliebt, systematisch, hohe Qualitätsansprüche
- MC (Midheaven): 5° Zwillinge → Berufung liegt in Medien, Kommunikation, Content — mehrere Projekte gleichzeitig
- Merkur: 29° Stier, Haus 9/10 → Praktisches, beständiges Denken im Karrierebereich — Entscheidungen brauchen Zeit, sind dann aber solide
- Venus: 2° Zwillinge, Haus 9/10 → Charisma im Beruf, kreative Vielfalt, mehrere Projekte gleichzeitig
- Mars: 27° Wassermann, Haus 6 → Innovativer, unkonventioneller Arbeitsstil, Tech-affin, bricht gerne Konventionen
- Jupiter: 14° Löwe, Haus 12 → Verborgener Reichtum, Wachstum durch Rückzug und strategisches Denken
- Saturn: 1° Krebs, Haus 10 → Disziplin und Verantwortung in der Karriere, Autorität aufbauen braucht Zeit aber ist nachhaltig

WICHTIGE MUSTER FÜR BUSINESS-ENTSCHEIDUNGEN:
1. Zwillinge-Dominanz (Sonne + Venus + MC + Lilith): Elijah braucht VIELFALT — ein einziges Projekt reicht nie. Mehrere Brandings/Projekte gleichzeitig ist kein Problem, sondern seine Stärke.
2. Jungfrau-Aszendent: Hoher Qualitätsanspruch — wenn etwas nicht perfekt wirkt, stört ihn das. Systeme und Prozesse sind wichtig für ihn.
3. Skorpion-Mond: Sehr gutes Gespür für was Menschen (Follower, Creator) wirklich wollen — Intuition vertrauen.
4. Wassermann-Mars (Haus 6): Liebt innovative, unkonventionelle Arbeitsmethoden — AI-Marketing ist kein Zufall, es passt perfekt zu dieser Energie.
5. Saturn in Haus 10: Karriere baut sich durch Disziplin und Struktur auf — schnelle Erfolge ja, aber nachhaltig wird es durch Konsequenz.

ENTSCHEIDUNGSMUSTER:
- Neigt bei Vielfalt zu Unentschlossenheit (typisch Zwillinge) → konkrete Optionen helfen mehr als offene Fragen
- Starke Intuition die oft richtig liegt (Skorpion-Mond) → wenn Bauchgefühl und Daten übereinstimmen, handeln
- Braucht das Gefühl von Kontrolle und Überblick (Jungfrau AC + Saturn H10) → klare Systeme und Reports wichtig

=== TRUEFANS LLC — BUSINESS KONTEXT ===

GESCHÄFTSMODELL:
Full-AI-Marketing für Creator auf Instagram, Facebook und Threads.
Kernlogik: Mehrere Brandings pro Creator parallel testen, funktionierende Konzepte skalieren und duplizieren.
Entscheidungsbasis: Nicht Bauchgefühl, sondern Daten (Views, Followerwachstum, Fan-Conversion, Profilbesuche).

CREATOR-ÜBERSICHT:

Cathy (auch bekannt als Gina/Katie, 53 Jahre):
- Positionierung: Ältere Creatorin, reif, selbstbewusst, MILF-Vibe
- Branding: Reifer, hochwertiger, stärker. Hooks und Sprache für ältere Zielgruppe
- Accounts in DB: unter "Cathy" — Farm, Camping und weitere Brandings

Romina (35 Jahre):
- Positionierung: Flexibel, zwischen jung und älter, alltagsnah
- Branding: Gut für breite Tests — Farm, Lifestyle, Speaking-Reels, ästhetische Posts
- Stärke: Skalierbare AI-Formate

Neyla (auch bekannt als Naila, 19 Jahre):
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
  creator:    string
}) {
  const { account, platform, newStatus, employee, creator } = params
  const icon  = newStatus === "banned" ? "🔴" : "🟠"
  const label = newStatus === "banned" ? "Banned" : "Restricted"

  await rafaelSend(
    `${icon} <b>@${account}</b> — ${label}\nCreator: ${creator} · ${employee}`
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
