import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("markets")
    .select("name")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(m => m.name))
}

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { name } = await request.json()

  const { data, error } = await supabase
    .from("markets")
    .upsert({ name: name.trim() }, { onConflict: "name" })
    .select("name")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.name, { status: 201 })
}
