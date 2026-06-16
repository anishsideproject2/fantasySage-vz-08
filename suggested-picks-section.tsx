"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BubbleSymbol } from "./bubble-symbol"

const FLEX_POSITIONS = ["RB", "WR", "TE"]
const DEFAULT_SLOT_SETTINGS = { slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1, slots_flex: 1, slots_bn: 5 }

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getConfidenceLabel = (score) => {
  if (score >= 85) return "Elite"
  if (score >= 72) return "High"
  if (score >= 58) return "Medium"
  if (score >= 44) return "Low"
  return "Fade"
}

const getSignalColor = (score) => {
  if (score >= 75) return "#22c55e"
  if (score >= 60) return "#84cc16"
  if (score >= 45) return "#facc15"
  if (score >= 30) return "#fb923c"
  return "#ef4444"
}

export function SuggestedPicksSection({ colors, draftData, currentPick, getAvailablePlayers, draftedPlayers = [], selectedTeamRosterId }) {
  const selectedRosterCounts = draftedPlayers
    .filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
    .reduce((counts, player) => {
      counts[player.position] = (counts[player.position] || 0) + 1
      counts.total += 1
      return counts
    }, { QB: 0, RB: 0, WR: 0, TE: 0, total: 0 })

  const settings = draftData?.slotSettings || DEFAULT_SLOT_SETTINGS
  const starterTargets = {
    QB: Number(settings.slots_qb ?? 1),
    RB: Number(settings.slots_rb ?? 2),
    WR: Number(settings.slots_wr ?? 2),
    TE: Number(settings.slots_te ?? 1),
  }
  const flexSlots = Number(settings.slots_flex ?? settings.slots_wrt ?? 1)
  const superFlexSlots = Number(settings.slots_super_flex ?? 0)
  const benchSlots = Number(settings.slots_bn ?? 5)
  const starterCount = Object.values(starterTargets).reduce((sum, count) => sum + count, 0) + flexSlots + superFlexSlots
  const rosterSize = starterCount + benchSlots

  const rawFormat = String(
    draftData?.scoringFormat || settings.scoring_type || settings.type || settings.reception_type || settings.ppr || "",
  ).toLowerCase()
  const scoringFormat = rawFormat.includes("half") || rawFormat === "0.5"
    ? "Half PPR"
    : rawFormat.includes("ppr") || rawFormat === "1" || Number(settings.rec) >= 1
      ? "Full PPR"
      : rawFormat.includes("standard") || rawFormat === "0" || Number(settings.rec) === 0
        ? "Standard"
        : "Format unknown"

  const getFormatBonus = (position) => {
    if (scoringFormat === "Full PPR") return position === "WR" ? 4 : position === "RB" ? 2 : position === "TE" ? 1 : 0
    if (scoringFormat === "Half PPR") return position === "WR" || position === "RB" ? 2 : position === "TE" ? 1 : 0
    if (scoringFormat === "Standard") return position === "RB" ? 4 : position === "WR" ? -2 : position === "TE" ? -1 : 0
    return 0
  }

  const getRosterNeed = (position) => {
    const count = selectedRosterCounts[position] || 0
    const directTarget = starterTargets[position] || 0
    const directOpen = Math.max(directTarget - count, 0)
    const flexEligibleCount = FLEX_POSITIONS.reduce((sum, pos) => sum + (selectedRosterCounts[pos] || 0), 0)
    const flexEligibleTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
    const flexOpen = FLEX_POSITIONS.includes(position) ? Math.max(flexEligibleTarget - flexEligibleCount, 0) : 0
    const superFlexOpen = position === "QB" ? Math.max(starterTargets.QB + superFlexSlots - count, 0) : 0
    const totalTarget = directTarget + (FLEX_POSITIONS.includes(position) ? flexSlots : 0) + (position === "QB" ? superFlexSlots : 0)
    const rosterFull = selectedRosterCounts.total >= rosterSize

    if (directOpen > 0) return { bonus: position === "RB" || position === "WR" ? 10 : 8, reason: `${directOpen} ${position} starter slot${directOpen === 1 ? "" : "s"} open` }
    if (superFlexOpen > 0) return { bonus: 7, reason: `${superFlexOpen} superflex QB slot${superFlexOpen === 1 ? "" : "s"} open` }
    if (flexOpen > 0) return { bonus: 6, reason: `${flexOpen} flex slot${flexOpen === 1 ? "" : "s"} open` }
    if (count < totalTarget + 1) return { bonus: rosterFull ? -2 : 2, reason: `usable ${position} depth` }
    return { bonus: position === "QB" || position === "TE" ? -8 : -4, reason: `already have ${count} ${position}${count === 1 ? "" : "s"}` }
  }

  const getScarcityBonus = (player, available) => {
    const samePosition = available
      .filter((candidate) => candidate.position === player.position)
      .sort((a, b) => Number.parseFloat(a.adp) - Number.parseFloat(b.adp))
    const index = samePosition.findIndex((candidate) => candidate.id === player.id)
    const nextPlayer = samePosition[index + 1]
    if (!nextPlayer) return 0
    const gap = Number.parseFloat(nextPlayer.adp) - Number.parseFloat(player.adp)
    return gap >= 12 ? 4 : gap >= 8 ? 2 : 0
  }

  const availablePlayers = getAvailablePlayers?.() || []

  const suggestedPicks = availablePlayers
    .map((player) => {
      if (player.adp === undefined || isNaN(player.adp) || !currentPick) return null
      const valueDiff = Number.parseFloat(currentPick) - Number.parseFloat(player.adp)
      const marketAdp = Number.parseFloat(player.marketAdp || player.adp)
      const expertRank = Number.parseFloat(player.expertRank || player.adp)
      const expertEdge = Number.isNaN(marketAdp) || Number.isNaN(expertRank) ? 0 : marketAdp - expertRank
      const rosterNeed = getRosterNeed(player.position)
      const formatBonus = getFormatBonus(player.position)
      const scarcityBonus = getScarcityBonus(player, availablePlayers)
      const valueScore = clamp(50 + valueDiff * 4, 0, 100)
      const expertScore = clamp(50 + expertEdge * 3, 0, 100)
      const needScore = clamp(50 + rosterNeed.bonus * 4, 0, 100)
      const formatScore = clamp(50 + formatBonus * 5, 0, 100)
      const scarcityScore = clamp(50 + scarcityBonus * 10, 0, 100)
      const confidenceScore = Math.round(
        clamp(valueScore * 0.38 + expertScore * 0.22 + needScore * 0.25 + formatScore * 0.08 + scarcityScore * 0.07, 0, 100),
      )
      const hybridScore = 0.42 * valueDiff + 0.28 * expertEdge + 0.18 * rosterNeed.bonus + 0.07 * formatBonus + 0.05 * scarcityBonus

      return {
        ...player,
        valueDiff,
        expertEdge,
        formatBonus,
        scarcityBonus,
        rosterReason: rosterNeed.reason,
        confidenceScore,
        confidence: getConfidenceLabel(confidenceScore),
        confidenceColor: getSignalColor(confidenceScore),
        hybridScore,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.hybridScore - a.hybridScore || b.confidenceScore - a.confidenceScore)
    .slice(0, 2)

  return (
    <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base font-bold tracking-wide" style={{ color: colors.gold }}>
          <span>SUGGESTED PICKS</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Top 2 • {scoringFormat}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-2 pt-0">
        {suggestedPicks.length === 0 ? (
          <div className="rounded border px-3 py-2 text-xs" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
            Connect a draft or load players to see pick suggestions.
          </div>
        ) : (
          suggestedPicks.map((player, idx) => (
            <div key={player.id} className="rounded-lg border px-2 py-2" style={{ borderColor: colors.lightBorder, background: idx === 0 ? colors.highlight : colors.tableRow }}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold" style={{ color: colors.textPrimary }}>{idx + 1}. {player.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: colors.textSecondary }}>
                    <BubbleSymbol pos={player.position} colors={colors} />
                    <span>ADP {player.adp}</span>
                    <span>Value {player.valueDiff >= 0 ? "+" : ""}{player.valueDiff.toFixed(1)}</span>
                  </div>
                </div>
                <div className="shrink-0 rounded px-2 py-1 text-center text-[11px] font-bold" style={{ background: player.confidenceColor, color: player.confidenceScore >= 45 && player.confidenceScore < 60 ? "#000" : colors.white }}>
                  {player.confidence}<br />{player.confidenceScore}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]" style={{ color: colors.textSecondary }}>
                <div>Roster: {player.rosterReason}</div>
                <div>Expert: {player.expertEdge >= 0 ? "+" : ""}{player.expertEdge.toFixed(1)}</div>
                <div>Format: {player.formatBonus >= 0 ? "+" : ""}{player.formatBonus}</div>
                <div>Scarcity: {player.scarcityBonus >= 0 ? "+" : ""}{player.scarcityBonus}</div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
