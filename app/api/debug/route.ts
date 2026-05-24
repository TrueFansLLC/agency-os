import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServerClient()
  const { data, error, count } = await supabase
    .from("account_pairs")
    .select("*", { count: "exact" })

  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40),
    rowCount: count,
    error: error?.message ?? null,
    firstRow: data?.[0] ?? null,
  })
}
