import { NextResponse } from "next/server"
import { isTokenAuthorized } from "@/lib/supabase/auth-server"

// TEMPORARY test endpoint for the FREDZ image pipeline (Seedream 4.5 via fal). Remove after testing.
export const maxDuration = 60

const TOKEN   = process.env.FAL_TEST_TOKEN ?? ""
const FAL_KEY = process.env.FAL_KEY ?? ""

const MODELS: Record<string, string> = {
  t2i:  "fal-ai/bytedance/seedream/v4.5/text-to-image",
  edit: "fal-ai/bytedance/seedream/v4.5/edit",
}

export async function POST(request: Request) {
  if (!isTokenAuthorized(request, TOKEN))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!FAL_KEY) return NextResponse.json({ error: "FAL_KEY missing on server" }, { status: 500 })

  const body  = await request.json().catch(() => ({} as Record<string, unknown>))
  const model = MODELS[(body.model as string) ?? "t2i"]
  if (!model) return NextResponse.json({ error: "bad model (use t2i or edit)" }, { status: 400 })

  const headers = { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" }

  // ── Synchronous run (good for text-to-image) ──────────────────────
  if (body.op === "sync") {
    const payload: Record<string, unknown> = { prompt: body.prompt, num_images: 1 }
    if (body.model === "edit") payload.image_urls = (body.image_urls as string[]) ?? [body.image_url]
    const r    = await fetch(`https://fal.run/${model}`, { method: "POST", headers, body: JSON.stringify(payload) })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json({ http: r.status, images: data.images ?? null, raw: data })
  }

  // ── Queue: submit (good for slower edits) ─────────────────────────
  if (body.op === "submit") {
    const payload: Record<string, unknown> = { prompt: body.prompt, num_images: 1 }
    if (body.model === "edit") payload.image_urls = (body.image_urls as string[]) ?? [body.image_url]
    const r    = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers, body: JSON.stringify(payload) })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json({ http: r.status, request_id: data.request_id, status_url: data.status_url, response_url: data.response_url, raw: data })
  }

  // ── Queue: poll result ────────────────────────────────────────────
  if (body.op === "result") {
    const s      = await fetch(body.status_url as string, { headers })
    const status = await s.json().catch(() => ({}))
    if (status.status !== "COMPLETED") return NextResponse.json({ status: status.status ?? "unknown", detail: status })
    const r    = await fetch(body.response_url as string, { headers })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json({ status: "COMPLETED", images: data.images ?? null, raw: data })
  }

  return NextResponse.json({ error: "bad op (use sync, submit, or result)" }, { status: 400 })
}
