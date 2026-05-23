import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("creators")
    .select("id, name")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { name } = await request.json()

  const { data, error } = await supabase
    .from("creators")
    .upsert({ name: name.trim() }, { onConflict: "name" })
    .select("id, name")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
