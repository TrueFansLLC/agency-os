import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// Called once daily by Vercel Cron — syncs every non-archived account.
// Also callable manually via POST for testing.
export async function GET(request: Request) {
  // Protect from external calls (Vercel sends this header automatically)
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const today = new Date().toISOString().split("T")[0]

  // Get all non-archived accounts that haven't been synced today
  const { data: accounts, error } = await supabase
    .from("instagram_accounts")
    .select("id, username")
    .neq("archived", true)
    .or(`last_synced_at.is.null,last_synced_at.lt.${today}T00:00:00.000Z`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!accounts?.length) return NextResponse.json({ ok: true, synced: 0, message: "All accounts already synced today" })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get("host")}`
  let synced = 0
  let failed = 0

  for (const account of accounts) {
    try {
      const res = await fetch(`${baseUrl}/api/sync/${account.id}`, {
        method: "POST",
        headers: { "x-cron": "1" },
      })
      if (res.ok) synced++
      else failed++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ ok: true, synced, failed, total: accounts.length })
}
