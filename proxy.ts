import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Pages that are always public (no auth needed)
const PUBLIC_PATHS = ["/login", "/register", "/auth", "/set-password", "/unauthorized", "/api/register", "/api/cron", "/api/telegram/webhook", "/api/rafael/webhook", "/api/sync", "/api/facebook-sync", "/api/fal-test", "/api/threads/generate"]

// Pages that require admin role
const ADMIN_ONLY = ["/admin", "/settings", "/employees", "/revenue", "/team", "/account-status", "/creators", "/rafael", "/tasks", "/threads", "/content-bank", "/quality-review"]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  )
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isPublic) return supabaseResponse

    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Logged in on login page → home
  if (user && path === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  if (user) {
    const role          = user.user_metadata?.role as string | undefined
    const allowedPages  = (user.user_metadata?.allowed_pages ?? []) as string[]
    const isEmployee    = role === "employee"
    const isAdminOnly   = path === "/" || ADMIN_ONLY.some(
      prefix => path === prefix || path.startsWith(`${prefix}/`)
    )

    if (isAdminOnly && role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = allowedPages[0] ? `/${allowedPages[0]}` : "/unauthorized"
      return NextResponse.redirect(url)
    }

    // API routes perform their own authorization close to the data access.
    if (path.startsWith("/api/")) return supabaseResponse

    if (isEmployee) {
      // Employees never see admin-only pages
      if (isAdminOnly) {
        const url = request.nextUrl.clone()
        url.pathname = allowedPages[0] ? `/${allowedPages[0]}` : "/unauthorized"
        return NextResponse.redirect(url)
      }

      // Check if employee has access to this path
      const segment = path.split("/")[1]  // e.g. "posting-planer"
      if (segment && !isPublic && !allowedPages.includes(segment)) {
        const url = request.nextUrl.clone()
        url.pathname = allowedPages[0] ? `/${allowedPages[0]}` : "/unauthorized"
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
