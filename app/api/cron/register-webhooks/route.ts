import { NextResponse } from "next/server"
import { isTokenAuthorized } from "@/lib/supabase/auth-server"

type TelegramResponse = {
  ok: boolean
  description?: string
}

async function registerWebhook(
  token: string | undefined,
  secret: string | undefined,
  path: string
): Promise<TelegramResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl || !token || !secret) {
    return { ok: false, description: "Missing webhook server configuration." }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${appUrl}${path}`,
      secret_token: secret,
    }),
  })

  return response.json()
}

export async function POST(request: Request) {
  if (!isTokenAuthorized(request, process.env.WEBHOOK_SETUP_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [telegram, rafael] = await Promise.all([
    registerWebhook(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_WEBHOOK_SECRET,
      "/api/telegram/webhook"
    ),
    registerWebhook(
      process.env.RAFAEL_BOT_TOKEN,
      process.env.RAFAEL_WEBHOOK_SECRET,
      "/api/rafael/webhook"
    ),
  ])

  return NextResponse.json(
    { telegram, rafael },
    { status: telegram.ok && rafael.ok ? 200 : 502 }
  )
}
