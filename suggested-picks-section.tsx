"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BubbleSymbol } from "./bubble-symbol"
import { OC_VARIANCE_SYMBOL, getOcTendencyImpact, getOcTendencySummary, getPlayerNote } from "./draft-strategy"

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
  if (player.position === "RB" && Number.parseFloat(player.adp) <= 60) {
    return { bonus: 5, label: "RB window", detail: "RB market is pricey; try to land a starter in rounds 1-5 before the room locks you out." }
  }
  if (player.position === "WR" && Number.parseFloat(player.adp) >= 24 && Number.parseFloat(player.adp) <= 60) {
    return { bonus: 2, label: "WR pocket", detail: "Strong WR range after hero-RB starts; prioritize if roster fit is open." }
  }
  return { bonus: 0, label: "Clean fit", detail: "No special 2026 draft signal beyond value and roster fit." }
}

// 2026 research themes folded into the suggestion model: stay BPA/balanced early,
// prioritize scarce RB/WR starters over low-impact QB reaches in 1QB, use the
// middle rounds for WR depth and selective QB/TE values, and chase RB/WR upside
// on the bench rather than redundant one-starter positions.
const getDraftTypeLabel = (draftType) => {
  const normalizedType = String(draftType || "snake").toLowerCase()
  if (normalizedType.includes("auction")) return "Auction"
  if (normalizedType.includes("linear")) return "Linear"
  if (normalizedType.includes("keeper")) return "Keeper"
  return "Snake"
}

const getThematicStrategySignal = ({ player, round, rosterNeed, rosterCounts, starterTargets, flexSlots, superFlexSlots, scoringFormat, draftType }) => {
  const position = player.position
  const adp = Number.parseFloat(player.adp)
  const hasStarter = (rosterCounts[position] || 0) >= (starterTargets[position] || 0)
  const isSuperFlex = superFlexSlots > 0
  const isAuction = getDraftTypeLabel(draftType) === "Auction"
  const flexEligibleCount = FLEX_POSITIONS.reduce((sum, pos) => sum + (rosterCounts[pos] || 0), 0)
  const flexEligibleTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
  const needsCoreSkillStarter = flexEligibleCount < flexEligibleTarget
  const isEarly = round <= 3
  const isMiddle = round >= 4 && round <= 8

  if (isAuction) {
    if (position === "QB" && !isSuperFlex) return { bonus: -4, label: "Auction QB discipline", detail: "In 1QB auction rooms, save budget leverage for RB/WR/elite-TE difference-makers." }
    if (position === "QB" && isSuperFlex) return { bonus: 6, label: "Auction QB scarcity", detail: "Superflex auction settings make starting QB scarcity worth paying for." }
    if ((position === "RB" || position === "WR") && needsCoreSkillStarter) return { bonus: 4, label: "Auction core", detail: `Use Sleeper roster settings to build ${position} starters before chasing bench depth.` }
    if (position === "TE" && !hasStarter && adp <= 90) return { bonus: 2, label: "Auction TE tier", detail: "Pay for TE only when the tier/price gap is meaningful." }
    return { bonus: BENCH_TARGET_POSITIONS.includes(position) ? 2 : -1, label: "Auction depth", detail: "Auction depth should emphasize flexible RB/WR upside over redundant starters." }
  }

  if (position === "QB") {
    if (isSuperFlex) return { bonus: 7, label: "Superflex QB", detail: "Superflex scarcity makes starting QB value a priority." }
    if (isEarly) return { bonus: -7, label: "Wait on QB", detail: "1QB depth favors building RB/WR/elite-TE value before chasing quarterback." }
    if (!hasStarter && isMiddle && adp <= 100) return { bonus: 3, label: "QB value", detail: "Middle-round QB value fits the 2026 late-QB build once core starters are forming." }
    return { bonus: -2, label: "QB patience", detail: "Avoid forcing QB unless the value clearly beats RB/WR options." }
  }

  if (position === "TE") {
    if (hasStarter) return { bonus: -6, label: "No bench TE", detail: "Avoid redundant TE unless settings demand it." }
    if (adp <= 30) return { bonus: 3, label: "Elite TE edge", detail: "Elite TE is viable when the board gives you a real tier advantage." }
    if (isMiddle && adp <= 90) return { bonus: 3, label: "TE tier value", detail: "Middle-round TE value is better than forcing the position early." }
    return { bonus: -1, label: "TE discipline", detail: "Do not reach at TE without a tier or ADP discount." }
  }

  if (position === "RB") {
    if (isEarly && rosterNeed.bonus >= 8) return { bonus: 4, label: "Anchor RB", detail: "Secure an RB anchor when value and roster fit line up." }
    if (isMiddle && needsCoreSkillStarter) return { bonus: 3, label: "RB window", detail: "Committee risk makes useful RB volume worth grabbing before the cliff." }
    return { bonus: round >= 9 ? 4 : 1, label: "RB upside", detail: "Prioritize contingent RB upside once starters are mostly filled." }
  }

  if (position === "WR") {
    const pprBoost = scoringFormat === "Full PPR" ? 1 : 0
    if (isEarly && rosterNeed.bonus >= 8) return { bonus: 4 + pprBoost, label: "WR core", detail: "Build around high-volume WRs when early-round value is intact." }
    if (isMiddle) return { bonus: 3 + pprBoost, label: "WR depth", detail: "WR remains a strong middle-round depth pocket, especially in PPR." }
    return { bonus: round >= 9 ? 3 + pprBoost : 1 + pprBoost, label: "WR upside", detail: "Favor WR spike-week upside over low-ceiling bench fillers." }
  }

  return { bonus: 0, label: "BPA", detail: "Let value, roster fit, and positional leverage drive the pick." }
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
  const draftType = draftData?.draftType || settings.draft_type || "snake"
  const draftTypeLabel = getDraftTypeLabel(draftType)

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
  const draftRound = draftData?.numTeams ? Math.floor((Number(currentPick) - 1) / draftData.numTeams) + 1 : 1

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
      const ocImpact = getOcTendencyImpact(player, scoringFormat)
      const thematicSignal = getThematicStrategySignal({
        player,
        round: draftRound,
        rosterNeed,
        rosterCounts: selectedRosterCounts,
        starterTargets,
        flexSlots,
        superFlexSlots,
        scoringFormat,
        draftType,
      })
      const primaryStrategySignal = ocImpact || (strategySignal.bonus !== 0 ? strategySignal : thematicSignal)
      const strategyBonus = strategySignal.bonus + thematicSignal.bonus + (ocImpact?.bonus || 0)
      const playerNote = getPlayerNote(player, scoringFormat)
      const ocSummary = getOcTendencySummary(player)
      const fallbackOcCards = {
        pass: { label: "OC pass", value: 50, detail: "No major pass-rate OC change flagged" },
        run: { label: "OC run", value: 50, detail: "No major run-rate OC change flagged" },
      }
      const whySignal = ocImpact
        ? `${ocImpact.coordinator} ${ocImpact.bonus > 0 ? "helps" : "adds risk to"} this ${player.position} profile.`
        : playerNote || primaryStrategySignal.detail
      const whyPickNote = `${valueDiff >= 0 ? "Pick for value" : "Only pick if you need the position"}: ${valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(1)} vs ADP with ${rosterNeed.reason}. ${whySignal}`
      const valueScore = clamp(50 + valueDiff * 4, 0, 100)
      const expertScore = clamp(50 + expertEdge * 3, 0, 100)
      const needScore = clamp(50 + rosterNeed.bonus * 4, 0, 100)
      const formatScore = clamp(50 + formatBonus * 5, 0, 100)
      const scarcityScore = clamp(50 + scarcityBonus * 10, 0, 100)
      const strategyScore = clamp(50 + strategyBonus * 8, 0, 100)
      const confidenceScore = Math.round(
        clamp(valueScore * 0.33 + expertScore * 0.18 + needScore * 0.26 + formatScore * 0.06 + scarcityScore * 0.06 + strategyScore * 0.11, 0, 100),
      )
      const hybridScore = 0.36 * valueDiff + 0.23 * expertEdge + 0.21 * rosterNeed.bonus + 0.05 * formatBonus + 0.04 * scarcityBonus + 0.11 * strategyBonus

      return {
        ...player,
        valueDiff,
        expertEdge,
        formatBonus,
        scarcityBonus,
        strategyBonus,
        strategySignal,
        thematicSignal,
        ocImpact,
        playerNote: whyPickNote,
        ocSummary,
        scoreCards: [
          { label: "Value", value: Math.round(valueScore), detail: `${valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(1)} vs ADP` },
          ocSummary?.pass || fallbackOcCards.pass,
          ocSummary?.run || fallbackOcCards.run,
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
            Top 5 • {scoringFormat} • {draftTypeLabel}
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
                    {player.name}{player.ocImpact && <span title={player.ocImpact.detail}> {OC_VARIANCE_SYMBOL}</span>}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: colors.textSecondary }}>ADP {player.adp}</span>
                </div>
                <div className="shrink-0 rounded-full border px-2.5 py-1 text-center" style={{ borderColor: player.confidenceColor, background: `${player.confidenceColor}22` }}>
                  <div className="text-xs font-black leading-none" style={{ color: player.confidenceColor }}>{player.confidenceScore}</div>
                  <div className="mt-0.5 text-[9px] font-bold uppercase leading-none" style={{ color: colors.textSecondary }}>{player.confidence}</div>
                </div>
              </div>
              {player.playerNote && (
                <div className="mt-2 rounded border px-2 py-1.5 text-[10px] leading-snug" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                  {player.playerNote}
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                {player.scoreCards.map((card) => (
                  <div key={card.label} className="rounded border px-2 py-1" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold" style={{ color: colors.textPrimary }}>{card.label}</span>
                      <span className="font-bold" style={{ color: getSignalColor(card.value) }}>{card.value}</span>
                    </div>
                    <div className="mt-0.5 leading-snug" title={card.detail}>{card.detail}</div>
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
