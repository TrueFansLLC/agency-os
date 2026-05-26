const NOTION_TOKEN = process.env.NOTION_TOKEN!

const headers = {
  "Authorization":  `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type":   "application/json",
}

// One database per creator — all must be set in env
const DB_IDS = [
  process.env.NOTION_DB_CATHY!,
  process.env.NOTION_DB_NEYLA!,
  process.env.NOTION_DB_ROMINA!,
].filter(Boolean)

export interface PostingEntry {
  id:        string
  post:      string
  caption:   string
  videoLink: string
  account:   string
  platform:  string
  status:    string
  datum:     string | null  // "2026-05-28"
  uhrzeit:   string | null  // "09:00"
}

async function queryDb(dbId: string): Promise<PostingEntry[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filter: { property: "Status", select: { equals: "Bereit" } },
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    console.error(`Notion query failed for DB ${dbId}: ${res.status}`)
    return []
  }
  const data = await res.json()
  return (data.results ?? []).map((page: any) => ({
    id:        page.id,
    post:      page.properties.Post?.title?.[0]?.plain_text ?? "",
    caption:   page.properties.Caption?.rich_text?.[0]?.plain_text ?? "",
    videoLink: page.properties["Video Link"]?.url ?? "",
    account:   page.properties.Account?.select?.name ?? "",
    platform:  page.properties.Plattform?.select?.name ?? "",
    status:    page.properties.Status?.select?.name ?? "",
    datum:     page.properties.Datum?.date?.start ?? null,
    uhrzeit:   page.properties.Uhrzeit?.rich_text?.[0]?.plain_text ?? null,
  }))
}

// Returns all ready posts across all creator databases
export async function getReadyPosts(): Promise<PostingEntry[]> {
  const now = new Date()
  const allResults = await Promise.all(DB_IDS.map(queryDb))
  return allResults
    .flat()
    .filter((p: PostingEntry) => {
      if (!p.datum) return true
      const sendAt = p.uhrzeit
        ? new Date(`${p.datum}T${p.uhrzeit}:00`)
        : new Date(`${p.datum}T00:00:00`)
      return sendAt <= now
    })
}

export async function markAsSent(pageId: string) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ properties: { Status: { select: { name: "Gesendet" } } } }),
  })
}

export async function markAsConfirmed(pageId: string) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: {
        "Bestätigt":    { checkbox: true },
        "Bestätigt um": { date: { start: new Date().toISOString() } },
        Status:         { select: { name: "Gepostet" } },
      },
    }),
  })
}
