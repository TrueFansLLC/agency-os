import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

// PUBLIC route: a new employee self-registers with email + password.
// No login required — this is how people get their first account.
// New accounts get role "employee" with default page access; the admin
// refines which pages they see afterwards in /team.
export async function POST(request: NextRequest) {
  const { email, name, password } = await request.json()

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Bitte eine gültige E-Mail eingeben." }, { status: 400 })
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no confirmation email — account is active immediately
    user_metadata: {
      name: name?.trim() || email,
      role: "employee",
      allowed_pages: ["posting-planer"],
    },
  })

  if (error) {
    const alreadyExists = /already|registered|exists/i.test(error.message)
    if (alreadyExists) {
      return NextResponse.json(
        { error: "Diese E-Mail ist schon registriert. Bitte einfach einloggen." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
