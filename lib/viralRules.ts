import { ViralRule, ViralTier, ContentMetricSnapshot } from "@/types/content"

// ─────────────────────────────────────────────────────────────────────────────
// Viral Rules Engine — Foundation
//
// TODO (future implementation):
//   1. The sync worker checks each tracked Reel after time_window_hours.
//   2. It fetches a metric snapshot via ScrapeCreators.
//   3. It calls evaluateViralTier() with those metrics + the applicable rules.
//   4. If a tier is returned, the Reel is inserted into content_items.
//   5. A download job is queued to save the MP4 + thumbnail to storage.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a set of rules and a metric snapshot, returns the highest matching
 * viral tier (A > B > C) or null if no rule is satisfied.
 *
 * Rules are evaluated in tier order: A first, then B, then C.
 * The first matching rule wins.
 */
export function evaluateViralTier(
  snapshot: Pick<ContentMetricSnapshot, "views" | "likes">,
  rules: ViralRule[],
  accountAvgViews?: number,
): ViralTier | null {
  const ordered: ViralTier[] = ["A", "B", "C"]

  for (const tier of ordered) {
    const tierRules = rules.filter(r => r.enabled && r.tier === tier)
    for (const rule of tierRules) {
      if (matchesRule(snapshot, rule, accountAvgViews)) return tier
    }
  }

  return null
}

function matchesRule(
  snapshot: Pick<ContentMetricSnapshot, "views" | "likes">,
  rule: ViralRule,
  accountAvgViews?: number,
): boolean {
  if (snapshot.views < rule.minViews) return false
  if (snapshot.likes < rule.minLikes) return false

  if (rule.relativeMultiplier !== null && accountAvgViews !== undefined) {
    if (snapshot.views < rule.relativeMultiplier * accountAvgViews) return false
  }

  return true
}

/**
 * Default seed rules — can be inserted into the viral_rules table as a starting point.
 * Adjust thresholds to match each creator/market's baseline.
 */
export const DEFAULT_VIRAL_RULES: Omit<ViralRule, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Tier A — Mega viral (500K+ views in 24h)",
    tier: "A",
    timeWindowHours: 24,
    minViews: 500_000,
    minLikes: 10_000,
    relativeMultiplier: null,
    creatorId: null,
    marketId: null,
    instagramAccountId: null,
    enabled: true,
  },
  {
    name: "Tier B — Strong viral (100K+ views in 24h)",
    tier: "B",
    timeWindowHours: 24,
    minViews: 100_000,
    minLikes: 2_000,
    relativeMultiplier: null,
    creatorId: null,
    marketId: null,
    instagramAccountId: null,
    enabled: true,
  },
  {
    name: "Tier C — Notable (20K+ views in 48h)",
    tier: "C",
    timeWindowHours: 48,
    minViews: 20_000,
    minLikes: 500,
    relativeMultiplier: null,
    creatorId: null,
    marketId: null,
    instagramAccountId: null,
    enabled: true,
  },
]
