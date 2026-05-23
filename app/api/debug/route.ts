import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const checks: Record<string, unknown> = {
    env: {
      url,
      keyStart: key ? key.slice(0, 30) + "…" : "MISSING",
      keyLen:   key?.length ?? 0,
    },
  }

  // ── 1. Raw REST API call (bypasses JS client entirely) ────────────
  try {
    const restRes = await fetch(`${url}/rest/v1/creators?select=id&limit=1`, {
      headers: {
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
      },
    })
    const restBody = await restRes.text()
    checks["rest_select"] = { status: restRes.status, body: restBody.slice(0, 300) }
  } catch (e: unknown) {
    checks["rest_select"] = { exception: e instanceof Error ? e.message : String(e) }
  }

  // ── 2. Raw REST INSERT ────────────────────────────────────────────
  try {
    const restRes = await fetch(`${url}/rest/v1/creators`, {
      method: "POST",
      headers: {
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
      body: JSON.stringify({ name: "__debug_insert__" }),
    })
    const body = await restRes.text()
    checks["rest_insert"] = { status: restRes.status, body: body.slice(0, 300) }

    // Clean up if it succeeded
    if (restRes.status === 201) {
      let id: string | undefined
      try { id = JSON.parse(body)?.[0]?.id } catch {}
      if (id) {
        await fetch(`${url}/rest/v1/creators?id=eq.${id}`, {
          method: "DELETE",
          headers: { "apikey": key, "Authorization": `Bearer ${key}` },
        })
      }
    }
  } catch (e: unknown) {
    checks["rest_insert"] = { exception: e instanceof Error ? e.message : String(e) }
  }

  // ── 3. JS client select (to see full error object) ────────────────
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.from("creators").select("id").limit(1)
    checks["js_select"] = error
      ? { error: error.message, code: error.code, details: error.details, hint: error.hint }
      : { rows: data?.length ?? 0 }
  } catch (e: unknown) {
    checks["js_select"] = { exception: e instanceof Error ? e.message : String(e) }
  }

  // ── 4. JS client insert ───────────────────────────────────────────
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("creators")
      .insert({ name: "__debug_js__" })
      .select("id")
      .single()

    if (error) {
      checks["js_insert"] = { error: error.message, code: error.code, details: error.details, hint: error.hint }
    } else {
      checks["js_insert"] = { ok: true, id: data?.id }
      if (data?.id) {
        await supabase.from("creators").delete().eq("id", data.id)
      }
    }
  } catch (e: unknown) {
    checks["js_insert"] = { exception: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(checks, { status: 200 })
}
