import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getReadyPosts, markAsSent } from "@/lib/notion"
import { sendVideo, sendMessage } from "@/lib/telegram"

// Called every 5 minutes by Vercel Cron.
// Finds Notion posts with Status="Bereit", looks up the right employee's
// Telegram chat ID from account_pairs, sends the video, marks as Gesendet.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServerClient()
  const posts = await getReadyPosts()

  if (!posts.length) {
    return NextResponse.json({ ok: true, dispatched: 0 })
  }

  let dispatched = 0

  for (const post of posts) {
    // Find the account_pair for this account to get employee Telegram IDs
    const username = post.account.replace(/^@/, "")
    const { data: pair } = await supabase
      .from("account_pairs")
      .select("ig_mitarbeiter, fb_mitarbeiter")
      .or(`ig_link.ilike.%${username}%,fb_link.ilike.%${username}%`)
      .maybeSingle()

    const platform = post.platform // "Instagram", "Facebook", "IG + FB"
    const caption = buildCaption(post)

    const chatIds: string[] = []

    if ((platform === "Instagram" || platform === "IG + FB") && pair?.ig_mitarbeiter) {
      const chatId = await getChatId(supabase, pair.ig_mitarbeiter)
      if (chatId) chatIds.push(chatId)
    }
    if ((platform === "Facebook" || platform === "IG + FB") && pair?.fb_mitarbeiter) {
      const chatId = await getChatId(supabase, pair.fb_mitarbeiter)
      if (chatId && !chatIds.includes(chatId)) chatIds.push(chatId)
    }

    if (!chatIds.length) {
      // No Telegram ID found — skip but don't fail
      continue
    }

    for (const chatId of chatIds) {
      if (post.videoLink) {
        await sendVideo(chatId, post.videoLink, caption)
      } else {
        await sendMessage(chatId, caption)
      }
    }

    await markAsSent(post.id)
    dispatched++
  }

  return NextResponse.json({ ok: true, dispatched, total: posts.length })
}

function buildCaption(post: { post: string; caption: string; account: string; platform: string; datum: string | null }) {
  const lines: string[] = []
  lines.push(`📱 <b>${post.account}</b> · ${post.platform}`)
  if (post.datum) lines.push(`📅 ${post.datum}`)
  if (post.post) lines.push(`\n<b>${post.post}</b>`)
  if (post.caption) lines.push(`\n${post.caption}`)
  return lines.join("\n")
}

// Look up the Telegram chat_id for an employee by name
async function getChatId(supabase: ReturnType<typeof createServerClient>, employeeName: string): Promise<string | null> {
  const { data } = await supabase
    .from("employees")
    .select("telegram_chat_id")
    .ilike("name", `%${employeeName}%`)
    .maybeSingle()
  return data?.telegram_chat_id ?? null
}
