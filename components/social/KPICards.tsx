import { KPIs } from "@/types/instagram"
import { fmtNumber, fmtGrowth } from "@/lib/metrics"

interface CardDef {
  label: string
  value: string
  sub: string
  growthColor?: boolean
  growthPositive?: boolean
}

export default function KPICards({ kpis }: { kpis: KPIs }) {
  const cards: CardDef[] = [
    {
      label: "Total Accounts",
      value: kpis.totalAccounts.toString(),
      sub: `${kpis.activeAccounts} active / scaling`,
    },
    {
      label: "Recent Views",
      value: fmtNumber(kpis.totalViews),
      sub: "from last ~24 posts per account",
    },
    {
      label: "Follower Growth",
      value: fmtGrowth(kpis.totalFollowerGrowth),
      sub: "in selected period",
      growthColor: true,
      growthPositive: kpis.totalFollowerGrowth >= 0,
    },
    {
      label: "Total Posts",
      value: kpis.totalPosts.toString(),
      sub: "in selected period",
    },
    {
      label: "Avg Views / Post",
      value: fmtNumber(kpis.avgViewsPerPost),
      sub: "across filtered accounts",
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
      {cards.map(card => (
        <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider leading-none">{card.label}</p>
          <p
            className={`text-2xl font-semibold mt-3 ${
              card.growthColor
                ? card.growthPositive
                  ? "text-green-400"
                  : "text-red-400"
                : "text-white"
            }`}
          >
            {card.value}
          </p>
          <p className="text-gray-500 text-xs mt-1.5">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
