import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const archived = searchParams.get("archived") === "1"
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("threads_accounts")
    .select("*")
    .eq("archived", archived)
    .order("creator")
    .order("username")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("threads_accounts")
    .insert([body])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
