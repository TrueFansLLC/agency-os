import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const archived = searchParams.get("archived") === "1"
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("account_pairs")
    .select("*")
    .order("creator")
    .order("branding")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const filtered = (data || []).filter(r => archived ? r.archived === true : r.archived !== true)
  return NextResponse.json(filtered)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("account_pairs")
    .insert([body])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
