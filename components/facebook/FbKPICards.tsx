import { FbKPIs } from "@/types/facebook"
import { fmtNumber } from "@/lib/fb-metrics"

export default function FbKPICards({ kpis }: { kpis: FbKPIs }) {
  const cards = [
    {
      label: "Total Pages",
      value: kpis.totalAccounts.toString(),
      sub:   `${kpis.activeAccounts} active / scaling`,
    },
    {
      label: "Total Followers",
      value: fmtNumber(kpis.totalFollowers),
      sub:   "combined across all pages",
    },
    {
      label: "Total Videos",
      value: kpis.totalVideos.toString(),
      sub:   "across all pages",
    },
    {
      label: "Total Video Views",
      value: fmtNumber(kpis.totalVideoViews),
      sub:   "in selected period",
    },
    {
      label: "Avg Views / Video",
      value: fmtNumber(kpis.avgViewsPerVideo),
      sub:   "across filtered pages",
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
      {cards.map(card => (
        <div key={card.label} className="bg-gradient-to-br from-gray-900 to-gray-800/60 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all">
          <p className="text-gray-400 text-xs uppercase tracking-wider leading-none">{card.label}</p>
          <p className="text-3xl font-semibold mt-3 text-white tabular-nums">{card.value}</p>
          <p className="text-gray-500 text-xs mt-1.5">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
