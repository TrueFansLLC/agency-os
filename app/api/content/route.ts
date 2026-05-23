import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { ContentItem } from "@/types/content"

// ── GET /api/content ──────────────────────────────────────────────────────────
// Returns all content items with creator/market/account joins and latest metrics.
export async function GET() {
  const supabase = createServerClient()

  const { data: rows, error } = await supabase
    .from("content_items")
    .select(`
      *,
      creator:creators!creator_id(id, name),
      market:markets!market_id(id, name),
      account:instagram_accounts!instagram_account_id(id, username)
    `)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json([])

  const ids = rows.map(r => r.id)

  // Fetch latest metric snapshot per item
  const { data: snapshots } = await supabase
    .from("content_metric_snapshots")
    .select("*")
    .in("content_item_id", ids)
    .order("checked_at", { ascending: false })

  const latestSnap = new Map<string, typeof snapshots extends (infer T)[] | null ? T : never>()
  for (const s of snapshots ?? []) {
    if (!latestSnap.has(s.content_item_id)) latestSnap.set(s.content_item_id, s)
  }

  // Fetch tags
  const { data: tags } = await supabase
    .from("content_tags")
    .select("content_item_id, tag")
    .in("content_item_id", ids)

  const tagMap = new Map<string, string[]>()
  for (const t of tags ?? []) {
    if (!tagMap.has(t.content_item_id)) tagMap.set(t.content_item_id, [])
    tagMap.get(t.content_item_id)!.push(t.tag)
  }

  const result: ContentItem[] = rows.map(r => {
    const snap = latestSnap.get(r.id)
    return {
      id:                   r.id,
      creatorId:            r.creator_id ?? null,
      creatorName:          (r.creator as any)?.name ?? "",
      marketId:             r.market_id ?? null,
      market:               (r.market as any)?.name ?? "",
      instagramAccountId:   r.instagram_account_id ?? null,
      instagramUsername:    (r.account as any)?.username ?? "",
      platform:             r.platform,
      contentType:          r.content_type,
      originalUrl:          r.original_url,
      mediaUrl:             r.media_url ?? null,
      thumbnailUrl:         r.thumbnail_url ?? null,
      storageVideoPath:     r.storage_video_path ?? null,
      storageThumbnailPath: r.storage_thumbnail_path ?? null,
      caption:              r.caption,
      postedAt:             r.posted_at ?? null,
      detectedAt:           r.detected_at,
      savedAt:              r.saved_at ?? null,
      viralTier:            r.viral_tier,
      status:               r.status,
      notes:                r.notes,
      createdAt:            r.created_at,
      updatedAt:            r.updated_at,
      latestMetrics: snap ? {
        id:            snap.id,
        contentItemId: snap.content_item_id,
        checkedAt:     snap.checked_at,
        views:         snap.views,
        likes:         snap.likes,
        comments:      snap.comments,
        shares:        snap.shares,
        saves:         snap.saves,
        createdAt:     snap.created_at,
      } : null,
      tags: tagMap.get(r.id) ?? [],
    }
  })

  return NextResponse.json(result)
}

// ── POST /api/content ─────────────────────────────────────────────────────────
// Manually add a content item (e.g. from a paste of an Instagram URL).
export async function POST(request: Request) {
  const supabase = createServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("content_items")
    .insert({
      creator_id:           body.creatorId  ?? null,
      market_id:            body.marketId   ?? null,
      instagram_account_id: body.instagramAccountId ?? null,
      platform:             body.platform   ?? "instagram",
      content_type:         body.contentType ?? "reel",
      original_url:         body.originalUrl,
      media_url:            body.mediaUrl   ?? null,
      thumbnail_url:        body.thumbnailUrl ?? null,
      caption:              body.caption    ?? "",
      posted_at:            body.postedAt   ?? null,
      viral_tier:           body.viralTier  ?? "C",
      status:               body.status     ?? "link_only",
      notes:                body.notes      ?? "",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
