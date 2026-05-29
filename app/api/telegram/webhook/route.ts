import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { sendMessage, editMessage, answerCallback, editMessageKeyboard } from "@/lib/telegram"
import { alertAccountStatus } from "@/lib/rafael"

const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID ?? ""

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // ── Inline button tap (callback_query) ──────────────────────────
  if (body.callback_query) {
    const data = body.callback_query.data ?? ""
    if (data.startsWith("aa:")) {
      await handleAllActive(body.callback_query)
    } else if (data.startsWith("pm:")) {
      await handleProblemReport(body.callback_query)
    } else if (data.startsWith("sc:")) {
      await handleStatusCycle(body.callback_query)
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

async function handleAllActive(cb: {
  id: string
  data: string
  from: { id: number; first_name?: string }
  message: { message_id: number; chat: { id: number }; text?: string }
}) {
  const platform = cb.data.split(":")[1] as "ig" | "fb"
  const chatId   = String(cb.message.chat.id)
  const msgId    = cb.message.message_id
  const now      = new Date().toISOString()
  const time     = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })

  await answerCallback(cb.id, "✅ Alle Active gespeichert!")

  const supabase = createServerClient()
  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("telegram_chat_id", chatId)
    .maybeSingle()

  if (!emp?.name) return

  const { data: pairs } = await supabase
    .from("account_pairs")
    .select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter")
    .or(`ig_mitarbeiter.ilike.%${emp.name}%,fb_mitarbeiter.ilike.%${emp.name}%`)

  const usernameField = platform === "ig" ? "ig_username" : "fb_username"
  const workerField   = platform === "ig" ? "ig_mitarbeiter" : "fb_mitarbeiter"

  const accounts = (pairs ?? [])
    .filter(p => (p[workerField] as string | null)?.toLowerCase().includes(emp.name.toLowerCase()) && p[usernameField])
    .map(p => p[usernameField] as string)

  for (const username of accounts) {
    await supabase
      .from("account_pairs")
      .update({ status: "active", status_since: now, status_note: `Alle Active by ${cb.from.first_name ?? emp.name}` })
      .ilike(usernameField, username)
  }

  const names = accounts.map(u => `@${u}`).join("  ·  ")
  await editMessage(chatId, msgId,
    `✅ <b>Alle ${platform.toUpperCase()} Accounts Active</b>\n${cb.from.first_name ?? emp.name} · ${time} Bangkok\n\n${names}`,
    []
  )
}

async function handleProblemReport(cb: {
  id: string
  data: string
  from: { id: number; first_name?: string }
  message: { message_id: number; chat: { id: number }; text?: string; message_thread_id?: number }
}) {
  const platform  = cb.data.split(":")[1] as "ig" | "fb"
  const chatId    = String(cb.message.chat.id)
  const msgId     = cb.message.message_id
  const threadId  = cb.message.message_thread_id

  await answerCallback(cb.id, "⚠️ Accounts werden einzeln angezeigt...")

  await editMessage(chatId, msgId,
    (cb.message.text ?? "") + `\n\n⚠️ <b>${cb.from.first_name ?? "Mitarbeiter"} meldet ein Problem — Status wird pro Account gesetzt:</b>`,
    []
  )

  const supabase = createServerClient()
  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("telegram_chat_id", chatId)
    .maybeSingle()

  if (!emp?.name) return

  const { data: pairs } = await supabase
    .from("account_pairs")
    .select("ig_username, fb_username, ig_mitarbeiter, fb_mitarbeiter, status")
    .or(`ig_mitarbeiter.ilike.%${emp.name}%,fb_mitarbeiter.ilike.%${emp.name}%`)

  const usernameField = platform === "ig" ? "ig_username" : "fb_username"
  const workerField   = platform === "ig" ? "ig_mitarbeiter" : "fb_mitarbeiter"

  const accounts = (pairs ?? [])
    .filter(p => (p[workerField] as string | null)?.toLowerCase().includes(emp.name.toLowerCase()) && p[usernameField])
    .map(p => ({ username: p[usernameField] as string, status: p.status ?? "active" }))

  for (const acc of accounts) {
    const s    = acc.status
    const icon = s === "banned" ? "🔴" : s === "restricted" ? "🟠" : "🟢"
    const name = acc.username.slice(0, 22)
    await sendMessage(chatId,
      `${icon} <b>@${name}</b> — ${platform.toUpperCase()}`,
      threadId,
      [[
        { text: s === "active"     ? "✅ Active"     : "Active",     callback_data: `sc:${platform}:a:${name}` },
        { text: s === "restricted" ? "🟠 Restricted" : "Restricted", callback_data: `sc:${platform}:r:${name}` },
        { text: s === "banned"     ? "🔴 Banned"     : "Banned",     callback_data: `sc:${platform}:b:${name}` },
      ]]
    )
  }
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

    const { count: postsToday } = await supabase
      .from("posting_schedule")
      .select("*", { count: "exact", head: true })
      .eq("account", post.account)
      .eq("send_date", new Date().toISOString().slice(0, 10))
      .neq("status", "gepostet")

    await alertAccountStatus({
      account:    post.account,
      platform:   post.platform,
      newStatus:  "restricted",
      employee:   cb.from.first_name ?? "Mitarbeiter",
      postsToday: postsToday ?? 0,
    })
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

    const { count: postsTodayBanned } = await supabase
      .from("posting_schedule")
      .select("*", { count: "exact", head: true })
      .eq("account", post.account)
      .eq("send_date", new Date().toISOString().slice(0, 10))
      .neq("status", "gepostet")

    await alertAccountStatus({
      account:    post.account,
      platform:   post.platform,
      newStatus:  "banned",
      employee:   cb.from.first_name ?? "Mitarbeiter",
      postsToday: postsTodayBanned ?? 0,
    })
  }
}

async function handleStatusCycle(cb: {
  id: string
  from: { id: number; first_name?: string }
  message: { message_id: number; chat: { id: number } }
  data: string
}) {
  // data: sc:{ig|fb}:{a|r|b}:{username}
  const parts     = cb.data.split(":")
  const platform  = parts[1] as "ig" | "fb"
  const action    = parts[2]  // a | r | b
  const username  = parts.slice(3).join(":")
  if (!username || !action) { await answerCallback(cb.id); return }

  const newStatus = action === "b" ? "banned" : action === "r" ? "restricted" : "active"
  const icon      = newStatus === "banned" ? "🔴" : newStatus === "restricted" ? "🟠" : "✅"
  const label     = newStatus === "banned" ? "Banned" : newStatus === "restricted" ? "Restricted" : "Active"

  // Answer immediately — removes the clock icon on the button right away
  await answerCallback(cb.id, `${icon} ${label} gespeichert`)

  const supabase = createServerClient()
  const now      = new Date().toISOString()
  const chatId   = String(cb.message.chat.id)
  const msgId    = cb.message.message_id

  const usernameField = platform === "ig" ? "ig_username" : "fb_username"
  await supabase
    .from("account_pairs")
    .update({ status: newStatus, status_since: now, status_note: `Set by ${cb.from.first_name ?? "employee"}` })
    .ilike(usernameField, username)

  // Rebuild keyboard — confirmed account collapses to single row (no more multi-select)
  const { data: emp } = await supabase
    .from("employees")
    .select("name")
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
        const keyboard = buildStatusKeyboard(accounts, platform, username)
        await editMessageKeyboard(chatId, msgId, keyboard)
      }
    }
  }

  if (newStatus === "banned" || newStatus === "restricted") {
    const { count: postsLeft } = await supabase
      .from("posting_schedule")
      .select("*", { count: "exact", head: true })
      .eq("account", username)
      .eq("send_date", new Date().toISOString().slice(0, 10))
      .neq("status", "gepostet")

    await alertAccountStatus({
      account:    username,
      platform:   platform.toUpperCase(),
      newStatus,
      employee:   cb.from.first_name ?? "Mitarbeiter",
      postsToday: postsLeft ?? 0,
    })
  }
}

function buildStatusKeyboard(
  accounts: { username: string; status: string }[],
  platform: "ig" | "fb",
  confirmedUsername?: string
) {
  const rows = []
  for (const acc of accounts) {
    const name = acc.username.slice(0, 22)
    const s    = acc.status ?? "active"
    const icon = s === "banned" ? "🔴" : s === "restricted" ? "🟠" : "🟢"

    // Account just confirmed → collapse to single locked row, no more buttons
    if (confirmedUsername && acc.username.toLowerCase() === confirmedUsername.toLowerCase()) {
      const lbl = s === "banned" ? "Banned" : s === "restricted" ? "Restricted" : "Active"
      rows.push([{ text: `${icon} @${name} — ✓ ${lbl}`, callback_data: `_` }])
    } else {
      rows.push([{ text: `${icon} @${name}`, callback_data: `_` }])
      rows.push([
        { text: s === "active"     ? "✅ Active"     : "Active",     callback_data: `sc:${platform}:a:${name}` },
        { text: s === "restricted" ? "🟠 Restricted" : "Restricted", callback_data: `sc:${platform}:r:${name}` },
        { text: s === "banned"     ? "🔴 Banned"     : "Banned",     callback_data: `sc:${platform}:b:${name}` },
      ])
    }
  }
  return rows
}
