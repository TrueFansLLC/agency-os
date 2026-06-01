import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/supabase/auth-server"

// Runs arbitrary SQL against the database via the exec_sql() helper function.
// HEAVILY gated: only logged-in admins can call this. The exec_sql function
// itself is security-definer and only granted to the service_role.
export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_SQL !== "true") {
    return NextResponse.json({ error: "SQL-Konsole ist deaktiviert." }, { status: 404 })
  }

  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 })
  }

  const { sql } = await request.json().catch(() => ({ sql: null }))
  if (!sql || typeof sql !== "string" || !sql.trim()) {
    return NextResponse.json({ error: "Kein SQL angegeben." }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.rpc("exec_sql", { query: sql })

  if (error) {
    // Most common first-time error: the helper function doesn't exist yet.
    const needsSetup = /function .*exec_sql.* does not exist/i.test(error.message)
    return NextResponse.json(
      { error: error.message, needsSetup },
      { status: 400 }
    )
  }

  return NextResponse.json({ result: data })
}
