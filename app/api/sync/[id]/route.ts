import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// ── POST /api/sync/[id] ───────────────────────────────────────────
// Fetches fresh Instagram data for one account via ScrapeCreators,
// writes a daily snapshot to Supabase, and logs the sync attempt.
// The API key never leaves the server — it's read from env only here.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient()
  const { id } = await params
  const startedAt = new Date().toISOString()

  const { data: account, error: accErr } = await supabase
    .from("instagram_accounts")
    .select("id, username, external_instagram_id, fb_username")
    .eq("id", id)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const handle = account.username.replace(/^@/, "")
  const apiKey = process.env.SCRAPECREATORS_API_KEY!

  let igData: { followers: number; posts: number; views: number; externalId?: string } | null = null
  let fbFollowers = 0
  let fetchError: string | null = null

  try {
    // ScrapeCreators API — fetches public Instagram profile data
    const res = await fetch(
      `https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(handle)}`,
      {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      }
    )

    if (!res.ok) {
      fetchError = `ScrapeCreators returned ${res.status}: ${await res.text()}`
    } else {
      const json = await res.json()
      const user = json?.data?.user ?? json?.data ?? json

      type PostNode = { view_count?: number; video_view_count?: number }
      type Edge = { node?: PostNode }

      const timelineEdges: Edge[] = user?.edge_owner_to_timeline_media?.edges ?? []
      const felixEdges: Edge[]    = user?.edge_felix_video_timeline?.edges ?? []

      const viewsFromEdges = (edges: Edge[]) =>
        edges.reduce((sum, e) => sum + (e.node?.view_count ?? e.node?.video_view_count ?? 0), 0)

      // Combine both feeds; felix edges are a separate reel/IGTV feed (no overlap with timeline)
      const totalViews = viewsFromEdges(timelineEdges) + viewsFromEdges(felixEdges)

      igData = {
        followers:  user?.edge_followed_by?.count ?? 0,
        posts:      user?.edge_owner_to_timeline_media?.count ?? 0,
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

  // Optionally sync Facebook
  if (!fetchError && account.fb_username) {
    try {
      const fbRes = await fetch(
        `https://api.scrapecreators.com/v1/facebook/profile?url=${encodeURIComponent(account.fb_username)}`,
        { headers: { "x-api-key": apiKey }, cache: "no-store" }
      )
      if (fbRes.ok) {
        const fbJson = await fbRes.json()
        fbFollowers = fbJson?.data?.followerCount ?? fbJson?.data?.likeCount ?? 0
      }
    } catch {
      // Facebook sync failure is non-fatal — Instagram data is still saved
    }
  }

  if (fetchError || !igData) {
    await supabase.from("sync_logs").insert({
      account_id:    id,
      status:        "error",
      triggered_by:  "manual",
      error_message: fetchError ?? "No data returned",
      started_at:    startedAt,
      completed_at:  new Date().toISOString(),
    })
    return NextResponse.json({ error: fetchError }, { status: 502 })
  }

  // Upsert today's snapshot
  const today = new Date().toISOString().split("T")[0]
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

  // Update account metadata
  await supabase
    .from("instagram_accounts")
    .update({
      connection_status:     "connected",
      last_synced_at:        new Date().toISOString(),
      external_instagram_id: igData.externalId ?? account.external_instagram_id,
      updated_at:            new Date().toISOString(),
    })
    .eq("id", id)

  // Log success
  await supabase.from("sync_logs").insert({
    account_id:       id,
    status:           "success",
    triggered_by:     "manual",
    snapshots_written: 1,
    started_at:       startedAt,
    completed_at:     new Date().toISOString(),
  })

  return NextResponse.json({
    ok:        true,
    followers: igData.followers,
    posts:     igData.posts,
    views:     igData.views,
    date:      today,
  })
}
