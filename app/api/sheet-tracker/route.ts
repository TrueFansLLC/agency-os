import { NextResponse } from "next/server"

const SHEET_ID = "1_In9iX58LVbAGY2TcyETEOR1xhsIraWA"
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim() })
    if (Object.values(row).some(v => v !== "")) rows.push(row)
  }

  return { headers, rows }
}

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { redirect: "follow", next: { revalidate: 60 } })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not access the sheet. Make sure it is published to the web: File → Share → Publish to web → CSV → Publish." },
        { status: 400 }
      )
    }

    const text = await res.text()

    if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
      return NextResponse.json(
        { error: "Sheet requires a Google login. Please publish it to the web: File → Share → Publish to web → select CSV → Publish." },
        { status: 400 }
      )
    }

    const { headers, rows } = parseCSV(text)

    // Drop placeholder/template rows that have no meaningful content
    const KEY_COLS = ["Creator", "Plattform", "CheckStatus", "JaNeinStatus"]
    const meaningful = rows.filter(row =>
      KEY_COLS.some(col => row[col] && row[col].trim() !== "")
    )

    return NextResponse.json({ headers, rows: meaningful, lastSynced: new Date().toISOString() })
  } catch (err) {
    console.error("Sheet fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch sheet data." }, { status: 500 })
  }
}
