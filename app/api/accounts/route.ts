import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { InstagramAccount, DailySnapshot } from "@/types/instagram"

// ── GET /api/accounts ─────────────────────────────────────────────
// Returns all non-archived accounts with creator/market names and
// the last 35 days of snapshots — exactly what the dashboard needs.
export async function GET() {
  const supabase = createServerClient()

  const { data: accounts, error: accErr } = await supabase
    .from("instagram_accounts")
    .select(`
      *,
      creator:creators!creator_id(id, name),
      market:markets!market_id(id, name)
    `)
    .order("created_at", { ascending: false })

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })
  if (!accounts?.length) return NextResponse.json([])

  const accountIds = accounts.map(a => a.id)
  const since = new Date()
  since.setDate(since.getDate() - 35)

  const { data: snapshots, error: snapErr } = await supabase
    .from("instagram_metric_snapshots")
    .select("account_id, date, followers, views, posts, fb_followers")
    .in("account_id", accountIds)
    .gte("date", since.toISOString().split("T")[0])
    .order("date", { ascending: true })

  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 })

  const snapMap = new Map<string, DailySnapshot[]>()
  for (const s of snapshots ?? []) {
    if (!snapMap.has(s.account_id)) snapMap.set(s.account_id, [])
    snapMap.get(s.account_id)!.push({
      date: s.date,
      followers: s.followers,
      views: s.views,
      posts: s.posts,
      fbFollowers: s.fb_followers ?? 0,
    })
  }

  const result: InstagramAccount[] = accounts.map(a => ({
    id:                   a.id,
    username:             a.username,
    creatorId:            a.creator_id ?? "",
    creatorName:          (a.creator as any)?.name ?? "",
    market:               (a.market as any)?.name ?? "",
    status:               a.status,
    connectionStatus:     a.connection_status,
    dataSource:           a.data_source,
    externalInstagramId:  a.external_instagram_id ?? undefined,
    lastSyncedAt:         a.last_synced_at ?? undefined,
    fbUsername:           a.fb_username ?? undefined,
    performanceLabel:     a.performance_label,
    notes:                a.notes ?? "",
    archived:             a.archived,
    snapshots:            snapMap.get(a.id) ?? [],
  }))

  return NextResponse.json(result)
}

// ── POST /api/accounts ────────────────────────────────────────────
// Creates a new Instagram account. Finds or creates the creator and
// market automatically — frontend just sends names as strings.
export async function POST(request: Request) {
  const supabase = createServerClient()
  const body = await request.json()

  // Find or create creator
  let creatorId: string | null = null
  if (body.creatorName?.trim()) {
    const { data: creator, error } = await supabase
      .from("creators")
      .upsert({ name: body.creatorName.trim() }, { onConflict: "name" })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    creatorId = creator.id
  }

  // Find or create market
  let marketId: string | null = null
  if (body.market?.trim()) {
    const { data: market, error } = await supabase
      .from("markets")
      .upsert({ name: body.market.trim() }, { onConflict: "name" })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    marketId = market.id
  }

  const { data: account, error } = await supabase
    .from("instagram_accounts")
    .insert({
      username:          body.username,
      fb_username:       body.fbUsername ?? null,
      creator_id:        creatorId,
      market_id:         marketId,
      status:            body.status ?? "active",
      connection_status: body.connectionStatus ?? "not_connected",
      data_source:       body.dataSource ?? "instagram_api",
      performance_label: body.performanceLabel ?? "New",
      notes:             body.notes ?? "",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(account, { status: 201 })
}
