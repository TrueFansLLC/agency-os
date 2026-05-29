import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// POST /api/facebook-accounts/import
// Reads all non-archived account_pairs with fb_username and upserts into facebook_accounts.
export async function POST() {
  const supabase = createServerClient()

  const { data: pairs, error: pairsErr } = await supabase
    .from("account_pairs")
    .select("id, creator, fb_username, branding")
    .eq("archived", false)

  if (pairsErr) return NextResponse.json({ error: pairsErr.message }, { status: 500 })

  const validPairs = (pairs ?? []).filter(p => (p.fb_username ?? "").trim())

  if (!validPairs.length) return NextResponse.json({ ok: true, created: 0, skipped: 0 })

  // Upsert all unique creator names
  const creatorNames = [...new Set(validPairs.map(p => (p.creator ?? "").trim()).filter(Boolean))]
  const creatorMap = new Map<string, string>() // name → id

  if (creatorNames.length) {
    const { data: creators } = await supabase
      .from("creators")
      .upsert(creatorNames.map(name => ({ name })), { onConflict: "name" })
      .select("id, name")
    for (const c of creators ?? []) creatorMap.set(c.name, c.id)
  }

  // Load existing facebook_accounts by page_handle
  const handles = validPairs.map(p => p.fb_username.trim().replace(/^@/, ""))
  const { data: existing } = await supabase
    .from("facebook_accounts")
    .select("id, page_handle")
    .in("page_handle", handles)

  const existingHandles = new Set((existing ?? []).map(a => a.page_handle))

  const toInsert = validPairs
    .filter(p => !existingHandles.has(p.fb_username.trim().replace(/^@/, "")))
    .map(p => {
      const handle = p.fb_username.trim().replace(/^@/, "")
      const creatorName = (p.creator ?? "").trim()
      const creatorId = creatorName ? (creatorMap.get(creatorName) ?? null) : null
      return {
        page_handle:       handle,
        page_name:         p.branding ?? "",
        creator_id:        creatorId,
        status:            "active",
        connection_status: "not_connected",
        performance_label: "New",
        notes:             "",
      }
    })

  if (toInsert.length) {
    const { error: insertErr } = await supabase.from("facebook_accounts").insert(toInsert)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, created: toInsert.length, skipped: existingHandles.size })
}
