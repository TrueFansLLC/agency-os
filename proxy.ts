import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Pages that are always public (no auth needed)
const PUBLIC_PATHS = ["/login", "/auth", "/set-password", "/unauthorized", "/api/cron", "/api/telegram", "/api/rafael", "/api/accounts", "/api/accounts/import", "/api/creators", "/api/markets", "/api/tg-describe"]

// Pages that require admin role
const ADMIN_ONLY = ["/settings", "/employees", "/revenue", "/team", "/account-status"]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const path = request.nextUrl.pathname

  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p))

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

    if (isEmployee) {
      // Employees never see admin-only pages
      if (ADMIN_ONLY.some(p => path.startsWith(p))) {
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
