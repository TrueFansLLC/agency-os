import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage } from "@/lib/telegram"

const FOLLOWUP_AFTER_MS    = 30 * 60 * 1000
const OWNER_ALERT_AFTER_MS = 60 * 60 * 1000
const OWNER_CHAT_ID        = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

// Philippines time = UTC+8 (no DST); Bangkok = UTC+7
const BANGKOK_UTC_OFFSET = 7
const DISPATCH_HOUR      = 19  // Bot starts sending at 19:00 Bangkok = 20:00 Philippines

// All reels scheduled for US lunchtime: 23:00 / 00:00 / 01:00 Philippines = 11 AM / 12 PM / 1 PM New York
const POST_TIMES: Record<number, string> = { 1: "23:00", 2: "00:00", 3: "01:00" }
const NY_TIMES:   Record<number, string> = { 1: "11:00 AM", 2: "12:00 PM", 3: "1:00 PM" }

const POST_BUTTONS = (postId: string) => [[
  { text: "✅ Scheduled",  callback_data: `c:${postId}` },
  { text: "🟠 Restricted", callback_data: `r:${postId}` },
  { text: "🔴 Banned",     callback_data: `b:${postId}` },
]]

type DispatchedPost = { account: string; reel_number: number; platform: string }
type EmpSummary = { chatId: string; posts: DispatchedPost[] }
type EmpTask = { name: string; platform: "Instagram" | "Facebook" }

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()
  const force = new URL(request.url).searchParams.get("force") === "true"

  // Only send after 19:00 Bangkok time (bypass with ?force=true)
  const bangkokHour = (now.getUTCHours() + BANGKOK_UTC_OFFSET) % 24
  if (!force && bangkokHour < DISPATCH_HOUR) {
    return NextResponse.json({ ok: true, skipped: "before dispatch time", bangkokHour, dispatchAt: DISPATCH_HOUR })
  }

  const todayStr = now.toISOString().slice(0, 10)

  // ── 1. Send all bereit posts for today (or earlier if missed) ────
  const { data: duePosts, error: selectError } = await supabase
    .from("posting_schedule")
    .select("*")
    .eq("status", "bereit")
    .lte("send_date", todayStr)

  if (selectError) return NextResponse.json({ ok: false, error: selectError.message, todayStr })

  if (force && (duePosts?.length ?? 0) === 0) {
    const { data: all } = await supabase.from("posting_schedule").select("id,account,status,send_date")
    return NextResponse.json({ ok: true, dispatched: 0, debug: { todayStr, allPosts: all } })
  }

  let dispatched = 0
  let skipped    = 0
  const summaryByEmp: Record<string, EmpSummary> = {}

  for (const post of duePosts ?? []) {

    const username = post.account.replace(/^@/, "")
    const { data: pair } = await supabase
      .from("account_pairs")
      .select("ig_mitarbeiter, fb_mitarbeiter, ig_username, fb_username, ig_posting, fb_posting, status")
      .or(`ig_username.ilike.%${username}%,fb_username.ilike.%${username}%`)
      .maybeSingle()

    // Skip banned or restricted accounts — reschedule to tomorrow
    if (pair?.status === "banned" || pair?.status === "restricted") {
      const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)
      await supabase.from("posting_schedule").update({ send_date: tomorrow }).eq("id", post.id)
      skipped++
      continue
    }

    const igActive = pair?.ig_posting !== false
    const fbActive = pair?.fb_posting !== false

    const employeesToNotify: EmpTask[] = []
    if ((post.platform === "Instagram" || post.platform === "Alle") && pair?.ig_mitarbeiter && igActive)
      employeesToNotify.push({ name: pair.ig_mitarbeiter, platform: "Instagram" })
    if ((post.platform === "Facebook" || post.platform === "Alle") && pair?.fb_mitarbeiter && fbActive)
      employeesToNotify.push({ name: pair.fb_mitarbeiter, platform: "Facebook" })

    if (force && employeesToNotify.length === 0) {
      return NextResponse.json({ ok: false, debug: { msg: "no employee found", account: post.account, pair, username } })
    }

    let dbUpdated = false
    for (const { name: empName, platform: empPlatform } of employeesToNotify) {
      const { data: emp } = await supabase
        .from("employees")
        .select("telegram_chat_id, telegram_posting_thread_id, telegram_fb_thread_id")
        .ilike("name", `%${empName}%`)
        .maybeSingle()

      if (force && !emp?.telegram_chat_id) {
        return NextResponse.json({ ok: false, debug: { msg: "employee has no telegram_chat_id", empName, emp } })
      }
      if (!emp?.telegram_chat_id) continue

      const threadId = empPlatform === "Facebook"
        ? (emp.telegram_fb_thread_id ?? emp.telegram_posting_thread_id)
        : emp.telegram_posting_thread_id

      const accountName = empPlatform === "Facebook"
        ? (pair?.fb_username ?? post.account)
        : (pair?.ig_username ?? post.account)

      const caption = buildCaption({ ...post, account: accountName, platform: empPlatform })
      const msgId = await sendMessage(emp.telegram_chat_id, caption, threadId ?? undefined, POST_BUTTONS(post.id))

      if (msgId) {
        if (!dbUpdated) {
          await supabase
            .from("posting_schedule")
            .update({
              status: "gesendet",
              dispatched_at: now.toISOString(),
              telegram_message_id: msgId,
              chat_id: emp.telegram_chat_id,
              thread_id: threadId ?? null,
              employee_name: empName,
            })
            .eq("id", post.id)
          dbUpdated = true
          dispatched++
        }

        if (!summaryByEmp[empName]) summaryByEmp[empName] = { chatId: emp.telegram_chat_id, posts: [] }
        const alreadyTracked = summaryByEmp[empName].posts.some(p => p.account === post.account && p.reel_number === post.reel_number)
        if (!alreadyTracked)
          summaryByEmp[empName].posts.push({ account: post.account, reel_number: post.reel_number, platform: post.platform })
      }
    }

    if (employeesToNotify.length === 0) {
      await supabase.from("posting_schedule").update({ status: "gesendet", dispatched_at: now.toISOString() }).eq("id", post.id)
    }
  }

  // ── 2. Send summary instruction message to each employee ─────────
  for (const [, { chatId, posts }] of Object.entries(summaryByEmp)) {
    const sorted = posts.sort((a, b) => a.reel_number - b.reel_number)
    const lines: string[] = [`📋 <b>Your posts for today:</b>\n`]

    for (const p of sorted) {
      const time   = POST_TIMES[p.reel_number] ?? "23:00"
      const nyTime = NY_TIMES[p.reel_number]   ?? "11:00 AM"
      lines.push(`• R${p.reel_number} → schedule for <b>${time} Philippines</b> (${nyTime} NY)`)
    }

    lines.push(`\n<b>How to schedule:</b>`)
    lines.push(`1️⃣ Download each video via the link in its message`)
    lines.push(`2️⃣ Open Instagram/Facebook and tap <b>"Schedule for"</b> when uploading`)
    lines.push(`3️⃣ Set the time shown above — the post will go live automatically`)
    lines.push(`4️⃣ Tap ✅ <b>Scheduled</b> on each message once done`)
    lines.push(`\n⚡ You can schedule all reels right now — no need to be online later!`)

    await sendMessage(chatId, lines.join("\n"))
  }

  // ── 3. Follow-ups & owner alerts ─────────────────────────────────
  const { data: unconfirmed } = await supabase
    .from("posting_schedule")
    .select("*")
    .eq("status", "gesendet")
    .is("confirmed_at", null)
    .not("dispatched_at", "is", null)

  let followups = 0
  let ownerAlerts = 0

  for (const post of unconfirmed ?? []) {
    const age = now.getTime() - new Date(post.dispatched_at).getTime()

    if (age >= FOLLOWUP_AFTER_MS && !post.followup_sent_at && post.chat_id) {
      const followupText = `⚠️ <b>Reminder:</b> R${post.reel_number} for <b>@${post.account}</b> hasn't been confirmed yet.\n\nPlease tap ✅ <b>Scheduled</b> on the original message.`

      await sendMessage(post.chat_id, followupText, post.thread_id ?? undefined)

      if (post.platform === "Alle" && post.employee_name) {
        const { data: emp } = await supabase
          .from("employees")
          .select("telegram_fb_thread_id")
          .ilike("name", `%${post.employee_name}%`)
          .maybeSingle()
        if (emp?.telegram_fb_thread_id && emp.telegram_fb_thread_id !== post.thread_id) {
          await sendMessage(post.chat_id, followupText, emp.telegram_fb_thread_id)
        }
      }

      await supabase.from("posting_schedule").update({ followup_sent_at: now.toISOString() }).eq("id", post.id)
      followups++
    }

    if (age >= OWNER_ALERT_AFTER_MS && !post.owner_notified_at && OWNER_CHAT_ID) {
      await sendMessage(
        OWNER_CHAT_ID,
        `🚨 <b>Post not confirmed</b>\n\nEmployee: ${post.employee_name}\nAccount: @${post.account}\nPlatform: ${post.platform}\nR${post.reel_number} · Sent: ${new Date(post.dispatched_at).toLocaleTimeString("en-US")}\n\nPlease check.`
      )
      await supabase.from("posting_schedule").update({ owner_notified_at: now.toISOString() }).eq("id", post.id)
      ownerAlerts++
    }
  }

  // ── 4. Screenshot follow-ups (2h after check, if incomplete) ────
  const { data: pendingScreenshots } = await supabase
    .from("daily_status_screenshots")
    .select("*")
    .eq("date", todayStr)
    .is("followup_sent_at", null)
    .not("check_sent_at", "is", null)

  let screenshotFollowups = 0
  for (const record of pendingScreenshots ?? []) {
    const age = now.getTime() - new Date(record.check_sent_at).getTime()
    if (age < 2 * 60 * 60 * 1000) continue  // less than 2 hours
    if (record.received_count >= record.expected_count) continue

    const missing = record.expected_count - record.received_count
    await sendMessage(
      record.chat_id,
      `⚠️ <b>Missing Screenshots</b>\n\nYou still need to send <b>${missing} more screenshot${missing > 1 ? "s" : ""}</b> for your ${record.platform === "ig" ? "Instagram" : "Facebook"} accounts.\n\nExpected: ${record.expected_count} · Received: ${record.received_count}\n\nPlease send them now.`,
      record.thread_id ?? undefined
    )

    await supabase
      .from("daily_status_screenshots")
      .update({ followup_sent_at: now.toISOString() })
      .eq("id", record.id)

    screenshotFollowups++
  }

  return NextResponse.json({ ok: true, dispatched, skipped, followups, ownerAlerts, screenshotFollowups })
}

function buildCaption(post: { caption: string; video_link: string; account: string; platform: string; reel_number: number }) {
  const time   = POST_TIMES[post.reel_number] ?? "23:00"
  const nyTime = NY_TIMES[post.reel_number]   ?? "11:00 AM"

  const lines: string[] = []
  lines.push(`🆔 <b>Account: ${post.account}</b>`)
  lines.push(`📲 Platform: ${post.platform}`)
  lines.push(`📅 Schedule for <b>${time} Philippines</b> · ${nyTime} New York`)
  lines.push(`📌 Reel ${post.reel_number} of today`)
  if (post.video_link) lines.push(`🎬 <a href="${post.video_link}">Download video</a>`)
  lines.push(`\n⏰ You don't have to be awake at ${time} PH — just schedule it now and it posts automatically!`)
  if (post.caption) lines.push(`\n——————————————\n📝 <b>Caption (tap to copy):</b>\n<code>${post.caption}</code>`)
  return lines.join("\n")
}
