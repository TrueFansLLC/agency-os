const API_KEY  = process.env.TRELLO_API_KEY  ?? ""
const TOKEN    = process.env.TRELLO_TOKEN    ?? ""
const BOARD_ID = process.env.TRELLO_BOARD_ID ?? ""

const BASE = "https://api.trello.com/1"
const AUTH = `key=${API_KEY}&token=${TOKEN}`

export interface TrelloCard {
  id:   string
  name: string
  desc: string
  due:  string | null
  list: string
}

// ── Get all lists on board ────────────────────────────────────
async function getLists(): Promise<{ id: string; name: string }[]> {
  const res  = await fetch(`${BASE}/boards/${BOARD_ID}/lists?${AUTH}`)
  return res.ok ? res.json() : []
}

// ── Debug: test connection ────────────────────────────────────
export async function testConnection(): Promise<string> {
  if (!API_KEY) return "❌ TRELLO_API_KEY fehlt"
  if (!TOKEN)   return "❌ TRELLO_TOKEN fehlt"
  if (!BOARD_ID) return "❌ TRELLO_BOARD_ID fehlt"

  const res  = await fetch(`${BASE}/boards/${BOARD_ID}?${AUTH}&fields=name`)
  if (!res.ok) {
    const err = await res.text()
    return `❌ API Fehler (${res.status}): ${err.slice(0, 100)}`
  }
  const board = await res.json()
  const lists = await getLists()
  const cardsRes = await fetch(`${BASE}/boards/${BOARD_ID}/cards?${AUTH}&fields=name`)
  const cards = cardsRes.ok ? await cardsRes.json() : []
  return `✅ Verbunden\nBoard: ${board.name}\nListen: ${lists.map((l: {name: string}) => l.name).join(", ")}\nKarten: ${cards.length}`
}

// ── Get all cards with their list name ───────────────────────
export async function getAllCards(): Promise<TrelloCard[]> {
  const [lists, cardsRes] = await Promise.all([
    getLists(),
    fetch(`${BASE}/boards/${BOARD_ID}/cards?${AUTH}&fields=name,desc,due,idList`),
  ])
  const cards = cardsRes.ok ? await cardsRes.json() : []
  const listMap = Object.fromEntries(lists.map((l: {id: string; name: string}) => [l.id, l.name]))

  return cards.map((c: { id: string; name: string; desc: string; due: string | null; idList: string }) => ({
    id:   c.id,
    name: c.name,
    desc: c.desc,
    due:  c.due,
    list: listMap[c.idList] ?? "Unbekannt",
  }))
}

// ── Create a new card ────────────────────────────────────────
export async function createCard(params: {
  name:     string
  desc?:    string
  listName: string
  due?:     string
}): Promise<boolean> {
  const lists = await getLists()
  const list  = lists.find(l => l.name.toLowerCase().includes(params.listName.toLowerCase()))
              ?? lists.find(l => l.name.toLowerCase().includes("offen"))
              ?? lists[0]

  if (!list) return false

  const body = new URLSearchParams({
    name:   params.name,
    desc:   params.desc ?? "",
    idList: list.id,
    key:    API_KEY,
    token:  TOKEN,
  })
  if (params.due) body.set("due", params.due)

  const res = await fetch(`${BASE}/cards`, { method: "POST", body })
  return res.ok
}

// ── Move card to list ────────────────────────────────────────
export async function moveCard(cardId: string, toListName: string): Promise<boolean> {
  const lists = await getLists()
  const list  = lists.find(l => l.name.toLowerCase().includes(toListName.toLowerCase()))
  if (!list) return false

  const res = await fetch(`${BASE}/cards/${cardId}?${AUTH}&idList=${list.id}`, { method: "PUT" })
  return res.ok
}

// ── Format cards as text summary ─────────────────────────────
export function formatCards(cards: TrelloCard[]): string {
  if (!cards.length) return "Keine Tasks vorhanden."

  const grouped: Record<string, TrelloCard[]> = {}
  for (const c of cards) {
    if (!grouped[c.list]) grouped[c.list] = []
    grouped[c.list].push(c)
  }

  return Object.entries(grouped).map(([list, items]) =>
    `<b>${list} (${items.length})</b>\n` +
    items.map(c => `• ${c.name}${c.due ? ` — bis ${new Date(c.due).toLocaleDateString("de-DE")}` : ""}`).join("\n")
  ).join("\n\n")
}
