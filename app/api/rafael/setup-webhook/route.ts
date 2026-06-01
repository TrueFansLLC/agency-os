import { NextResponse, type NextRequest } from "next/server"
import { requireAdminUser } from "@/lib/supabase/auth-server"

// Registers both Telegram bots' webhooks WITH their secret_token, using the
// server-side env values. Auth-protected via proxy.ts (logged-in admin only).
// Run this once after enabling the webhook-secret check, so the bots keep working.

async function setWebhook(token: string, url: string, secret: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // No allowed_updates → keep whatever was configured before (don't drop callback_query etc.)
    body: JSON.stringify({ url, secret_token: secret }),
  })
  return res.json()
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser()
  if (auth.response) return auth.response

  const origin = new URL(request.url).origin
  const out: Record<string, { ok: boolean; description?: string }> = {}

  const rafaelToken  = process.env.RAFAEL_BOT_TOKEN
  const rafaelSecret = process.env.RAFAEL_WEBHOOK_SECRET
  if (rafaelToken && rafaelSecret) {
    const r = await setWebhook(rafaelToken, `${origin}/api/rafael/webhook`, rafaelSecret)
    out.rafael = { ok: !!r.ok, description: r.description }
  } else {
    out.rafael = { ok: false, description: "RAFAEL_BOT_TOKEN oder RAFAEL_WEBHOOK_SECRET fehlt" }
  }

  const peterToken  = process.env.TELEGRAM_BOT_TOKEN
  const peterSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (peterToken && peterSecret) {
    const r = await setWebhook(peterToken, `${origin}/api/telegram/webhook`, peterSecret)
    out.peter = { ok: !!r.ok, description: r.description }
  } else {
    out.peter = { ok: false, description: "TELEGRAM_BOT_TOKEN oder TELEGRAM_WEBHOOK_SECRET fehlt" }
  }

  const allOk = Object.values(out).every((r) => r.ok)
  return NextResponse.json({ ok: allOk, results: out })
}
