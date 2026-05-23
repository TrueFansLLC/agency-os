"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ContentItem, ContentFilters, DEFAULT_CONTENT_FILTERS } from "@/types/content"
import { Creator } from "@/types/instagram"
import { filterContent } from "@/lib/contentLibrary"
import ContentFilterBar from "@/components/content/ContentFilterBar"
import ContentGrid      from "@/components/content/ContentGrid"

export default function ContentPage() {
  const [items,      setItems]      = useState<ContentItem[]>([])
  const [creators,   setCreators]   = useState<Creator[]>([])
  const [markets,    setMarkets]    = useState<string[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [filters,    setFilters]    = useState<ContentFilters>(DEFAULT_CONTENT_FILTERS)

  const loadData = useCallback(async () => {
    try {
      const [cRes, crRes, mRes] = await Promise.all([
        fetch("/api/content"),
        fetch("/api/creators"),
        fetch("/api/markets"),
      ])
      const [content, creators, markets] = await Promise.all([
        cRes.json(),
        crRes.json(),
        mRes.json(),
      ])
      setItems(Array.isArray(content)  ? content  : [])
      setCreators(Array.isArray(creators) ? creators : [])
      setMarkets(Array.isArray(markets) && markets.length ? markets : [])
    } catch (err) {
      console.error("Failed to load content library:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered   = useMemo(() => filterContent(items, filters), [items, filters])
  const hasContent = items.length > 0

  return (
    <div className="p-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Content Library</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Automatically save and organize viral content from tracked accounts.
        </p>
      </div>

      {/* ── Info banner — shown until first content arrives ─────── */}
      {!isLoading && !hasContent && (
        <div className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-6">
          <svg className="text-gray-500 shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div className="text-sm text-gray-400 space-y-1">
            <p className="text-white font-medium">How the Content Library works</p>
            <p>When a synced Reel crosses a viral threshold (configured in Viral Rules), it is automatically detected and saved here — including the original URL, metrics snapshot, and eventually the actual video file.</p>
            <p className="text-gray-500">Storage of the actual MP4 and thumbnail into your own bucket (Supabase Storage / S3 / R2) will be available once the download worker is implemented.</p>
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────── */}
      {!isLoading && (
        <ContentFilterBar
          filters={filters}
          onChange={setFilters}
          creators={creators}
          markets={markets}
        />
      )}

      {/* ── Content ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">Loading content library…</p>
        </div>
      ) : (
        <ContentGrid
          items={filtered}
          hasContent={hasContent}
          total={items.length}
        />
      )}
    </div>
  )
}
