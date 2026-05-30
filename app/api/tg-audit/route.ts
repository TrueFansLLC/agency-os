import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// TEMPORARY read-only audit endpoint — remove after use.
const TOKEN = "k7Qm2x9Rt4Lp8Wz3Bv6Nc1Hf5Yd0Sg"

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get("t") !== TOKEN)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
