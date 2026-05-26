import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from   = searchParams.get("from")
  const to     = searchParams.get("to")
  const status = searchParams.get("status")

  const supabase = createServerClient()
  let query = supabase.from("posting_schedule").select("*").order("send_date").order("reel_number")
  if (from)   query = query.gte("send_date", from)
  if (to)     query = query.lte("send_date", to)
  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("posting_schedule")
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
