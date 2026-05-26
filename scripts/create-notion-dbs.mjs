// Creates one Notion posting database per creator with pre-filled account rows
const TOKEN = "ntn_A59376791356qajSWh5BONMMXhZh0hvpS0rR2VmrUN85Qc"
const PARENT_PAGE_ID = "1f3161e9cb1f80c7837ced04fef3d842"

const headers = {
  "Authorization": `Bearer ${TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
}

const CREATORS = [
  {
    name: "Cathy",
    accounts: [
      { account: "cathyycamping",  platform: "Instagram" },
      { account: "itscathylane",   platform: "Instagram" },
      { account: "cathysfarm",     platform: "Instagram" },
    ],
  },
  {
    name: "Neyla",
    accounts: [
      { account: "neylasranch",       platform: "Instagram" },
      { account: "neylaspeaks",       platform: "Instagram" },
      { account: "neylaonthestreet",  platform: "Instagram" },
      { account: "neylaasks",         platform: "Instagram" },
      { account: "neylaleftalone",    platform: "Instagram" },
      { account: "christianneylaa",   platform: "Instagram" },
    ],
  },
  {
    name: "Romina",
    accounts: [
      { account: "rominahomealone",    platform: "Instagram" },
      { account: "rominaspeaks",       platform: "Instagram" },
      { account: "rominasfarm",        platform: "Instagram" },
      { account: "rominaonthestreet",  platform: "Instagram" },
      { account: "domrominaa",         platform: "Instagram" },
      { account: "rominascamp",        platform: "IG + FB" },
    ],
  },
]

async function createDatabase(creatorName, accounts) {
  // Build select options from accounts
  const accountOptions = accounts.map(a => ({ name: `@${a.account}` }))
  const platformOptions = [
    { name: "Instagram", color: "pink" },
    { name: "Facebook",  color: "blue" },
    { name: "IG + FB",   color: "purple" },
  ]
  const statusOptions = [
    { name: "Bereit",   color: "green" },
    { name: "Gesendet", color: "yellow" },
    { name: "Gepostet", color: "gray" },
  ]

  const res = await fetch("https://api.notion.com/v1/databases", {
    method: "POST",
    headers,
    body: JSON.stringify({
      parent: { type: "page_id", page_id: PARENT_PAGE_ID },
      icon:   { type: "emoji", emoji: "📅" },
      title:  [{ type: "text", text: { content: `${creatorName} — Posting Kalender` } }],
      properties: {
        "Post":          { title: {} },
        "Caption":       { rich_text: {} },
        "Video Link":    { url: {} },
        "Account":       { select: { options: accountOptions } },
        "Plattform":     { select: { options: platformOptions } },
        "Status":        { select: { options: statusOptions } },
        "Datum":         { date: {} },
        "Uhrzeit":       { rich_text: {} },
        "Bestätigt":     { checkbox: {} },
        "Bestätigt um":  { date: {} },
      },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error(`❌ Failed to create DB for ${creatorName}:`, JSON.stringify(data, null, 2))
    return null
  }

  console.log(`✅ Created "${creatorName} — Posting Kalender" → ID: ${data.id}`)
  return data.id
}

async function addTemplateRow(dbId, account, platform) {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        "Post":      { title: [{ text: { content: "" } }] },
        "Account":   { select: { name: `@${account}` } },
        "Plattform": { select: { name: platform } },
        "Status":    { select: { name: "Bereit" } },
      },
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error(`  ⚠️  Row failed for @${account}:`, data.message)
  } else {
    console.log(`  + @${account} (${platform})`)
  }
}

async function main() {
  const envLines = []

  for (const creator of CREATORS) {
    console.log(`\n── ${creator.name} ─────────────────────`)
    const dbId = await createDatabase(creator.name, creator.accounts)
    if (!dbId) continue

    console.log(`  Adding template rows...`)
    for (const { account, platform } of creator.accounts) {
      await addTemplateRow(dbId, account, platform)
    }

    const envKey = `NOTION_DB_${creator.name.toUpperCase()}`
    envLines.push(`${envKey}=${dbId}`)
  }

  console.log("\n\n══════════════════════════════════════")
  console.log("✅ Done! Add these to Vercel:\n")
  for (const line of envLines) {
    console.log(line)
  }
  console.log("══════════════════════════════════════")
}

main().catch(console.error)
