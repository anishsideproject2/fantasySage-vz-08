"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BubbleSymbol } from "./bubble-symbol"
import { OC_VARIANCE_SYMBOL, getDraftStrategySignal, getTeamOcVariance } from "./draft-strategy"

const FLEX_POSITIONS = ["RB", "WR", "TE"]
const BENCH_TARGET_POSITIONS = ["RB", "WR"]

const PLAYER_STRATEGY_SIGNALS = {
  "jaylen waddle": { bonus: 5, label: "Change discount", detail: "Monitor trade/team-change discount if market price lags role upgrade." },
  "devonta smith": { bonus: 4, label: "Breakout bet", detail: "User thesis: target around the 3-4 turn if value holds." },
  "colston loveland": { bonus: 6, label: "TE breaker", detail: "One of the last TE upside bets before the tier falls off." },
  "tyler warren": { bonus: 6, label: "TE breaker", detail: "One of the last TE upside bets before the tier falls off." },
}

const getPlayerStrategySignal = (player) => {
  const nameKey = String(player.name || "").toLowerCase()
  const directSignal = PLAYER_STRATEGY_SIGNALS[nameKey]
  if (directSignal) return directSignal
  if (player.position === "RB" && Number.parseFloat(player.adp) <= 36) {
    return { bonus: 3, label: "RB scarce", detail: "RB market is pricey; bank a starter before the room locks you out." }
  }
  if (player.position === "WR" && Number.parseFloat(player.adp) >= 24 && Number.parseFloat(player.adp) <= 60) {
    return { bonus: 2, label: "WR pocket", detail: "Strong WR range after hero-RB starts; prioritize if roster fit is open." }
  }
  return { bonus: 0, label: "Clean fit", detail: "No special 2026 draft signal beyond value and roster fit." }
}
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
    const flexOpen = position === "RB" || position === "WR" ? Math.max(flexEligibleTarget - flexEligibleCount, 0) : 0
    const superFlexOpen = position === "QB" ? Math.max(starterTargets.QB + superFlexSlots - count, 0) : 0
    const benchOpen = selectedRosterCounts.total >= starterCount && selectedRosterCounts.total < rosterSize
    const rosterFull = selectedRosterCounts.total >= rosterSize

    if (directOpen > 0) return { bonus: position === "RB" || position === "WR" ? 10 : 8, reason: `${directOpen} ${position} starter slot${directOpen === 1 ? "" : "s"} open`, eligible: true }
    if (superFlexOpen > 0) return { bonus: 7, reason: `${superFlexOpen} superflex QB slot${superFlexOpen === 1 ? "" : "s"} open`, eligible: true }
    if (position === "QB" || position === "TE") {
      return { bonus: -100, reason: `skip double ${position}; starter slot is covered`, eligible: false }
    }
    if (flexOpen > 0) return { bonus: 6, reason: `${flexOpen} flex slot${flexOpen === 1 ? "" : "s"} open`, eligible: true }
    if (benchOpen && BENCH_TARGET_POSITIONS.includes(position)) return { bonus: 3, reason: `bench upside should be RB/WR only`, eligible: true }
    if (rosterFull) return { bonus: -10, reason: "roster is full", eligible: false }
    return { bonus: 1, reason: `usable ${position} depth`, eligible: BENCH_TARGET_POSITIONS.includes(position) }
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
      if (!rosterNeed.eligible) return null
      const scarcityBonus = getScarcityBonus(player, availablePlayers)
      const strategySignal = getPlayerStrategySignal(player)
      const strategyBonus = strategySignal.bonus
      const valueScore = clamp(50 + valueDiff * 4, 0, 100)
      const expertScore = clamp(50 + expertEdge * 3, 0, 100)
      const needScore = clamp(50 + rosterNeed.bonus * 4, 0, 100)
      const formatScore = clamp(50 + formatBonus * 5, 0, 100)
      const scarcityScore = clamp(50 + scarcityBonus * 10, 0, 100)
      const strategyScore = clamp(50 + strategyBonus * 8, 0, 100)
      const confidenceScore = Math.round(
        clamp(valueScore * 0.34 + expertScore * 0.19 + needScore * 0.27 + formatScore * 0.06 + scarcityScore * 0.06 + strategyScore * 0.08, 0, 100),
      )
      const hybridScore = 0.38 * valueDiff + 0.25 * expertEdge + 0.22 * rosterNeed.bonus + 0.05 * formatBonus + 0.04 * scarcityBonus + 0.06 * strategyBonus

      return {
        ...player,
        valueDiff,
        expertEdge,
        formatBonus,
        scarcityBonus,
        strategyBonus,
        strategySignal,
        scoreCards: [
          { label: "Value", value: Math.round(valueScore), detail: `${valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(1)} vs ADP` },
          { label: "Fit", value: Math.round(needScore), detail: rosterNeed.reason },
          { label: "Market", value: Math.round(expertScore), detail: `${expertEdge >= 0 ? "+" : ""}${expertEdge.toFixed(1)} expert edge` },
          { label: strategySignal.label, value: Math.round(strategyScore), detail: strategySignal.detail },
        ],
        rosterReason: rosterNeed.reason,
        confidenceScore,
        confidence: getConfidenceLabel(confidenceScore),
        confidenceColor: getSignalColor(confidenceScore),
        hybridScore,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.hybridScore - a.hybridScore || b.confidenceScore - a.confidenceScore)
    .slice(0, 5)

  return (
    <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base font-bold tracking-wide" style={{ color: colors.gold }}>
          <span>SUGGESTED PICKS</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Top 5 • {scoringFormat}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[28rem] space-y-2 overflow-y-auto px-2 pt-0 pr-1">
        {suggestedPicks.length === 0 ? (
          <div className="rounded border px-3 py-2 text-xs" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
            Connect a draft or load players to see pick suggestions.
          </div>
        ) : (
          suggestedPicks.map((player, idx) => (
            <div key={player.id} className="rounded-lg border px-2 py-2" style={{ borderColor: colors.lightBorder, background: idx === 0 ? colors.highlight : colors.tableRow }}>
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: colors.textSecondary }}>{idx + 1}.</span>
                  <BubbleSymbol pos={player.position} colors={colors} />
                  <span className="min-w-0 truncate text-sm font-bold" style={{ color: colors.textPrimary }} title={player.name}>
                    {player.name}{player.ocVariance && <span title={`New OC: ${player.ocVariance.coordinator}. ${player.ocVariance.note}`}> {OC_VARIANCE_SYMBOL}</span>}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: colors.textSecondary }}>ADP {player.adp}</span>
                </div>
                <div className="shrink-0 rounded-full border px-2.5 py-1 text-center" style={{ borderColor: player.confidenceColor, background: `${player.confidenceColor}22` }}>
                  <div className="text-xs font-black leading-none" style={{ color: player.confidenceColor }}>{player.confidenceScore}</div>
                  <div className="mt-0.5 text-[9px] font-bold uppercase leading-none" style={{ color: colors.textSecondary }}>{player.confidence}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                {player.scoreCards.map((card) => (
                  <div key={card.label} className="rounded border px-2 py-1" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold" style={{ color: colors.textPrimary }}>{card.label}</span>
                      <span className="font-bold" style={{ color: getSignalColor(card.value) }}>{card.value}</span>
                    </div>
                    <div className="mt-0.5 truncate" title={card.detail}>{card.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
