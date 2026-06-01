import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { rafaelAlert } from "@/lib/rafael"
import { isCronAuthorized } from "@/lib/supabase/auth-server"

// Thresholds
const VIRAL_MULTIPLIER       = 3.0  // 3x above average = viral signal
const UNDERPERFORM_RATIO     = 0.40 // below 40% of average = underperform
const MIN_DAYS_FOR_BASELINE  = 14   // account needs 14 days before baseline comparison
const NEW_ACCOUNT_DAYS       = 14   // "new" = under 14 days
const NEW_STRONG_FOLLOWERS   = 100  // new account: 100+ followers in first week = strong
const NEW_STRONG_VIEWS       = 5000 // new account: 5k+ views in first week = strong signal
const NEW_STRUGGLING_POSTS   = 7    // after 7 posts with poor numbers = struggling

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase  = createServerClient()
  const now       = new Date()
  const today     = now.toISOString().slice(0, 10)
  const day7ago   = new Date(Date.now() - 7  * 864e5).toISOString().slice(0, 10)
  const day30ago  = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)

  const alerts: string[] = []

  // ── INSTAGRAM ────────────────────────────────────────────────
  const { data: igAccounts } = await supabase
    .from("instagram_accounts")
    .select("id, username, created_at")
    .eq("archived", false)

  if (igAccounts?.length) {
    const { data: igSnaps } = await supabase
      .from("instagram_metric_snapshots")
      .select("account_id, date, followers, views, posts")
      .gte("date", day30ago)
      .order("date", { ascending: true })

    for (const acc of igAccounts) {
      const snaps = (igSnaps ?? []).filter(s => s.account_id === acc.id)
      if (snaps.length < 2) continue

      const accountAge = Math.floor((now.getTime() - new Date(acc.created_at).getTime()) / 864e5)
      const latest     = snaps[snaps.length - 1]
      const oldest30   = snaps[0]

      // Total views and posts in last 30 days
      const totalViews30 = (latest.views ?? 0) - (oldest30.views ?? 0)
      const totalPosts30 = (latest.posts ?? 0) - (oldest30.posts ?? 0)
      const avgViewsPerPost = totalPosts30 > 0 ? totalViews30 / totalPosts30 : 0

      // Last 7 days
      const snap7dAgo = snaps.find(s => s.date >= day7ago) ?? snaps[0]
      const views7d   = (latest.views ?? 0) - (snap7dAgo.views ?? 0)
      const posts7d   = (latest.posts ?? 0) - (snap7dAgo.posts ?? 0)
      const avg7dPerPost = posts7d > 0 ? views7d / posts7d : 0

      // ── NEW ACCOUNT ───────────────────────────────────────────
      if (accountAge <= NEW_ACCOUNT_DAYS) {
        const followers = latest.followers ?? 0
        const totalViews = latest.views ?? 0
        const totalPosts = latest.posts ?? 0

        if (followers >= NEW_STRONG_FOLLOWERS || totalViews >= NEW_STRONG_VIEWS) {
          alerts.push(
            `🚀 <b>Neuer Account — starkes Signal!</b>\n` +
            `@${acc.username} (IG, ${accountAge} Tage alt)\n` +
            `${followers} Follower · ${fmtNum(totalViews)} Views · ${totalPosts} Posts\n` +
            `→ Potenzial erkannt, näher ansehen`
          )
        } else if (totalPosts >= NEW_STRUGGLING_POSTS && followers < 50 && totalViews < 1000) {
          alerts.push(
            `⚠️ <b>Neuer Account läuft nicht an</b>\n` +
            `@${acc.username} (IG, ${accountAge} Tage alt)\n` +
            `${totalPosts} Posts · ${followers} Follower · ${fmtNum(totalViews)} Views\n` +
            `→ Content oder Strategie überdenken`
          )
        }
        continue
      }

      if (avgViewsPerPost < 100 || totalPosts30 < 3) continue

      // ── VIRAL SIGNAL ─────────────────────────────────────────
      if (posts7d > 0 && avg7dPerPost >= avgViewsPerPost * VIRAL_MULTIPLIER) {
        alerts.push(
          `🔥 <b>Viral-Signal bei @${acc.username}</b> (IG)\n` +
          `Diese Woche: ${fmtNum(avg7dPerPost)} Views/Video\n` +
          `Normal: ${fmtNum(avgViewsPerPost)} Views/Video\n` +
          `→ ${Math.round(avg7dPerPost / avgViewsPerPost)}x über Durchschnitt — Content analysieren`
        )
      }

      // ── UNDERPERFORMANCE ─────────────────────────────────────
      if (accountAge > MIN_DAYS_FOR_BASELINE && posts7d > 0 && avg7dPerPost < avgViewsPerPost * UNDERPERFORM_RATIO) {
        alerts.push(
          `📉 <b>Underperformance bei @${acc.username}</b> (IG)\n` +
          `Diese Woche: ${fmtNum(avg7dPerPost)} Views/Video\n` +
          `Normal: ${fmtNum(avgViewsPerPost)} Views/Video\n` +
          `→ Nur ${Math.round(avg7dPerPost / avgViewsPerPost * 100)}% des Durchschnitts`
        )
      }
    }
  }

  // ── FACEBOOK ─────────────────────────────────────────────────
  const { data: fbAccounts } = await supabase
    .from("facebook_accounts")
    .select("id, username, created_at")
    .eq("archived", false)

  if (fbAccounts?.length) {
    const { data: fbSnaps } = await supabase
      .from("facebook_metric_snapshots")
      .select("account_id, date, followers, video_views, videos_count")
      .gte("date", day30ago)
      .order("date", { ascending: true })

    for (const acc of fbAccounts) {
      const snaps = (fbSnaps ?? []).filter(s => s.account_id === acc.id)
      if (snaps.length < 2) continue

      const accountAge = Math.floor((now.getTime() - new Date(acc.created_at).getTime()) / 864e5)
      const latest     = snaps[snaps.length - 1]
      const oldest30   = snaps[0]

      const totalViews30 = (latest.video_views ?? 0) - (oldest30.video_views ?? 0)
      const totalPosts30 = (latest.videos_count ?? 0) - (oldest30.videos_count ?? 0)
      const avgViewsPerPost = totalPosts30 > 0 ? totalViews30 / totalPosts30 : 0

      const snap7dAgo    = snaps.find(s => s.date >= day7ago) ?? snaps[0]
      const views7d      = (latest.video_views ?? 0) - (snap7dAgo.video_views ?? 0)
      const posts7d      = (latest.videos_count ?? 0) - (snap7dAgo.videos_count ?? 0)
      const avg7dPerPost = posts7d > 0 ? views7d / posts7d : 0

      if (accountAge <= NEW_ACCOUNT_DAYS) {
        const followers  = latest.followers ?? 0
        const totalViews = latest.video_views ?? 0
        const totalPosts = latest.videos_count ?? 0

        if (followers >= NEW_STRONG_FOLLOWERS || totalViews >= NEW_STRONG_VIEWS) {
          alerts.push(
            `🚀 <b>Neuer Account — starkes Signal!</b>\n` +
            `@${acc.username} (FB, ${accountAge} Tage alt)\n` +
            `${followers} Follower · ${fmtNum(totalViews)} Views · ${totalPosts} Posts\n` +
            `→ Potenzial erkannt, näher ansehen`
          )
        } else if (totalPosts >= NEW_STRUGGLING_POSTS && followers < 50 && totalViews < 1000) {
          alerts.push(
            `⚠️ <b>Neuer Account läuft nicht an</b>\n` +
            `@${acc.username} (FB, ${accountAge} Tage alt)\n` +
            `${totalPosts} Posts · ${followers} Follower · ${fmtNum(totalViews)} Views\n` +
            `→ Content oder Strategie überdenken`
          )
        }
        continue
      }

      if (avgViewsPerPost < 100 || totalPosts30 < 3) continue

      if (posts7d > 0 && avg7dPerPost >= avgViewsPerPost * VIRAL_MULTIPLIER) {
        alerts.push(
          `🔥 <b>Viral-Signal bei @${acc.username}</b> (FB)\n` +
          `Diese Woche: ${fmtNum(avg7dPerPost)} Views/Video\n` +
          `Normal: ${fmtNum(avgViewsPerPost)} Views/Video\n` +
          `→ ${Math.round(avg7dPerPost / avgViewsPerPost)}x über Durchschnitt — Content analysieren`
        )
      }

      if (accountAge > MIN_DAYS_FOR_BASELINE && posts7d > 0 && avg7dPerPost < avgViewsPerPost * UNDERPERFORM_RATIO) {
        alerts.push(
          `📉 <b>Underperformance bei @${acc.username}</b> (FB)\n` +
          `Diese Woche: ${fmtNum(avg7dPerPost)} Views/Video\n` +
          `Normal: ${fmtNum(avgViewsPerPost)} Views/Video\n` +
          `→ Nur ${Math.round(avg7dPerPost / avgViewsPerPost * 100)}% des Durchschnitts`
        )
      }
    }
  }

  // ── Sende Alerts an Rafael ────────────────────────────────────
  if (alerts.length > 0) {
    const header = `📊 <b>Performance Check — ${today}</b>\n${alerts.length} Signal${alerts.length > 1 ? "e" : ""} erkannt:\n`
    await rafaelAlert(header + "\n\n" + alerts.join("\n\n"))
  }

  return NextResponse.json({ ok: true, alerts: alerts.length, date: today })
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k"
  return Math.round(n).toString()
}
