import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage, editMessage, answerCallback, editMessageKeyboard } from "@/lib/telegram"

const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // ── Inline button tap (callback_query) ──────────────────────────
  if (body.callback_query) {
    const data = body.callback_query.data ?? ""
    if (data.startsWith("as:")) {
      await handleStatusCheck(body.callback_query)
    } else if (data !== "_") {
      await handleCallback(body.callback_query)
    } else {
      await answerCallback(body.callback_query.id)
    }
    return NextResponse.json({ ok: true })
  }

  const message = body.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId    = String(message.chat.id)
  const text      = (message.text ?? "").trim()
  const firstName = message.from?.first_name ?? ""
  const fullName  = [firstName, message.from?.last_name ?? ""].filter(Boolean).join(" ")
  const replyToId = message.reply_to_message?.message_id ?? null

  const supabase = createServerClient()

  // ── /chatid ──────────────────────────────────────────────────────
  if (text.startsWith("/chatid")) {
    const threadId = message.message_thread_id ?? null
    await sendMessage(chatId,
      `🆔 <b>Chat ID:</b> <code>${chatId}</code>\n📌 <b>Thread ID:</b> <code>${threadId ?? "kein Topic"}</code>`,
      threadId ?? undefined
    )
    return NextResponse.json({ ok: true })
  }

  // ── /start ───────────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    const { data: existing } = await supabase
      .from("employees")
      .select("id, name")
      .eq("telegram_chat_id", chatId)
      .maybeSingle()

    if (!existing) {
      await supabase
        .from("employees")
        .upsert({ telegram_chat_id: chatId, name: fullName }, { onConflict: "telegram_chat_id" })
    }

    await sendMessage(chatId,
      `👋 Hey ${firstName}!\n\nYou are now connected to the Agency Bot.\nAs soon as a post is ready for you, you will receive it automatically here.\n\n<b>Important:</b> Tap ✅ <b>Scheduled</b> on each post message once you have scheduled it.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Photo received in a status topic → count screenshot ─────────
  if (message.photo) {
    const threadId = message.message_thread_id ?? null
    if (threadId) {
      const { data: record } = await supabase
        .from("daily_status_screenshots")
        .select("id, received_count, expected_count")
        .eq("chat_id", chatId)
        .eq("thread_id", threadId)
        .eq("date", new Date().toISOString().slice(0, 10))
        .maybeSingle()

      if (record) {
        const newCount = record.received_count + 1
        await supabase
          .from("daily_status_screenshots")
          .update({ received_count: newCount })
          .eq("id", record.id)

        if (newCount >= record.expected_count) {
          await sendMessage(chatId,
            `✅ <b>All screenshots received!</b> (${newCount}/${record.expected_count})\n\nAccount check complete for today.`,
            threadId
          )
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Text reply to a post message ────────────────────────────────
  if (replyToId) {
    const supabase2 = createServerClient()

    // 1. IG/FB posting_schedule confirmation
    const { data: post } = await supabase2
      .from("posting_schedule")
      .select("*")
      .eq("telegram_message_id", replyToId)
      .eq("chat_id", chatId)
      .neq("status", "gepostet")
      .maybeSingle()

    if (post) {
      await supabase2
        .from("posting_schedule")
        .update({ status: "gepostet", confirmed_at: new Date().toISOString() })
        .eq("id", post.id)

      await sendMessage(chatId,
        `✅ Got it! R${post.reel_number} for <b>@${post.account}</b> (${post.platform}) has been marked as scheduled.`,
        post.thread_id ?? undefined
      )
      return NextResponse.json({ ok: true })
    }

    // 2. Threads batch — "all posted" confirmation (first ✅)
    const { data: sentBatch } = await supabase2
      .from("threads_daily_batches")
      .select("*, account:threads_accounts(*)")
      .eq("telegram_message_id", replyToId)
      .eq("chat_id", chatId)
      .eq("status", "sent")
      .maybeSingle()

    if (sentBatch) {
      await supabase2
        .from("threads_daily_batches")
        .update({ status: "posted", posted_confirmed_at: new Date().toISOString() })
        .eq("id", sentBatch.id)

      await sendMessage(chatId,
        `✅ <b>${sentBatch.posts_count} Threads Posts</b> für @${sentBatch.account?.username} bestätigt!\n\n🗑️ Jetzt alle <b>${sentBatch.images_count} Bilder</b> aus dem Drive-Ordner löschen.\n\nAntworte mit <b>✅✅</b> wenn alle Bilder gelöscht sind.`
      )
      return NextResponse.json({ ok: true })
    }

    // 3. Threads batch — "images deleted" confirmation (✅✅)
    const isDeletion = text.includes("✅✅") || text.toLowerCase().includes("gelöscht") || text.toLowerCase().includes("deleted")
    if (isDeletion) {
      const { data: postedBatch } = await supabase2
        .from("threads_daily_batches")
        .select("*, account:threads_accounts(*)")
        .eq("telegram_message_id", replyToId)
        .eq("chat_id", chatId)
        .eq("status", "posted")
        .maybeSingle()

      if (postedBatch) {
        await supabase2
          .from("threads_daily_batches")
          .update({ status: "deleted", deletion_confirmed_at: new Date().toISOString() })
          .eq("id", postedBatch.id)

        await sendMessage(chatId,
          `🗑️ Perfekt! Alle Bilder für @${postedBatch.account?.username} gelöscht.\n\nHeute komplett erledigt ✅`
        )
        return NextResponse.json({ ok: true })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

async function handleCallback(cb: {
  id: string
  from: { id: number; first_name?: string }
  message: { message_id: number; chat: { id: number }; text?: string }
  data: string
}) {
  const supabase  = createServerClient()
  const chatId    = String(cb.message.chat.id)
  const messageId = cb.message.message_id
  const [action, postId] = cb.data.split(":")
  const now = new Date().toISOString()

  const { data: post } = await supabase
    .from("posting_schedule")
    .select("*")
    .eq("id", postId)
    .maybeSingle()

  if (!post) {
    await answerCallback(cb.id, "Post not found.")
    return
  }

  // ── ✅ Scheduled ─────────────────────────────────────────────────
  if (action === "c") {
    if (post.status === "gepostet") {
      await answerCallback(cb.id, "Already confirmed ✅")
      return
    }

    await supabase
      .from("posting_schedule")
      .update({ status: "gepostet", confirmed_at: now })
      .eq("id", postId)

    const sep = "\n——————————————\n"
    const baseText = (cb.message.text ?? "").split(sep)[0]
    const updatedText = baseText + sep + `✅ <b>Scheduled</b> by ${cb.from.first_name ?? "employee"}`

    await editMessage(chatId, messageId, updatedText, [])
    await answerCallback(cb.id, "✅ Marked as scheduled!")
  }

  // ── 🟠 Restricted ───────────────────────────────────────────────
  if (action === "r") {
    await supabase
      .from("account_pairs")
      .update({ status: "restricted", status_since: now, status_note: `Reported by ${cb.from.first_name ?? "employee"}` })
      .or(`ig_link.ilike.%${post.account.replace(/^@/, "")}%,fb_link.ilike.%${post.account.replace(/^@/, "")}%`)

    // Mark post as confirmed so no follow-up fires
    await supabase
      .from("posting_schedule")
      .update({ status: "gepostet", confirmed_at: now })
      .eq("id", postId)

    const sep2 = "\n——————————————\n"
    const baseText2 = (cb.message.text ?? "").split(sep2)[0]
    const updatedText = baseText2 + sep2 + `🟠 <b>Account restricted</b> — reported by ${cb.from.first_name ?? "employee"}`

    await editMessage(chatId, messageId, updatedText, [])
    await answerCallback(cb.id, "🟠 Account marked as restricted")

    if (OWNER_CHAT_ID) {
      await sendMessage(OWNER_CHAT_ID,
        `🟠 <b>Account Restricted</b>\n\nAccount: <b>@${post.account}</b>\nEmployee: ${cb.from.first_name ?? post.employee_name}\nPlatform: ${post.platform}\n\nPosting has been paused. Future posts will be rescheduled automatically.`
      )
    }
  }

  // ── 🔴 Banned ───────────────────────────────────────────────────
  if (action === "b") {
    await supabase
      .from("account_pairs")
      .update({ status: "banned", status_since: now, status_note: `Reported by ${cb.from.first_name ?? "employee"}` })
      .or(`ig_link.ilike.%${post.account.replace(/^@/, "")}%,fb_link.ilike.%${post.account.replace(/^@/, "")}%`)

    await supabase
      .from("posting_schedule")
      .update({ status: "gepostet", confirmed_at: now })
      .eq("id", postId)

    const sep3 = "\n——————————————\n"
    const baseText3 = (cb.message.text ?? "").split(sep3)[0]
    const updatedText = baseText3 + sep3 + `🔴 <b>Account banned</b> — reported by ${cb.from.first_name ?? "employee"}`

    await editMessage(chatId, messageId, updatedText, [])
    await answerCallback(cb.id, "🔴 Account marked as banned")

    if (OWNER_CHAT_ID) {
      await sendMessage(OWNER_CHAT_ID,
        `🔴 <b>Account Banned!</b>\n\nAccount: <b>@${post.account}</b>\nEmployee: ${cb.from.first_name ?? post.employee_name}\nPlatform: ${post.platform}\n\nAll future posts for this account are paused until you reactivate it in the dashboard.`
      )
    }
  }
}

async function handleStatusCheck(cb: {
  id: string
  from: { id: number; first_name?: string }
  message: { message_id: number; chat: { id: number }; text?: string }
  data: string
}) {
  const parts     = cb.data.split(":")
  const action    = parts[1]  // a | r | b
  const platform  = parts[2] as "ig" | "fb"
  const username  = parts.slice(3).join(":")

  if (!username) { await answerCallback(cb.id); return }

  const newStatus = action === "a" ? "active" : action === "r" ? "restricted" : "banned"
  const icon      = newStatus === "active" ? "🟢" : newStatus === "restricted" ? "🟠" : "🔴"
  const label     = newStatus === "active" ? "Active" : newStatus === "restricted" ? "Restricted" : "Banned"

  const supabase  = createServerClient()
  const now       = new Date().toISOString()
  const chatId    = String(cb.message.chat.id)
  const msgId     = cb.message.message_id

  const filter = platform === "ig" ? `ig_username.ilike.%${username}%` : `fb_username.ilike.%${username}%`
  await supabase
    .from("account_pairs")
    .update({ status: newStatus, status_since: now, status_note: `Set by ${cb.from.first_name ?? "employee"}` })
    .or(filter)

  // Re-fetch all accounts for this employee + platform to rebuild keyboard
  const { data: emp } = await supabase
    .from("employees")
    .select("name, telegram_ig_status_thread_id, telegram_fb_status_thread_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle()

  if (emp?.name) {
    const { data: pairs } = await supabase
      .from("account_pairs")
      .select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter, status")
      .or(`ig_mitarbeiter.ilike.%${emp.name}%,fb_mitarbeiter.ilike.%${emp.name}%`)

    if (pairs?.length) {
      const accounts = pairs
        .map(p => ({
          username: (platform === "ig" ? p.ig_username : p.fb_username) as string,
          status:   p.status ?? "active",
          worker:   platform === "ig" ? p.ig_mitarbeiter : p.fb_mitarbeiter,
        }))
        .filter(p => p.username && p.worker?.toLowerCase().includes(emp.name.toLowerCase()))

      if (accounts.length) {
        const keyboard = buildStatusKeyboard(accounts, platform)
        await editMessageKeyboard(chatId, msgId, keyboard)
      }
    }
  }

  await answerCallback(cb.id, `${icon} ${username} → ${label}`)

  if ((newStatus === "banned" || newStatus === "restricted") && OWNER_CHAT_ID) {
    await sendMessage(OWNER_CHAT_ID,
      `${icon} <b>Account ${label}</b>\n\nAccount: <b>${username}</b>\nPlatform: ${platform.toUpperCase()}\nEmployee: ${cb.from.first_name ?? "unknown"}\n\nPosting paused automatically.`
    )
  }
}

function statusIcon(s: string) { return s === "banned" ? "🔴" : s === "restricted" ? "🟠" : "🟢" }

function buildStatusKeyboard(accounts: { username: string; status: string }[], platform: "ig" | "fb") {
  const rows = []
  for (const acc of accounts) {
    const icon = statusIcon(acc.status)
    const name = acc.username.slice(0, 20)
    // Label row shows current status icon
    rows.push([{ text: `${icon} ${name}`, callback_data: `_` }])
    // Button row: selected option gets a ✓ indicator
    rows.push([
      { text: acc.status === "active"     ? "✅ Active ✓"     : "🟢 Active",     callback_data: `as:a:${platform}:${name}` },
      { text: acc.status === "restricted" ? "🟠 Restricted ✓" : "⬜ Restricted", callback_data: `as:r:${platform}:${name}` },
      { text: acc.status === "banned"     ? "🔴 Banned ✓"     : "⬜ Banned",     callback_data: `as:b:${platform}:${name}` },
    ])
  }
  return rows
}
