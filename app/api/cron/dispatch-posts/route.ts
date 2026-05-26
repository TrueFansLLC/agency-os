import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getReadyPosts, markAsSent } from "@/lib/notion"
import { sendVideo, sendMessage } from "@/lib/telegram"

const FOLLOWUP_AFTER_MS  = 30 * 60 * 1000   // 30 minutes
const OWNER_ALERT_AFTER_MS = 60 * 60 * 1000  // 60 minutes (30 min follow-up + 30 min extra)
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()

  // ── 1. Send new ready posts from Notion ──────────────────────────
  const posts = await getReadyPosts()
  let dispatched = 0

  for (const post of posts) {
    const username = post.account.replace(/^@/, "")
    const { data: pair } = await supabase
      .from("account_pairs")
      .select("ig_mitarbeiter, fb_mitarbeiter")
      .or(`ig_link.ilike.%${username}%,fb_link.ilike.%${username}%`)
      .maybeSingle()

    const caption = buildCaption(post)
    const employeesToNotify: string[] = []

    if ((post.platform === "Instagram" || post.platform === "IG + FB") && pair?.ig_mitarbeiter)
      employeesToNotify.push(pair.ig_mitarbeiter)
    if ((post.platform === "Facebook" || post.platform === "IG + FB") && pair?.fb_mitarbeiter)
      if (!employeesToNotify.includes(pair.fb_mitarbeiter))
        employeesToNotify.push(pair.fb_mitarbeiter)

    for (const empName of employeesToNotify) {
      const { data: emp } = await supabase
        .from("employees")
        .select("telegram_chat_id, telegram_posting_thread_id")
        .ilike("name", `%${empName}%`)
        .maybeSingle()

      if (!emp?.telegram_chat_id) continue

      const msgId = post.videoLink
        ? await sendVideo(emp.telegram_chat_id, post.videoLink, caption, emp.telegram_posting_thread_id ?? undefined)
        : await sendMessage(emp.telegram_chat_id, caption, emp.telegram_posting_thread_id ?? undefined)

      if (msgId) {
        await supabase.from("post_dispatch_log").insert({
          notion_page_id: post.id,
          telegram_message_id: msgId,
          chat_id: emp.telegram_chat_id,
          thread_id: emp.telegram_posting_thread_id ?? null,
          employee_name: empName,
          account: post.account,
          platform: post.platform,
        })
        dispatched++
      }
    }

    await markAsSent(post.id)
  }

  // ── 2. Follow-ups for unconfirmed posts ──────────────────────────
  const { data: unconfirmed } = await supabase
    .from("post_dispatch_log")
    .select("*")
    .is("confirmed_at", null)

  let followups = 0
  let ownerAlerts = 0

  for (const log of unconfirmed ?? []) {
    const age = now.getTime() - new Date(log.dispatched_at).getTime()

    // Send follow-up after 30 min (once)
    if (age >= FOLLOWUP_AFTER_MS && !log.followup_sent_at) {
      await sendMessage(
        log.chat_id,
        `⚠️ Erinnerung: Post für <b>${log.account}</b> (${log.platform}) wurde noch nicht bestätigt.\n\nBitte mit ✅ auf die ursprüngliche Nachricht antworten wenn du gepostet hast.`,
        log.thread_id ?? undefined
      )
      await supabase.from("post_dispatch_log").update({ followup_sent_at: now.toISOString() }).eq("id", log.id)
      followups++
    }

    // Alert owner after 60 min (once)
    if (age >= OWNER_ALERT_AFTER_MS && !log.owner_notified_at && OWNER_CHAT_ID) {
      await sendMessage(
        OWNER_CHAT_ID,
        `🚨 <b>Post nicht bestätigt</b>\n\nMitarbeiter: ${log.employee_name}\nAccount: ${log.account}\nPlattform: ${log.platform}\nVerschickt: ${new Date(log.dispatched_at).toLocaleTimeString("de-DE")}\n\nBitte überprüfen.`
      )
      await supabase.from("post_dispatch_log").update({ owner_notified_at: now.toISOString() }).eq("id", log.id)
      ownerAlerts++
    }
  }

  return NextResponse.json({ ok: true, dispatched, followups, ownerAlerts })
}

function buildCaption(post: { post: string; caption: string; account: string; platform: string; uhrzeit: string | null }) {
  const lines: string[] = []
  lines.push(`📱 <b>${post.account}</b> · ${post.platform}`)
  if (post.uhrzeit) lines.push(`⏰ Posten um ${post.uhrzeit} Uhr`)
  if (post.post)    lines.push(`\n<b>${post.post}</b>`)
  if (post.caption) lines.push(`\n${post.caption}`)
  lines.push(`\n✅ Mit dieser Nachricht antworten sobald du gepostet hast`)
  return lines.join("\n")
}
