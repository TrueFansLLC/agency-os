import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// TEMPORARY one-off rename endpoint — remove after use.
const TOKEN = "Rn4Wq8Lx2Mp6Tz9Bv3Kc7Hd1Yf5Sg0"
const OLD = "Lhoray"
const NEW = "Lhorjay"

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get("t") !== TOKEN)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServerClient()
  const results: Record<string, unknown> = {}

  const e = await supabase.from("employees").update({ name: NEW }).eq("name", OLD).select("id")
  results.employees = e.error ? e.error.message : e.data?.length

  const a1 = await supabase.from("account_pairs").update({ ig_mitarbeiter: NEW }).eq("ig_mitarbeiter", OLD).select("id")
  results.account_pairs_ig = a1.error ? a1.error.message : a1.data?.length

  const a2 = await supabase.from("account_pairs").update({ fb_mitarbeiter: NEW }).eq("fb_mitarbeiter", OLD).select("id")
  results.account_pairs_fb = a2.error ? a2.error.message : a2.data?.length

  const a3 = await supabase.from("account_pairs").update({ content_creator: NEW }).eq("content_creator", OLD).select("id")
  results.account_pairs_content = a3.error ? a3.error.message : a3.data?.length

  const ps = await supabase.from("posting_schedule").update({ employee_name: NEW }).eq("employee_name", OLD).select("id")
  results.posting_schedule = ps.error ? ps.error.message : ps.data?.length

  return NextResponse.json(results)
}
