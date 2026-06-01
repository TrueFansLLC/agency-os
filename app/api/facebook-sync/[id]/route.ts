import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { isCronAuthorized, requireAnyPageAccess } from "@/lib/supabase/auth-server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isCronAuthorized(request)) {
    const auth = await requireAnyPageAccess(["social"])
    if (auth.response) return auth.response
  }

  const supabase    = createServerClient()
  const { id }      = await params
  const startedAt   = new Date().toISOString()
  const triggeredBy = request.headers.get("x-cron") === "1" ? "cron" : "manual"

  const { data: account, error: accErr } = await supabase
    .from("facebook_accounts")
    .select("id, page_handle, page_name, last_synced_at")
    .eq("id", id)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const today = new Date().toISOString().split("T")[0]

  const url   = new URL(request.url)
  const force = url.searchParams.get("force") === "1"
  if (!force && account.last_synced_at?.startsWith(today)) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const rapidKey = process.env.RAPIDAPI_KEY!
  const handle   = account.page_handle.replace(/^@/, "")
  const fbUrl    = handle.startsWith("http") ? handle : `https://www.facebook.com/${handle}`

  let followers   = 0
  let videoViews  = 0
  let videosCount = 0
  let postsCount  = 0
  let fetchedName = account.page_name ?? ""
  let fetchError: string | null = null

  try {
    const res = await fetch(
      `https://facebook-pages-scraper2.p.rapidapi.com/get_facebook_page_details?facebook_url=${encodeURIComponent(fbUrl)}`,
      {
        headers: {
          "x-rapidapi-host": "facebook-pages-scraper2.p.rapidapi.com",
          "x-rapidapi-key":  rapidKey,
        },
        cache: "no-store",
      }
    )

    if (!res.ok) {
      fetchError = `Facebook API returned ${res.status}: ${await res.text()}`
    } else {
      const json = await res.json()

      followers   = json?.followers_count ?? json?.fan_count ?? json?.followers ?? 0
      videosCount = json?.videos_count    ?? json?.video_count ?? 0
      postsCount  = json?.posts_count     ?? json?.post_count  ?? 0
      fetchedName = json?.page_name       ?? json?.name        ?? fetchedName

      // Some APIs nest video data
      if (json?.videos && Array.isArray(json.videos)) {
        videoViews  = json.videos.reduce(
          (sum: number, video: { view_count?: number; views?: number }) =>
            sum + (video.view_count ?? video.views ?? 0),
          0
        )
        videosCount = videosCount || json.videos.length
      }
    }
  } catch (err: unknown) {
    const cause = err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : ""
    fetchError = err instanceof Error
      ? `${err.message}${cause ? ` (${cause})` : ""}`
      : String(err)
  }

  if (fetchError) {
    await supabase.from("sync_logs").insert({
      account_id:    id,
      platform:      "facebook",
      status:        "error",
      triggered_by:  triggeredBy,
      error_message: fetchError,
      started_at:    startedAt,
      completed_at:  new Date().toISOString(),
    }).select().maybeSingle()

    return NextResponse.json({ error: fetchError }, { status: 502 })
  }

  const { error: snapErr } = await supabase
    .from("facebook_metric_snapshots")
    .upsert(
      {
        account_id:  id,
        date:        today,
        followers,
        video_views: videoViews,
        videos_count: videosCount,
        posts_count: postsCount,
      },
      { onConflict: "account_id,date" }
    )

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 })
  }

  await supabase
    .from("facebook_accounts")
    .update({
      connection_status: "connected",
      last_synced_at:    new Date().toISOString(),
      page_name:         fetchedName || account.page_name,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", id)

  return NextResponse.json({
    ok: true,
    followers,
    videoViews,
    videosCount,
    postsCount,
    date: today,
  })
}
