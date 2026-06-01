"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

type AssetStatus = "saved" | "ready" | "assigned" | "used" | "archived"
type PackStatus = "draft" | "ready" | "exported" | "used" | "archived"

type ContentAsset = {
  id: string
  creator: string
  source: string
  status: AssetStatus
  source_label: string | null
  prompt: string | null
  signed_preview_url: string | null
  created_at: string
  pack_assets: { pack_id: string }[]
}

type ContentPack = {
  id: string
  name: string
  creator: string | null
  pack_type: "starter" | "daily" | "reusable"
  status: PackStatus
  drive_folder_url: string | null
  asset_count: number
  created_at: string
}

const CREATORS = ["all", "Cathy", "Neyla", "Romina"]
const ASSET_STATUSES: { value: "all" | AssetStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "saved", label: "Saved" },
  { value: "ready", label: "Ready" },
  { value: "assigned", label: "Assigned" },
  { value: "used", label: "Used" },
  { value: "archived", label: "Archived" },
]
const ASSET_STATUS_STYLE: Record<AssetStatus, string> = {
  saved: "border-sky-700 bg-sky-900/30 text-sky-300",
  ready: "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  assigned: "border-violet-700 bg-violet-900/30 text-violet-300",
  used: "border-gray-700 bg-gray-800 text-gray-300",
  archived: "border-gray-800 bg-gray-950 text-gray-500",
}
const PACK_STATUS_STYLE: Record<PackStatus, string> = {
  draft: "text-amber-300",
  ready: "text-emerald-300",
  exported: "text-violet-300",
  used: "text-gray-300",
  archived: "text-gray-500",
}

export default function ContentBankPage() {
  const [assets, setAssets] = useState<ContentAsset[]>([])
  const [packs, setPacks] = useState<ContentPack[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creator, setCreator] = useState("all")
  const [status, setStatus] = useState<"all" | AssetStatus>("all")
  const [search, setSearch] = useState("")
  const [packName, setPackName] = useState("")
  const [packType, setPackType] = useState<"starter" | "daily" | "reusable">("starter")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")

  const loadAssets = useCallback(async () => {
    const params = new URLSearchParams({ creator, status })
    const response = await fetch(`/api/content-assets?${params}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error ?? "Could not load content assets.")
    setAssets(data.assets ?? [])
  }, [creator, status])

  const loadPacks = useCallback(async () => {
    const response = await fetch("/api/content-packs")
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error ?? "Could not load content packs.")
    setPacks(data.packs ?? [])
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      await Promise.all([loadAssets(), loadPacks()])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the content bank.")
    } finally {
      setLoading(false)
    }
  }, [loadAssets, loadPacks])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredAssets = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return assets
    return assets.filter(asset => [asset.creator, asset.source_label, asset.prompt].some(value => value?.toLowerCase().includes(needle)))
  }, [assets, search])

  const selectedAssets = assets.filter(asset => selectedIds.includes(asset.id))
  const selectionCreator = selectedAssets.length && selectedAssets.every(asset => asset.creator === selectedAssets[0].creator)
    ? selectedAssets[0].creator
    : null

  function toggleAsset(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(assetId => assetId !== id) : [...current, id])
  }

  async function updateAssets(nextStatus: AssetStatus) {
    if (!selectedIds.length) return
    setWorking(true)
    setError("")
    const response = await fetch("/api/content-assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, status: nextStatus }),
    })
    const data = await response.json().catch(() => ({}))
    setWorking(false)
    if (!response.ok) {
      setError(data.error ?? "The selected images could not be updated.")
      return
    }
    setSelectedIds([])
    await loadAssets()
  }

  async function createPack() {
    if (!selectedIds.length || !packName.trim()) return
    setWorking(true)
    setError("")
    const response = await fetch("/api/content-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: packName,
        creator: selectionCreator,
        pack_type: packType,
        asset_ids: selectedIds,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setWorking(false)
    if (!response.ok) {
      setError(data.error ?? "The pack could not be created.")
      return
    }
    setPackName("")
    setSelectedIds([])
    await loadData()
  }

  async function updatePackStatus(packId: string, nextStatus: PackStatus) {
    setWorking(true)
    setError("")
    const response = await fetch(`/api/content-packs/${packId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })
    const data = await response.json().catch(() => ({}))
    setWorking(false)
    if (!response.ok) {
      setError(data.error ?? "The pack could not be updated.")
      return
    }
    await loadPacks()
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-white">Content Bank</h1>
          <p className="text-gray-400 mt-1 text-sm">Curate reusable images, prepare account packs and track what has already been used.</p>
        </div>
        <Link href="/ai-tools" className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">
          Generate images
        </Link>
      </div>

      {error && <p className="text-sm text-red-300 border border-red-900 bg-red-950/40 rounded-lg px-4 py-3 mb-5">{error}</p>}

      <div className="grid xl:grid-cols-[1fr_330px] gap-6">
        <section>
          <div className="flex flex-wrap gap-3 mb-4">
            <input value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Search labels or prompts..."
              className="min-w-64 flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"/>
            <select value={creator} onChange={event => setCreator(event.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
              {CREATORS.map(option => <option key={option} value={option}>{option === "all" ? "All creators" : option}</option>)}
            </select>
            <select value={status} onChange={event => setStatus(event.target.value as "all" | AssetStatus)}
              className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500">
              {ASSET_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          {selectedIds.length > 0 && (
            <div className="sticky top-3 z-10 bg-gray-900 border border-violet-700 rounded-xl px-4 py-3 mb-4 shadow-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white text-sm font-medium mr-2">{selectedIds.length} selected</span>
                <button onClick={() => void updateAssets("ready")} disabled={working}
                  className="px-3 py-1.5 rounded-md border border-emerald-800 text-emerald-300 text-xs hover:bg-emerald-900/30 disabled:opacity-50">
                  Mark ready
                </button>
                <button onClick={() => void updateAssets("used")} disabled={working}
                  className="px-3 py-1.5 rounded-md border border-gray-700 text-gray-300 text-xs hover:bg-gray-800 disabled:opacity-50">
                  Mark used
                </button>
                <button onClick={() => void updateAssets("archived")} disabled={working}
                  className="px-3 py-1.5 rounded-md border border-gray-800 text-gray-500 text-xs hover:text-gray-300 disabled:opacity-50">
                  Archive
                </button>
                <button onClick={() => setSelectedIds([])} className="ml-auto text-xs text-gray-500 hover:text-white">Clear selection</button>
              </div>
              <div className="grid md:grid-cols-[1fr_150px_auto] gap-2 mt-3">
                <input value={packName} onChange={event => setPackName(event.target.value)}
                  placeholder={`${selectionCreator ?? "Creator"} starter pack name`}
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500"/>
                <select value={packType} onChange={event => setPackType(event.target.value as typeof packType)}
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                  <option value="starter">Starter pack</option>
                  <option value="daily">Daily pack</option>
                  <option value="reusable">Reusable pool</option>
                </select>
                <button onClick={() => void createPack()} disabled={working || !packName.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
                  Create pack
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center text-sm text-gray-500">Loading content bank...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
              <p className="text-white font-medium">No saved images match these filters</p>
              <p className="text-gray-500 text-sm mt-1">Generate images and use “Save to library” on the results you want to keep.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4">
              {filteredAssets.map(asset => {
                const selected = selectedIds.includes(asset.id)
                return (
                  <article key={asset.id} className={`overflow-hidden rounded-xl border bg-gray-900 transition-colors ${selected ? "border-violet-500" : "border-gray-800 hover:border-gray-700"}`}>
                    <div className="relative aspect-[4/5] bg-gray-950">
                      {asset.signed_preview_url ? (
                        <Image src={asset.signed_preview_url} alt={`${asset.creator} saved content`} fill unoptimized className="object-cover"/>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-gray-600">Preview unavailable</div>
                      )}
                      <label className="absolute left-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-600 bg-gray-950/90">
                        <input type="checkbox" checked={selected} onChange={() => toggleAsset(asset.id)} className="accent-violet-500"/>
                      </label>
                    </div>
                    <div className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-white text-sm font-medium">{asset.creator}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${ASSET_STATUS_STYLE[asset.status]}`}>{asset.status}</span>
                      </div>
                      {asset.source_label && <p className="mt-1 truncate text-xs text-violet-300">{asset.source_label}</p>}
                      <p className="mt-2 line-clamp-2 text-xs text-gray-500">{asset.prompt}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-2">
                        <span className="text-[11px] text-gray-600">{asset.pack_assets.length ? `${asset.pack_assets.length} pack${asset.pack_assets.length === 1 ? "" : "s"}` : "Not packed"}</span>
                        {asset.signed_preview_url && <a href={asset.signed_preview_url} target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:text-violet-200">Open</a>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="mb-4">
            <h2 className="text-white font-semibold">Content packs</h2>
            <p className="mt-1 text-xs text-gray-500">Prepare packs here. Google Drive export is the next automation step.</p>
          </div>
          {packs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-700 px-3 py-5 text-center text-xs text-gray-500">Select images to create your first starter pack.</p>
          ) : (
            <div className="space-y-3">
              {packs.map(pack => (
                <article key={pack.id} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{pack.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{pack.creator ?? "Mixed creators"} · {pack.pack_type} · {pack.asset_count} images</p>
                    </div>
                    <span className={`text-[11px] ${PACK_STATUS_STYLE[pack.status]}`}>{pack.status}</span>
                  </div>
                  <select value={pack.status} onChange={event => void updatePackStatus(pack.id, event.target.value as PackStatus)}
                    disabled={working}
                    className="mt-3 w-full rounded-md border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-violet-500 disabled:opacity-50">
                    <option value="draft">Draft</option>
                    <option value="ready">Ready for export</option>
                    <option value="exported">Exported to Drive</option>
                    <option value="used">Used</option>
                    <option value="archived">Archived</option>
                  </select>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
