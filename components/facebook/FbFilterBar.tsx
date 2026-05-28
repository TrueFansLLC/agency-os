"use client"

import { FbFilters, DateRangeOption, FbAccountStatus } from "@/types/facebook"

interface Props {
  filters:  FbFilters
  onChange: (f: FbFilters) => void
  creators: { id: string; name: string }[]
  markets:  string[]
}

const DATE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: "7d",     label: "Last 7 days"  },
  { value: "30d",    label: "Last 30 days" },
  { value: "custom", label: "Custom"       },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all",      label: "All Statuses" },
  { value: "active",   label: "Active"       },
  { value: "scaling",  label: "Scaling"      },
  { value: "testing",  label: "Testing"      },
  { value: "paused",   label: "Paused"       },
  { value: "banned",   label: "Banned"       },
]

const SELECT_CLS =
  "bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500 cursor-pointer"

export default function FbFilterBar({ filters, onChange, creators, markets }: Props) {
  function set(partial: Partial<FbFilters>) {
    onChange({ ...filters, ...partial })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">

        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {DATE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set({ dateRange: opt.value })}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                filters.dateRange === opt.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filters.dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.customFrom}
              onChange={e => set({ customFrom: e.target.value })}
              className={SELECT_CLS}
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              value={filters.customTo}
              onChange={e => set({ customTo: e.target.value })}
              className={SELECT_CLS}
            />
          </div>
        )}

        <div className="h-6 w-px bg-gray-700 hidden sm:block" />

        <select
          value={filters.creator}
          onChange={e => set({ creator: e.target.value })}
          className={SELECT_CLS}
        >
          <option value="all">All Creators</option>
          {creators.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.market}
          onChange={e => set({ market: e.target.value })}
          className={SELECT_CLS}
        >
          <option value="all">All Markets</option>
          {markets.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={e => set({ status: e.target.value })}
          className={SELECT_CLS}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {(filters.creator !== "all" || filters.market !== "all" || filters.status !== "all") && (
          <button
            onClick={() => onChange({ ...filters, creator: "all", market: "all", status: "all" })}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
