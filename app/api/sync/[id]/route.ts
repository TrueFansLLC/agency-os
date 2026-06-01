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

  const supabase = createServerClient()
  const { id } = await params
  const startedAt = new Date().toISOString()
  const triggeredBy = request.headers.get("x-cron") === "1" ? "cron" : "manual"

  const { data: account, error: accErr } = await supabase
    .from("instagram_accounts")
    .select("id, username, external_instagram_id, fb_username, last_synced_at")
    .eq("id", id)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const today = new Date().toISOString().split("T")[0]

  // Hard limit: never sync the same account twice in one day regardless of trigger.
  // This protects the monthly API quota (3,000 requests = ~1 full sync/day for 30 accounts).
  // Pass ?force=1 in the URL to override for a single account only.
  const url = new URL(request.url)
  const force = url.searchParams.get("force") === "1"
  if (!force && account.last_synced_at?.startsWith(today)) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const handle = account.username.replace(/^@/, "")
  const rapidKey = process.env.RAPIDAPI_KEY!

  let igData: { followers: number; posts: number; views: number; externalId?: string } | null = null
  let fbFollowers = 0
  let fetchError: string | null = null

  // ── Instagram sync via RapidAPI ─────────────────────────────────
  try {
    const profileRes = await fetch(
      `https://instagram-scraper-20251.p.rapidapi.com/userinfo/?username_or_id=${encodeURIComponent(handle)}`,
      {
        headers: {
          "x-rapidapi-host": "instagram-scraper-20251.p.rapidapi.com",
          "x-rapidapi-key": rapidKey,
        },
        cache: "no-store",
      }
    )

    if (!profileRes.ok) {
      fetchError = `Instagram API returned ${profileRes.status}: ${await profileRes.text()}`
    } else {
      const profileJson = await profileRes.json()
      const user = profileJson?.data ?? profileJson

      const followers  = user?.follower_count ?? 0
      const posts      = user?.media_count ?? 0
      const externalId = user?.id?.toString() ?? account.external_instagram_id

      // Get reels for view count (non-fatal if it fails)
      let totalViews = 0
      try {
        const reelsRes = await fetch(
          `https://instagram-scraper-20251.p.rapidapi.com/userreels/?username_or_id=${encodeURIComponent(handle)}`,
          {
            headers: {
              "x-rapidapi-host": "instagram-scraper-20251.p.rapidapi.com",
              "x-rapidapi-key": rapidKey,
            },
            cache: "no-store",
          }
        )
        if (reelsRes.ok) {
          const reelsJson = await reelsRes.json()
          const reels: { play_count?: number; view_count?: number }[] =
            reelsJson?.data?.items ?? reelsJson?.items ?? []
          totalViews = reels.reduce(
            (sum, reel) => sum + (reel?.play_count ?? reel?.view_count ?? 0),
            0
          )
        }
      } catch {
        // views stay 0
      }

      igData = { followers, posts, views: totalViews, externalId }
    }
  } catch (err: unknown) {
    const cause = err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : ""
    fetchError = err instanceof Error
      ? `${err.message}${cause ? ` (${cause})` : ""}`
      : String(err)
  }

  // ── Facebook Page sync via RapidAPI (non-fatal if it fails) ──────
  if (!fetchError && account.fb_username) {
    try {
      const fbHandle = account.fb_username.replace(/^@/, "")
      const fbUrl = fbHandle.startsWith("http") ? fbHandle : `https://www.facebook.com/${fbHandle}`
      const fbRes = await fetch(
        `https://facebook-pages-scraper2.p.rapidapi.com/get_facebook_page_details?facebook_url=${encodeURIComponent(fbUrl)}`,
        {
          headers: {
            "x-rapidapi-host": "facebook-pages-scraper2.p.rapidapi.com",
            "x-rapidapi-key": rapidKey,
          },
          cache: "no-store",
        }
      )
      if (fbRes.ok) {
        const fbJson = await fbRes.json()
        fbFollowers = fbJson?.followers_count ?? fbJson?.fan_count ?? fbJson?.followers ?? 0
      }
    } catch {
      // non-fatal — FB failure doesn't block IG data
    }
  }

  if (fetchError || !igData) {
    await supabase.from("sync_logs").insert({
      account_id:    id,
      platform:      "instagram",
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
    platform:          "instagram",
    status:            "success",
    triggered_by:      triggeredBy,
    snapshots_written: 1,
    started_at:        startedAt,
    completed_at:      new Date().toISOString(),
  })

  return NextResponse.json({
    ok:          true,
    followers:   igData.followers,
    posts:       igData.posts,
    views:       igData.views,
    fbFollowers: fbFollowers,
    date:        today,
  })
}
