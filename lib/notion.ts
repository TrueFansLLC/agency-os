const NOTION_TOKEN  = process.env.NOTION_TOKEN!
const NOTION_DB_ID  = process.env.NOTION_POSTING_DB_ID!

const headers = {
  "Authorization":  `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type":   "application/json",
}

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

// Returns all posts with Status = "Bereit" whose date+time is now or in the past
export async function getReadyPosts(): Promise<PostingEntry[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filter: { property: "Status", select: { equals: "Bereit" } },
    }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Notion query failed: ${res.status}`)
  const data = await res.json()

  const now = new Date()
  return (data.results ?? [])
    .map((page: any) => ({
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
    .filter((p: PostingEntry) => {
      if (!p.datum) return true  // no date = send immediately
      const sendAt = p.uhrzeit ? new Date(`${p.datum}T${p.uhrzeit}:00`) : new Date(`${p.datum}T00:00:00`)
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
