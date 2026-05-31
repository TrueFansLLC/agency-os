import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// List everything Raphael currently "knows".
export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("raphael_documents")
    .select("id, title, source_type, source_url, chunk_count, created_at")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data ?? [] })
}

// Forget a document (its chunks are removed automatically via cascade).
export async function DELETE(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Keine ID angegeben." }, { status: 400 })

  const { error } = await supabase.from("raphael_documents").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
