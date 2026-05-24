import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient()
  const { id } = await params
  const startedAt = new Date().toISOString()
  const triggeredBy = request.headers.get("x-cron") === "1" ? "cron" : "manual"

  const { data: account, error: accErr } = await supabase
    .from("instagram_accounts")
    .select("id, username, external_instagram_id, fb_username")
    .eq("id", id)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  // Skip if already synced today (saves API credits)
  const today = new Date().toISOString().split("T")[0]
  if (triggeredBy === "cron" && account.last_synced_at?.startsWith(today)) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const handle = account.username.replace(/^@/, "")
  const rapidApiKey = process.env.RAPIDAPI_KEY!

  let igData: { followers: number; posts: number; views: number; externalId?: string } | null = null
  let fbFollowers = 0
  let fetchError: string | null = null

  try {
    const res = await fetch(
      `https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=${encodeURIComponent(handle)}`,
      {
        headers: {
          "x-rapidapi-key":  rapidApiKey,
          "x-rapidapi-host": "instagram-scraper-api2.p.rapidapi.com",
        },
        cache: "no-store",
      }
    )

    if (!res.ok) {
      fetchError = `RapidAPI returned ${res.status}: ${await res.text()}`
    } else {
      const json = await res.json()
      const user = json?.data ?? json

      type PostNode = { view_count?: number; video_view_count?: number; play_count?: number }
      type Edge = { node?: PostNode }

      const timelineEdges: Edge[] = user?.edge_owner_to_timeline_media?.edges ?? []
      const felixEdges: Edge[]    = user?.edge_felix_video_timeline?.edges ?? []

      const viewsFromEdges = (edges: Edge[]) =>
        edges.reduce((sum, e) => sum + (e.node?.play_count ?? e.node?.view_count ?? e.node?.video_view_count ?? 0), 0)

      const totalViews = viewsFromEdges(timelineEdges) + viewsFromEdges(felixEdges)

      igData = {
        followers:  user?.edge_followed_by?.count ?? user?.follower_count ?? 0,
        posts:      user?.edge_owner_to_timeline_media?.count ?? user?.media_count ?? 0,
        views:      totalViews,
        externalId: user?.id?.toString() ?? account.external_instagram_id,
      }
    }
  } catch (err: unknown) {
    const cause = (err as any)?.cause?.message ?? (err as any)?.cause?.code ?? ""
    fetchError = err instanceof Error
      ? `${err.message}${cause ? ` (${cause})` : ""}`
      : String(err)
  }

  // Optionally sync Facebook (non-fatal if it fails)
  if (!fetchError && account.fb_username) {
    try {
      const fbRes = await fetch(
        `https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=${encodeURIComponent(account.fb_username)}`,
        {
          headers: {
            "x-rapidapi-key":  rapidApiKey,
            "x-rapidapi-host": "instagram-scraper-api2.p.rapidapi.com",
          },
          cache: "no-store",
        }
      )
      if (fbRes.ok) {
        const fbJson = await fbRes.json()
        fbFollowers = fbJson?.data?.follower_count ?? fbJson?.data?.fan_count ?? 0
      }
    } catch {
      // non-fatal
    }
  }

  if (fetchError || !igData) {
    await supabase.from("sync_logs").insert({
      account_id:    id,
      status:        "error",
      triggered_by:  triggeredBy,
      error_message: fetchError ?? "No data returned",
      started_at:    startedAt,
      completed_at:  new Date().toISOString(),
    })
    return NextResponse.json({ error: fetchError }, { status: 502 })
  }

  const { error: snapErr } = await supabase
    .from("instagram_metric_snapshots")
    .upsert(
      {
        account_id:   id,
        date:         today,
        followers:    igData.followers,
        views:        igData.views,
        posts:        igData.posts,
        fb_followers: fbFollowers,
      },
      { onConflict: "account_id,date" }
    )

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 })
  }

  await supabase
    .from("instagram_accounts")
    .update({
      connection_status:     "connected",
      last_synced_at:        new Date().toISOString(),
      external_instagram_id: igData.externalId ?? account.external_instagram_id,
      updated_at:            new Date().toISOString(),
    })
    .eq("id", id)

  await supabase.from("sync_logs").insert({
    account_id:        id,
    status:            "success",
    triggered_by:      triggeredBy,
    snapshots_written: 1,
    started_at:        startedAt,
    completed_at:      new Date().toISOString(),
  })

  return NextResponse.json({
    ok:        true,
    followers: igData.followers,
    posts:     igData.posts,
    views:     igData.views,
    date:      today,
  })
}
