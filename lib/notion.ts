const NOTION_TOKEN = process.env.NOTION_TOKEN!
const NOTION_DB_ID = process.env.NOTION_POSTING_DB_ID!

const headers = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
}

export interface PostingEntry {
  id: string
  post: string
  caption: string
  videoLink: string
  account: string
  platform: string
  status: string
  datum: string | null
}

// Fetch all entries with Status = "Bereit"
export async function getReadyPosts(): Promise<PostingEntry[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filter: {
        property: "Status",
        select: { equals: "Bereit" },
      },
    }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Notion query failed: ${res.status}`)
  const data = await res.json()

  return (data.results ?? []).map((page: any) => ({
    id: page.id,
    post:      page.properties.Post?.title?.[0]?.plain_text ?? "",
    caption:   page.properties.Caption?.rich_text?.[0]?.plain_text ?? "",
    videoLink: page.properties["Video Link"]?.url ?? "",
    account:   page.properties.Account?.select?.name ?? "",
    platform:  page.properties.Plattform?.select?.name ?? "",
    status:    page.properties.Status?.select?.name ?? "",
    datum:     page.properties.Datum?.date?.start ?? null,
  }))
}

// Mark a post as "Gesendet"
export async function markAsSent(pageId: string) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: {
        Status: { select: { name: "Gesendet" } },
      },
    }),
  })
}
