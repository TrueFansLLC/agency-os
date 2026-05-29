import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// Called once daily by Vercel Cron — syncs all Instagram + Facebook accounts.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const today    = new Date().toISOString().split("T")[0]
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get("host")}`

  // ── Instagram ──────────────────────────────────────────────────
  const { data: igAccounts, error: igErr } = await supabase
    .from("instagram_accounts")
    .select("id")
    .neq("archived", true)
    .or(`last_synced_at.is.null,last_synced_at.lt.${today}T00:00:00.000Z`)

  // ── Facebook: import from account_pairs first, then sync ───────
  // Re-use import logic inline so cron doesn't depend on HTTP import route
  const { data: pairs } = await supabase
    .from("account_pairs")
    .select("id, creator, fb_username, branding")
    .eq("archived", false)

  const validPairs = (pairs ?? []).filter(p => (p.fb_username ?? "").trim())

  if (validPairs.length) {
    const creatorNames = [...new Set(validPairs.map(p => (p.creator ?? "").trim()).filter(Boolean))]
    const creatorMap   = new Map<string, string>()
    if (creatorNames.length) {
      const { data: creators } = await supabase
        .from("creators")
        .upsert(creatorNames.map(name => ({ name })), { onConflict: "name" })
        .select("id, name")
      for (const c of creators ?? []) creatorMap.set(c.name, c.id)
    }
    const handles = validPairs.map(p => p.fb_username.trim().replace(/^@/, ""))
    const { data: existing } = await supabase
      .from("facebook_accounts")
      .select("page_handle")
      .in("page_handle", handles)
    const existingHandles = new Set((existing ?? []).map(a => a.page_handle))
    const toInsert = validPairs
      .filter(p => !existingHandles.has(p.fb_username.trim().replace(/^@/, "")))
      .map(p => ({
        page_handle:       p.fb_username.trim().replace(/^@/, ""),
        page_name:         p.branding ?? "",
        creator_id:        creatorMap.get((p.creator ?? "").trim()) ?? null,
        status:            "active",
        connection_status: "not_connected",
        performance_label: "New",
        notes:             "",
      }))
    if (toInsert.length) {
      await supabase.from("facebook_accounts").insert(toInsert)
    }
  }

  const { data: fbAccounts, error: fbErr } = await supabase
    .from("facebook_accounts")
    .select("id")
    .neq("archived", true)
    .or(`last_synced_at.is.null,last_synced_at.lt.${today}T00:00:00.000Z`)

  // ── Sync both platforms ────────────────────────────────────────
  let igSynced = 0, igFailed = 0
  let fbSynced = 0, fbFailed = 0

  if (!igErr) {
    for (const acc of igAccounts ?? []) {
      try {
        const res = await fetch(`${baseUrl}/api/sync/${acc.id}`, {
          method: "POST",
          headers: { "x-cron": "1" },
        })
        if (res.ok) igSynced++
        else igFailed++
      } catch { igFailed++ }
    }
  }

  if (!fbErr) {
    for (const acc of fbAccounts ?? []) {
      try {
        const res = await fetch(`${baseUrl}/api/facebook-sync/${acc.id}`, {
          method: "POST",
          headers: { "x-cron": "1" },
        })
        if (res.ok) fbSynced++
        else fbFailed++
      } catch { fbFailed++ }
    }
  }

  return NextResponse.json({
    ok: true,
    instagram: { synced: igSynced, failed: igFailed },
    facebook:  { synced: fbSynced, failed: fbFailed },
  })
}
