"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BubbleSymbol } from "./bubble-symbol"

const POSITIONS = ["All", "Flex", "QB", "RB", "WR", "TE"]
const FLEX_POSITIONS = ["RB", "WR", "TE"]

const DEFAULT_SLOT_SETTINGS = { slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1, slots_flex: 1, slots_bn: 5 }
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getSignalColor = (score) => {
  if (score >= 75) return "#22c55e"
  if (score >= 60) return "#84cc16"
  if (score >= 45) return "#facc15"
  if (score >= 30) return "#fb923c"
  return "#ef4444"
}

function ValueRow({ player, idx, isBestValue, colors, getValueDiffColor }) {
  return (
    <div
      className="rounded-lg best-value-row transition-colors duration-150"
      style={{
        background: isBestValue ? colors.highlight : idx % 2 !== 0 ? colors.tableRow : "transparent",
        color: colors.textPrimary,
      }}
    >
      <div className="grid grid-cols-12 items-center gap-2 px-2 py-1.5 text-sm">
        <div className="col-span-5 min-w-0 truncate player-name-cell" title={player.name}>
          {player.name}
        </div>
        <div className="col-span-2 flex justify-center">
          <BubbleSymbol pos={player.position} colors={colors} />
        </div>
        <div className="col-span-3 text-right font-bold" style={{ color: getValueDiffColor(player.valueDiff) }}>
          {player.valueDiff === "--" ? "--" : `${Number.parseFloat(player.valueDiff) >= 0 ? "+" : ""}${player.valueDiff}`}
        </div>
        <div className="col-span-2 text-right font-bold" style={{ color: colors.gold }}>
          {player.adp}
        </div>
      </div>
    </div>
  )
}


export function BestValueSection({
  colors,
  csvData,
  draftData,
  currentPick,
  bestValuePosition,
  setBestValuePosition,
  lastUpdate,
  timeSinceUpdate,
  getAvailablePlayers,
  queues = {},
  addToQueue,
  removeFromQueue,
  draftedPlayers = [],
  selectedTeamRosterId,
}) {

  const selectedRosterCounts = draftedPlayers
    .filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
    .reduce((counts, player) => {
      counts[player.position] = (counts[player.position] || 0) + 1
      counts.total += 1
      return counts
    }, { QB: 0, RB: 0, WR: 0, TE: 0, total: 0 })

  const getRosterPlan = () => {
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

    return { starterTargets, flexSlots, superFlexSlots, benchSlots, rosterSize: starterCount + benchSlots }
  }

  const rosterPlan = getRosterPlan()

  const getScoringFormat = () => {
    const settings = draftData?.slotSettings || {}
    const rawFormat = String(
      draftData?.scoringFormat || settings.scoring_type || settings.type || settings.reception_type || settings.ppr || "",
    ).toLowerCase()

    if (rawFormat.includes("half") || rawFormat === "0.5") return "Half PPR"
    if (rawFormat.includes("ppr") || rawFormat === "1" || Number(settings.rec) >= 1) return "Full PPR"
    if (rawFormat.includes("standard") || rawFormat === "0" || Number(settings.rec) === 0) return "Standard"
    return "Unknown"
  }

  const scoringFormat = getScoringFormat()

  const getFormatBonus = (position) => {
    if (scoringFormat === "Full PPR") {
      if (position === "WR") return 4
      if (position === "RB") return 2
      if (position === "TE") return 1
    }
    if (scoringFormat === "Half PPR") {
      if (position === "WR" || position === "RB") return 2
      if (position === "TE") return 1
    }
    if (scoringFormat === "Standard") {
      if (position === "RB") return 4
      if (position === "WR") return -2
      if (position === "TE") return -1
    }
    return 0
  }

  const getRosterNeedProfile = (position) => {
    const count = selectedRosterCounts[position] || 0
    const directTarget = rosterPlan.starterTargets[position] || 0
    const directOpen = Math.max(directTarget - count, 0)
    const flexEligibleCount = FLEX_POSITIONS.reduce((sum, pos) => sum + (selectedRosterCounts[pos] || 0), 0)
    const flexEligibleTarget = rosterPlan.starterTargets.RB + rosterPlan.starterTargets.WR + rosterPlan.starterTargets.TE + rosterPlan.flexSlots
    const flexOpen = FLEX_POSITIONS.includes(position) ? Math.max(flexEligibleTarget - flexEligibleCount, 0) : 0
    const superFlexOpen = position === "QB" ? Math.max(rosterPlan.starterTargets.QB + rosterPlan.superFlexSlots - count, 0) : 0
    const totalAtPositionTarget = directTarget + (FLEX_POSITIONS.includes(position) ? rosterPlan.flexSlots : 0) + (position === "QB" ? rosterPlan.superFlexSlots : 0)
    const rosterFull = selectedRosterCounts.total >= rosterPlan.rosterSize

    let bonus = 0
    let detail = "Depth pick"

    if (directOpen > 0) {
      bonus = position === "RB" || position === "WR" ? 10 : 8
      detail = `${directOpen} starting ${position} slot${directOpen === 1 ? "" : "s"} open`
    } else if (superFlexOpen > 0) {
      bonus = 7
      detail = `${superFlexOpen} superflex QB slot${superFlexOpen === 1 ? "" : "s"} open`
    } else if (flexOpen > 0) {
      bonus = 6
      detail = `${flexOpen} flex slot${flexOpen === 1 ? "" : "s"} still open`
    } else if (count < totalAtPositionTarget + 1) {
      bonus = 2
      detail = `Adds usable ${position} depth`
    } else {
      bonus = position === "QB" || position === "TE" ? -8 : -4
      detail = `Roster already has ${count} ${position}${count === 1 ? "" : "s"}`
    }

    if (rosterFull) {
      bonus -= 4
      detail = `Roster is full; ${detail.toLowerCase()}`
    }

    return { bonus, detail }
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

  const getConfidenceProfile = (valueDiff, expertEdge, rosterNeedBonus, formatBonus, scarcityBonus) => {
    const valueScore = clamp(50 + valueDiff * 4, 0, 100)
    const expertScore = clamp(50 + expertEdge * 3, 0, 100)
    const needScore = clamp(50 + rosterNeedBonus * 4, 0, 100)
    const formatScore = clamp(50 + formatBonus * 5, 0, 100)
    const scarcityScore = clamp(50 + scarcityBonus * 10, 0, 100)
    const confidenceScore = Math.round(
      clamp(valueScore * 0.38 + expertScore * 0.22 + needScore * 0.25 + formatScore * 0.08 + scarcityScore * 0.07, 0, 100),
    )
    const confidence =
      confidenceScore >= 85
        ? "Elite"
        : confidenceScore >= 72
          ? "High"
          : confidenceScore >= 58
            ? "Medium"
            : confidenceScore >= 44
              ? "Low"
              : "Fade"
    const confidenceColor = getSignalColor(confidenceScore)
    const confidenceTextColor = confidenceScore >= 45 && confidenceScore < 60 ? "#000000" : colors.white

    return {
      confidence,
      confidenceScore,
      confidenceColor,
      confidenceTextColor,
      confidenceBreakdown: [
        {
          label: "Value",
          score: Math.round(valueScore),
          color: getSignalColor(valueScore),
          detail: `${valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(1)} vs ADP`,
        },
        {
          label: "Expert",
          score: Math.round(expertScore),
          color: getSignalColor(expertScore),
          detail: `${expertEdge >= 0 ? "+" : ""}${expertEdge.toFixed(1)} rank edge`,
        },
        {
          label: "Need",
          score: Math.round(needScore),
          color: getSignalColor(needScore),
          detail: `${rosterNeedBonus >= 0 ? "+" : ""}${rosterNeedBonus} roster fit`,
        },
        {
          label: "Format",
          score: Math.round(formatScore),
          color: getSignalColor(formatScore),
          detail: `${scoringFormat}: ${formatBonus >= 0 ? "+" : ""}${formatBonus}`,
        },
        {
          label: "Scarcity",
          score: Math.round(scarcityScore),
          color: getSignalColor(scarcityScore),
          detail: `${scarcityBonus >= 0 ? "+" : ""}${scarcityBonus} tier cliff`,
        },
      ],
    }
  }

  const getBestValuePicks = () => {
    let available = getAvailablePlayers()
    if (bestValuePosition !== "All") {
      if (bestValuePosition === "Flex") {
        available = available.filter((p) => FLEX_POSITIONS.includes(p.position))
      } else {
        available = available.filter((p) => p.position === bestValuePosition)
      }
    }

    const filteredAvailable = available

    return filteredAvailable
      .map((player) => {
        if (player.adp !== undefined && !isNaN(player.adp) && currentPick) {
          // Calculation: currentPick - ADP
          // Positive value = player available later than their ADP (good value)
          // Negative value = player should have been drafted earlier (bad value/missed opportunity)
          const valueDiff = Number.parseFloat(currentPick) - Number.parseFloat(player.adp)
          const marketAdp = Number.parseFloat(player.marketAdp || player.adp)
          const expertRank = Number.parseFloat(player.expertRank || player.adp)
          const expertEdge = Number.isNaN(marketAdp) || Number.isNaN(expertRank) ? 0 : marketAdp - expertRank
          const rosterNeedProfile = getRosterNeedProfile(player.position)
          const rosterNeedBonus = rosterNeedProfile.bonus
          const formatBonus = getFormatBonus(player.position)
          const scarcityBonus = getScarcityBonus(player, filteredAvailable)
          const hybridScore = 0.42 * valueDiff + 0.28 * expertEdge + 0.18 * rosterNeedBonus + 0.07 * formatBonus + 0.05 * scarcityBonus
          const confidenceProfile = getConfidenceProfile(valueDiff, expertEdge, rosterNeedBonus, formatBonus, scarcityBonus)
          const reasons = [
            `Available ${Math.abs(valueDiff).toFixed(1)} picks ${valueDiff >= 0 ? "after" : "before"} market ADP`,
            expertEdge > 0
              ? `Expert board is ${expertEdge.toFixed(1)} picks ahead of market`
              : `Expert board is aligned with market price`,
            rosterNeedBonus > 0
              ? `Roster fit: ${rosterNeedProfile.detail}`
              : rosterNeedBonus < 0
                ? `Roster warning: ${rosterNeedProfile.detail}`
                : `Neutral roster fit right now`,
            formatBonus !== 0
              ? `${scoringFormat} format adjusts ${player.position} by ${formatBonus > 0 ? "+" : ""}${formatBonus}`
              : `${scoringFormat} scoring has no special ${player.position} adjustment`,
            scarcityBonus > 0 ? `Tier cliff signal: notable gap to the next ${player.position}` : `No major tier cliff detected`,
          ]
          return {
            ...player,
            valueDiff: valueDiff.toFixed(1),
            marketAdp: marketAdp.toFixed(1),
            expertRank: expertRank.toFixed(1),
            expertEdge: expertEdge.toFixed(1),
            hybridScore: hybridScore.toFixed(1),
            ...confidenceProfile,
            reasons,
          }
        }
        return {
          ...player,
          valueDiff: "--",
          marketAdp: "--",
          expertRank: "--",
          expertEdge: "--",
          hybridScore: "--",
          confidence: "Low",
          confidenceScore: 0,
          confidenceColor: "#ef4444",
          confidenceTextColor: colors.white,
          confidenceBreakdown: [],
          reasons: ["Missing ADP or current pick data."],
        }
      })
      .sort((a, b) => {
        if (a.valueDiff === "--") return 1
        if (b.valueDiff === "--") return -1
        // Sort by highest hybrid score first, then raw market value.
        return Number.parseFloat(b.hybridScore) - Number.parseFloat(a.hybridScore) || Number.parseFloat(b.valueDiff) - Number.parseFloat(a.valueDiff)
      })
      .slice(0, 60) // Only load 60 players to keep rendering fast
  }

  const getValueDiffColor = (diff) => {
    if (diff === "--") return colors.textSecondary
    const numValue = Number.parseFloat(diff)
    return numValue >= 0 ? "#22c55e" : "#ef4444" // green for positive, red for negative
  }

  const round = draftData?.numTeams ? Math.floor((currentPick - 1) / draftData.numTeams) + 1 : "-"
  const pickInRound = draftData?.numTeams ? ((currentPick - 1) % draftData.numTeams) + 1 : "-"

  return (
    <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <div
                className="text-xs text-center pr-3 border-r"
                style={{
                  color: colors.textSecondary,
                  borderColor: colors.lightBorder,
                }}
              >
                <div className="font-bold">{timeSinceUpdate}s</div>
                <div>ago</div>
              </div>
            )}
            <CardTitle className="text-base font-bold tracking-wide" style={{ color: colors.gold }}>
              BEST VALUE
            </CardTitle>
            <Select value={bestValuePosition} onValueChange={setBestValuePosition}>
              <SelectTrigger
                className="w-20 h-8 text-xs font-bold"
                style={{
                  background: colors.darkBlue,
                  color: colors.gold,
                  borderColor: colors.cardBorder,
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 items-center">
            <div
              className="px-3 py-1 rounded text-center border"
              style={{
                background: colors.darkBlue,
                borderColor: colors.lightBorder,
              }}
            >
              <div className="text-xs" style={{ color: colors.textSecondary }}>
                CURRENT PICK
              </div>
              <div className="text-sm font-bold" style={{ color: colors.textPrimary }}>
                {round}.{String(pickInRound).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-2">
        <div className="overflow-y-auto max-h-[32rem]">
          <div className="space-y-1">
            {/* Header */}
            <div
              className="grid grid-cols-12 gap-2 px-2 py-1 text-xs font-bold border-b-2"
              style={{
                color: colors.gold,
                borderColor: colors.lightBorder,
              }}
            >
              <div className="col-span-1" />
              <div className="col-span-4">Player</div>
              <div className="col-span-2">Pos</div>
              <div className="col-span-3 text-right">Value</div>
              <div className="col-span-2 text-right">ADP</div>
            </div>

            {/* Player Rows */}
            {getBestValuePicks().map((player, idx) => (
              <ValueRow
                key={player.id}
                player={player}
                idx={idx}
                isBestValue={idx === 0}
                colors={colors}
                getValueDiffColor={getValueDiffColor}
              />
            ))}
          </div>
        </div>
      </CardContent>
      <style jsx>{`
        .best-value-row:hover {
          background-color: ${colors.purple}60 !important;
        }
      `}</style>
    </Card>
  )
}
