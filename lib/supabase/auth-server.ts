import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

type AuthGate =
  | { user: User; response?: never }
  | { user?: never; response: NextResponse }

// Reads the currently logged-in user from the request cookies (anon key).
// Used to gate sensitive admin API routes server-side.
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}, // read-only here; we never refresh cookies from API routes
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function isAdmin(user: User | null): boolean {
  return user?.user_metadata?.role === "admin"
}

export async function isAdminUser(): Promise<boolean> {
  return isAdmin(await getSessionUser())
}

export async function requireSessionUser(): Promise<AuthGate> {
  const user = await getSessionUser()
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { user }
}

export async function requireAdminUser(): Promise<AuthGate> {
  const user = await getSessionUser()
  if (!user || !isAdmin(user)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { user }
}

export async function requireAnyPageAccess(pages: string[]): Promise<AuthGate> {
  const user = await getSessionUser()
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (isAdmin(user)) return { user }

  const allowedPages = Array.isArray(user.user_metadata?.allowed_pages)
    ? (user.user_metadata.allowed_pages as string[])
    : []

  if (!pages.some((page) => allowedPages.includes(page))) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { user }
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  )
}

export function isTokenAuthorized(request: Request, token?: string): boolean {
  return Boolean(
    token && request.headers.get("authorization") === `Bearer ${token}`
  )
}

export function isTelegramWebhookAuthorized(
  request: Request,
  secret?: string
): boolean {
  if (!secret) return true
  return (
    request.headers.get("x-telegram-bot-api-secret-token") === secret
  )
}
