import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

function extractIgUsername(igLink: string | null): string | null {
  if (!igLink) return null
  const trimmed = igLink.trim()
  // Already a plain username or @username
  if (!trimmed.includes("/")) return trimmed.replace(/^@/, "")
  // URL like https://www.instagram.com/username/ or https://instagram.com/username
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split("/").filter(Boolean)
    return parts[0] ?? null
  } catch {
    return trimmed.replace(/^@/, "")
  }
}

// POST /api/accounts/import
// Reads all non-archived account_pairs and creates instagram_accounts
// for any that have an ig_link and don't already exist.
// Also updates fb_username when fb_link is set.
export async function POST() {
  const supabase = createServerClient()

  // Load all non-archived pairs with a link
  const { data: pairs, error: pairsErr } = await supabase
    .from("account_pairs")
    .select("id, creator, ig_link, fb_link")
    .neq("archived", true)

  if (pairsErr) return NextResponse.json({ error: pairsErr.message }, { status: 500 })

  let created = 0
  let updated = 0

  for (const pair of pairs ?? []) {
    const igUsername = extractIgUsername(pair.ig_link)
    if (!igUsername) continue

    const usernameNormalized = `@${igUsername.replace(/^@/, "")}`

    // Find or create creator
    const creatorName = (pair.creator ?? "").trim()
    let creatorId: string | null = null
    if (creatorName) {
      const { data: creator } = await supabase
        .from("creators")
        .upsert({ name: creatorName }, { onConflict: "name" })
        .select("id")
        .single()
      creatorId = creator?.id ?? null
    }

    // Check if this IG account already exists
    const { data: existing } = await supabase
      .from("instagram_accounts")
      .select("id, fb_username")
      .eq("username", usernameNormalized)
      .maybeSingle()

    const fbLink = pair.fb_link?.trim() || null

    if (existing) {
      // Update fb_username if we now have one and didn't before
      if (fbLink && !existing.fb_username) {
        await supabase
          .from("instagram_accounts")
          .update({ fb_username: fbLink })
          .eq("id", existing.id)
        updated++
      }
    } else {
      // Create new account
      await supabase.from("instagram_accounts").insert({
        username:          usernameNormalized,
        creator_id:        creatorId,
        status:            "active",
        connection_status: "not_connected",
        data_source:       "instagram_api",
        performance_label: "New",
        notes:             "",
        fb_username:       fbLink,
      })
      created++
    }
  }

  return NextResponse.json({ ok: true, created, updated })
}
