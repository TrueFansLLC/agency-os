import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { FbAccount, FbDailySnapshot } from "@/types/facebook"

export async function GET() {
  const supabase = createServerClient()

  const { data: accounts, error: accErr } = await supabase
    .from("facebook_accounts")
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
    .from("facebook_metric_snapshots")
    .select("account_id, date, followers, video_views, videos_count, posts_count")
    .in("account_id", accountIds)
    .gte("date", since.toISOString().split("T")[0])
    .order("date", { ascending: true })

  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 })

  const snapMap = new Map<string, FbDailySnapshot[]>()
  for (const s of snapshots ?? []) {
    if (!snapMap.has(s.account_id)) snapMap.set(s.account_id, [])
    snapMap.get(s.account_id)!.push({
      date:        s.date,
      followers:   s.followers,
      videoViews:  s.video_views,
      videosCount: s.videos_count,
      postsCount:  s.posts_count,
    })
  }

  const result: FbAccount[] = accounts.map(a => ({
    id:               a.id,
    pageHandle:       a.page_handle,
    pageName:         a.page_name ?? "",
    creatorId:        a.creator_id ?? "",
    creatorName:      (a.creator as any)?.name ?? "",
    market:           (a.market  as any)?.name ?? "",
    status:           a.status,
    connectionStatus: a.connection_status,
    performanceLabel: a.performance_label,
    lastSyncedAt:     a.last_synced_at ?? undefined,
    notes:            a.notes ?? "",
    archived:         a.archived,
    snapshots:        snapMap.get(a.id) ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = createServerClient()
  const body     = await request.json()

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

  const handle = (body.pageHandle ?? "").trim().replace(/^@/, "")

  const { data: account, error } = await supabase
    .from("facebook_accounts")
    .insert({
      page_handle:       handle,
      page_name:         body.pageName?.trim() ?? "",
      creator_id:        creatorId,
      market_id:         marketId,
      status:            body.status            ?? "active",
      connection_status: body.connectionStatus  ?? "not_connected",
      performance_label: body.performanceLabel  ?? "New",
      notes:             body.notes             ?? "",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(account, { status: 201 })
}
