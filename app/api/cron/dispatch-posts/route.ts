import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendVideo, sendMessage } from "@/lib/telegram"

const FOLLOWUP_AFTER_MS   = 30 * 60 * 1000
const OWNER_ALERT_AFTER_MS = 60 * 60 * 1000
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const nowTime  = now.toTimeString().slice(0, 5)  // "HH:MM"

  // ── 1. Send due posts ────────────────────────────────────────────
  const { data: duePosts } = await supabase
    .from("posting_schedule")
    .select("*")
    .eq("status", "geplant")
    .lte("send_date", todayStr)

  let dispatched = 0

  for (const post of duePosts ?? []) {
    // If today, check time too
    if (post.send_date === todayStr && post.send_time.slice(0, 5) > nowTime) continue

    const username = post.account.replace(/^@/, "")
    const { data: pair } = await supabase
      .from("account_pairs")
      .select("ig_mitarbeiter, fb_mitarbeiter")
      .or(`ig_link.ilike.%${username}%,fb_link.ilike.%${username}%`)
      .maybeSingle()

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

      const caption = buildCaption(post)
      const msgId = post.video_link
        ? await sendVideo(emp.telegram_chat_id, post.video_link, caption, emp.telegram_posting_thread_id ?? undefined)
        : await sendMessage(emp.telegram_chat_id, caption, emp.telegram_posting_thread_id ?? undefined)

      if (msgId) {
        await supabase
          .from("posting_schedule")
          .update({
            status: "gesendet",
            dispatched_at: now.toISOString(),
            telegram_message_id: msgId,
            chat_id: emp.telegram_chat_id,
            thread_id: emp.telegram_posting_thread_id ?? null,
            employee_name: empName,
          })
          .eq("id", post.id)
        dispatched++
      }
    }

    // Mark sent even if no employee found (avoid re-sending)
    if (employeesToNotify.length === 0) {
      await supabase.from("posting_schedule").update({ status: "gesendet", dispatched_at: now.toISOString() }).eq("id", post.id)
    }
  }

  // ── 2. Follow-ups & owner alerts ─────────────────────────────────
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
      await sendMessage(
        post.chat_id,
        `⚠️ Erinnerung: Post R${post.reel_number} für <b>@${post.account}</b> (${post.platform}) wurde noch nicht bestätigt.\n\nBitte mit ✅ auf die ursprüngliche Nachricht antworten.`,
        post.thread_id ?? undefined
      )
      await supabase.from("posting_schedule").update({ followup_sent_at: now.toISOString() }).eq("id", post.id)
      followups++
    }

    if (age >= OWNER_ALERT_AFTER_MS && !post.owner_notified_at && OWNER_CHAT_ID) {
      await sendMessage(
        OWNER_CHAT_ID,
        `🚨 <b>Post nicht bestätigt</b>\n\nMitarbeiter: ${post.employee_name}\nAccount: @${post.account}\nPlattform: ${post.platform}\nR${post.reel_number} · Gesendet: ${new Date(post.dispatched_at).toLocaleTimeString("de-DE")}\n\nBitte überprüfen.`
      )
      await supabase.from("posting_schedule").update({ owner_notified_at: now.toISOString() }).eq("id", post.id)
      ownerAlerts++
    }
  }

  return NextResponse.json({ ok: true, dispatched, followups, ownerAlerts })
}

function buildCaption(post: { post_text: string; caption: string; account: string; platform: string; send_time: string; reel_number: number }) {
  const lines: string[] = []
  lines.push(`📱 <b>@${post.account}</b> · ${post.platform}`)
  lines.push(`⏰ Posten um ${post.send_time.slice(0, 5)} Uhr (R${post.reel_number})`)
  if (post.post_text) lines.push(`\n<b>${post.post_text}</b>`)
  if (post.caption)   lines.push(`\n${post.caption}`)
  lines.push(`\n✅ Mit dieser Nachricht antworten sobald du gepostet hast`)
  return lines.join("\n")
}
