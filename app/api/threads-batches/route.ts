import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date      = searchParams.get("date")
  const accountId = searchParams.get("account_id")
  const supabase  = createServerClient()

  let query = supabase
    .from("threads_daily_batches")
    .select("*, account:threads_accounts(*)")
    .order("date", { ascending: false })

  if (date)      query = query.eq("date", date)
  if (accountId) query = query.eq("account_id", accountId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body     = await request.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("threads_daily_batches")
    .insert([body])
    .select("*, account:threads_accounts(*)")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
