"use client"
import { Plus, Check, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BubbleSymbol } from "./bubble-symbol"

const POSITIONS = ["All", "Flex", "QB", "RB", "WR", "TE"]
const FLEX_POSITIONS = ["RB", "WR", "TE"]

function ValueRow({ player, idx, isBestValue, colors, getValueDiffColor, isQueued, onToggleQueue }) {
  const [isExpanded, setIsExpanded] = useState(idx === 0)
  const handleNameClick = (e) => {
    e.stopPropagation()
    const slug = `${player.firstName}-${player.lastName}`.toLowerCase().replace(/[^a-z-]/g, "")
    const url = `https://www.playerprofiler.com/nfl/${slug}`
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleToggleClick = (e) => {
    e.stopPropagation()
    onToggleQueue(player, isQueued)
  }

  return (
    <div
      className="rounded-lg best-value-row transition-colors duration-150"
      style={{
        background: isBestValue ? colors.highlight : idx % 2 !== 0 ? colors.tableRow : "transparent",
        color: colors.textPrimary,
      }}
    >
      <div className="grid grid-cols-12 items-center gap-2 px-2 py-1.5 text-sm">
      <div className="col-span-1 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded((value) => !value)
          }}
          className="flex items-center justify-center w-5 h-5 rounded transition-colors"
          style={{ color: colors.textSecondary }}
          aria-label={isExpanded ? `Hide ${player.name} recommendation details` : `Show ${player.name} recommendation details`}
          title="Why this player?"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          type="button"
          onClick={handleToggleClick}
          className="flex items-center justify-center w-6 h-6 rounded-md transition-colors"
          style={{
            background: isQueued ? colors.headingGreen : colors.darkBlue,
            color: isQueued ? "#000000" : colors.gold,
            border: `1px solid ${isQueued ? colors.headingGreen : colors.lightBorder}`,
          }}
          aria-label={isQueued ? `Remove ${player.name} from queue` : `Add ${player.name} to queue`}
          title={isQueued ? "Remove from queue" : "Add to queue"}
        >
          {isQueued ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </div>
      <button
        type="button"
        onClick={handleNameClick}
        className="col-span-4 truncate player-name-cell text-left hover:underline"
      >
        {player.name}
      </button>
      <div className="col-span-2">
        <BubbleSymbol pos={player.position} colors={colors} />
      </div>
      <div className="col-span-3 text-right font-bold" style={{ color: getValueDiffColor(player.valueDiff) }}>
        {player.hybridScore}
      </div>
      <div className="col-span-2 text-right font-bold" style={{ color: colors.gold }}>
        {player.adp}
      </div>
      </div>
      {isExpanded && (
        <div className="mx-2 mb-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: colors.lightBorder, background: colors.darkBlue }}>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded px-2 py-0.5 font-bold" style={{ background: colors.purple, color: colors.white }}>
              {player.confidence} confidence
            </span>
            <span style={{ color: colors.gold }}>Hybrid score: {player.hybridScore}</span>
            <span style={{ color: colors.textSecondary }}>Expert rank: {player.expertRank}</span>
            {player.hybridSource && <span style={{ color: colors.textSecondary }}>Source: {player.hybridSource}</span>}
          </div>
          <ul className="list-disc pl-4 space-y-0.5" style={{ color: colors.textSecondary }}>
            {player.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
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
      return counts
    }, {})

  const getRosterNeedBonus = (position) => {
    const count = selectedRosterCounts[position] || 0
    const starterTargets = { QB: 1, RB: 2, WR: 2, TE: 1 }
    if (!starterTargets[position]) return 0
    if (count === 0) return position === "RB" || position === "WR" ? 6 : 4
    if (count < starterTargets[position]) return 3
    if (position === "QB" && count >= 2) return -6
    return 0
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

  const getConfidence = (expertEdge, rosterNeedBonus, scarcityBonus) => {
    const confidenceScore = expertEdge + rosterNeedBonus + scarcityBonus
    if (confidenceScore >= 10) return "High"
    if (confidenceScore >= 4) return "Medium"
    return "Low"
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
          const rosterNeedBonus = getRosterNeedBonus(player.position)
          const scarcityBonus = getScarcityBonus(player, filteredAvailable)
          const hybridScore = 0.45 * valueDiff + 0.3 * expertEdge + 0.15 * rosterNeedBonus + 0.1 * scarcityBonus
          const reasons = [
            `Available ${Math.abs(valueDiff).toFixed(1)} picks ${valueDiff >= 0 ? "after" : "before"} market ADP`,
            expertEdge > 0
              ? `Expert board is ${expertEdge.toFixed(1)} picks ahead of market`
              : `Expert board is aligned with market price`,
            rosterNeedBonus > 0
              ? `Fits roster need: ${selectedRosterCounts[player.position] || 0} ${player.position} drafted`
              : rosterNeedBonus < 0
                ? `Suppressed for roster construction: already have ${selectedRosterCounts[player.position] || 0} ${player.position}s`
                : `Neutral roster fit right now`,
            scarcityBonus > 0 ? `Tier cliff signal: notable gap to the next ${player.position}` : `No major tier cliff detected`,
          ]
          return {
            ...player,
            valueDiff: valueDiff.toFixed(1),
            marketAdp: marketAdp.toFixed(1),
            expertRank: expertRank.toFixed(1),
            expertEdge: expertEdge.toFixed(1),
            hybridScore: hybridScore.toFixed(1),
            confidence: getConfidence(expertEdge, rosterNeedBonus, scarcityBonus),
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

  const queuedIds = new Set(Object.values(queues).flat().map((p) => p.id))

  const handleToggleQueue = (player, isQueued) => {
    if (isQueued) {
      removeFromQueue?.(player.position, player.id)
    } else {
      addToQueue?.(player.position, player)
    }
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
              <div className="col-span-3 text-right">Hybrid</div>
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
                isQueued={queuedIds.has(player.id)}
                onToggleQueue={handleToggleQueue}
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
