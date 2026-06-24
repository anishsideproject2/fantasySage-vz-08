"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Search, Sparkles, TrendingUp } from "lucide-react"
import { BubbleSymbol } from "./bubble-symbol"

const POSITIONS = ["All", "Flex", "QB", "RB", "WR", "TE"]
const FLEX_POSITIONS = ["RB", "WR", "TE"]

const getAnalystRank = (player) => Number.parseFloat(player.expertRank ?? player.rank ?? player.ecr ?? player.adp)

function ValueRow({ player, idx, isBestValue, colors, getValueDiffColor }) {
  const valueColor = getValueDiffColor(player.valueDiff)

  return (
    <div
      className="rounded-xl best-value-row border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: isBestValue
          ? `linear-gradient(135deg, ${colors.gold}20, ${colors.tableRow})`
          : idx % 2 !== 0
            ? colors.tableRow
            : `${colors.darkBlue}66`,
        borderColor: isBestValue ? `${colors.gold}88` : colors.lightBorder,
        boxShadow: isBestValue ? `inset 4px 0 0 ${colors.gold}` : `inset 4px 0 0 ${valueColor}66`,
        color: colors.textPrimary,
      }}
    >
      <div className="grid grid-cols-12 items-center gap-2 px-2.5 py-2 text-sm">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            const slug = `${player.firstName}-${player.lastName}`.toLowerCase().replace(/[^a-z-]/g, "")
            window.open(`https://www.playerprofiler.com/nfl/${slug}`, "_blank", "noopener,noreferrer")
          }}
          className="col-span-5 min-w-0 truncate player-name-cell text-left font-black hover:underline"
          title={player.name}
        >
          {player.name}
        </button>
        <div className="col-span-2 flex justify-center">
          <BubbleSymbol pos={player.position} colors={colors} />
        </div>
        <div className="col-span-3 text-right">
          <span className="rounded-full px-2 py-0.5 text-xs font-black" style={{ background: `${valueColor}18`, color: valueColor }}>
            {player.valueDiff === "--" ? "--" : `${Number.parseFloat(player.valueDiff) >= 0 ? "+" : ""}${player.valueDiff}`}
          </span>
        </div>
        <div className="col-span-2 text-right font-bold" style={{ color: colors.gold }}>
          {player.analystRank}
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
  draftedPlayers = [],
  selectedTeamRosterId,
  searchTerm = "",
  setSearchTerm,
}) {

  const getBestValuePicks = () => {
    let available = getAvailablePlayers()
    if (bestValuePosition !== "All") {
      if (bestValuePosition === "Flex") {
        available = available.filter((p) => FLEX_POSITIONS.includes(p.position))
      } else {
        available = available.filter((p) => p.position === bestValuePosition)
      }
    }

    const normalizedSearch = String(searchTerm || "").trim().toLowerCase()
    const filteredAvailable = normalizedSearch
      ? available.filter((p) => `${p.name} ${p.team} ${p.position}`.toLowerCase().includes(normalizedSearch))
      : available

    return filteredAvailable
      .map((player) => {
        const analystRank = getAnalystRank(player)
        if (!Number.isNaN(analystRank) && currentPick) {
          // Best Value is intentionally simple: current draft pick minus the analyst rank.
          // Positive value means the analyst had this player ranked earlier than the current pick.
          const valueDiff = Number.parseFloat(currentPick) - analystRank
          return {
            ...player,
            analystRank: analystRank.toFixed(1),
            valueDiff: valueDiff.toFixed(1),
          }
        }
        return {
          ...player,
          analystRank: "--",
          valueDiff: "--",
        }
      })
      .sort((a, b) => {
        if (a.valueDiff === "--") return 1
        if (b.valueDiff === "--") return -1
        return Number.parseFloat(b.valueDiff) - Number.parseFloat(a.valueDiff)
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
    <Card className="flex h-full min-h-0 flex-col overflow-hidden" style={{ background: `linear-gradient(180deg, ${colors.card}, ${colors.darkBlue}44)`, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="border-b px-3 py-3" style={{ borderColor: colors.lightBorder, background: `linear-gradient(135deg, ${colors.tableRow}, ${colors.card})` }}>
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
            <CardTitle className="flex items-center gap-2 text-base font-black tracking-wide" style={{ color: colors.gold }}>
              <Sparkles size={16} />
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
              className="rounded-xl border px-3 py-1.5 text-center shadow-sm"
              style={{
                background: colors.darkBlue,
                borderColor: colors.lightBorder,
              }}
            >
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.textSecondary }}>
                Current pick
              </div>
              <div className="text-sm font-black" style={{ color: colors.textPrimary }}>
                {round}.{String(pickInRound).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: colors.textSecondary }} />
            <Input
              placeholder="Search Available Players"
              value={searchTerm}
              onChange={(e) => setSearchTerm?.(e.target.value)}
              className="h-8 pl-10 text-sm"
              style={{ background: colors.background, color: colors.textPrimary, borderColor: colors.cardBorder }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-2 py-2">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border" style={{ borderColor: colors.lightBorder, background: `${colors.background}55` }}>
          <div className="flex items-center justify-between border-b px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
            <span className="flex items-center gap-1.5"><TrendingUp size={13} /> Sorted by current-pick value</span>
            <span>Top 60 available</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          <div className="space-y-1">
            {/* Header */}
            <div
              className="grid grid-cols-12 gap-2 px-2 py-1 text-xs font-bold border-b-2"
              style={{
                color: colors.gold,
                borderColor: colors.lightBorder,
              }}
            >
              <div className="col-span-5">Player</div>
              <div className="col-span-2">Pos</div>
              <div className="col-span-3 text-right">Value</div>
              <div className="col-span-2 text-right">Rank</div>
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
