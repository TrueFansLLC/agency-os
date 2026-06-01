import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAnyPageAccess } from "@/lib/supabase/auth-server"

// POST /api/accounts/import
// Reads all non-archived account_pairs and creates/updates instagram_accounts.
// Uses ig_username directly (not ig_link which is the funnel/bio link).
export async function POST() {
  const auth = await requireAnyPageAccess(["social"])
  if (auth.response) return auth.response

  const supabase = createServerClient()

  const { data: pairs, error: pairsErr } = await supabase
    .from("account_pairs")
    .select("id, creator, ig_username, fb_username")
    .eq("archived", false)

  if (pairsErr) return NextResponse.json({ error: pairsErr.message }, { status: 500 })

  const validPairs = (pairs ?? []).filter(p => (p.ig_username ?? "").trim())

  if (!validPairs.length) return NextResponse.json({ ok: true, created: 0, updated: 0 })

  // Collect unique creator names and upsert all at once
  const creatorNames = [...new Set(validPairs.map(p => (p.creator ?? "").trim()).filter(Boolean))]
  const creatorMap = new Map<string, string>() // name → id

  if (creatorNames.length) {
    const { data: creators } = await supabase
      .from("creators")
      .upsert(creatorNames.map(name => ({ name })), { onConflict: "name" })
      .select("id, name")
    for (const c of creators ?? []) creatorMap.set(c.name, c.id)
  }

  // Load all existing IG accounts in one query
  const { data: existing } = await supabase
    .from("instagram_accounts")
    .select("id, username, fb_username")

  const existingMap = new Map<string, { id: string; fb_username: string | null }>()
  for (const acc of existing ?? []) existingMap.set(acc.username, acc)

  const toInsert: object[] = []
  const toUpdate: { id: string; fb_username: string }[] = []

  for (const pair of validPairs) {
    const rawUsername = pair.ig_username.trim()
    const username = rawUsername.startsWith("@") ? rawUsername : `@${rawUsername}`
    const creatorName = (pair.creator ?? "").trim()
    const creatorId = creatorName ? (creatorMap.get(creatorName) ?? null) : null
    const fbUsername = (pair.fb_username ?? "").trim() || null

    const found = existingMap.get(username)
    if (found) {
      if (fbUsername && !found.fb_username) {
        toUpdate.push({ id: found.id, fb_username: fbUsername })
      }
    } else {
      toInsert.push({
        username,
        creator_id:        creatorId,
        fb_username:       fbUsername,
        status:            "active",
        connection_status: "not_connected",
        data_source:       "instagram_api",
        performance_label: "New",
        notes:             "",
      })
    }
  }

  // Batch insert new accounts
  if (toInsert.length) {
    await supabase.from("instagram_accounts").insert(toInsert)
  }

  // Update fb_username where missing (parallel)
  await Promise.all(
    toUpdate.map(u =>
      supabase.from("instagram_accounts").update({ fb_username: u.fb_username }).eq("id", u.id)
    )
  )

  return NextResponse.json({ ok: true, created: toInsert.length, updated: toUpdate.length })
}
