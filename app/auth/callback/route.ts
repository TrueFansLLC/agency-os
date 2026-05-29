import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type       = searchParams.get("type")
  const next       = searchParams.get("next") ?? "/"

  const cookieBuffer: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) { cookieBuffer.push(...cookiesToSet) },
      },
    }
  )

  console.log('[auth/callback] params:', { code: !!code, token_hash: !!token_hash, type })

  let user: import("@supabase/supabase-js").User | null = null
  let error: unknown = null

  if (code) {
    console.log('[auth/callback] using PKCE code flow')
    const result = await supabase.auth.exchangeCodeForSession(code)
    user  = result.data?.user ?? null
    error = result.error
    console.log('[auth/callback] code result:', { user: !!user, error })
  } else if (token_hash && type) {
    console.log('[auth/callback] using token_hash flow')
    const result = await supabase.auth.verifyOtp({ token_hash, type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"] })
    user  = result.data?.user ?? null
    error = result.error
    console.log('[auth/callback] token_hash result:', { user: !!user, error })
  } else {
    console.log('[auth/callback] no code or token_hash — redirecting to login')
  }

  if (!error && user) {
    const isInvite    = !!user.invited_at
    const redirectPath = isInvite ? "/set-password" : next

    const response = NextResponse.redirect(`${origin}${redirectPath}`)
    cookieBuffer.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    })
    return response
  }

  return NextResponse.redirect(`${origin}/login?error=invite_expired`)
}
