"use client"
import { useDraggable } from "@dnd-kit/core"
import { GripVertical, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BubbleSymbol } from "./bubble-symbol"

const POSITIONS = ["All", "Flex", "QB", "RB", "WR", "TE"]
const FLEX_POSITIONS = ["RB", "WR", "TE"]

function DraggableValueRow({ player, idx, isBestValue, colors, getValueDiffColor, isQueued }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bv-${player.id}`,
    data: { player },
  })

  const handleNameClick = (e) => {
    e.stopPropagation()
    const slug = `${player.firstName}-${player.lastName}`.toLowerCase().replace(/[^a-z-]/g, "")
    const url = `https://www.playerprofiler.com/nfl/${slug}`
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="grid grid-cols-12 items-center gap-2 px-2 py-1.5 rounded-lg text-sm best-value-row transition-colors duration-150 touch-none cursor-grab active:cursor-grabbing select-none"
      style={{
        background: isBestValue ? colors.highlight : idx % 2 !== 0 ? colors.tableRow : "transparent",
        color: colors.textPrimary,
        opacity: isDragging ? 0.4 : 1,
      }}
      aria-label={`Drag ${player.name} to queue`}
    >
      <div className="col-span-1 flex items-center justify-center" style={{ color: colors.textSecondary }}>
        {isQueued ? (
          <Check size={16} style={{ color: colors.headingGreen }} aria-label="In queue" />
        ) : (
          <GripVertical size={16} className="opacity-50" />
        )}
      </div>
      <button
        type="button"
        onClick={handleNameClick}
        onPointerDown={(e) => e.stopPropagation()}
        className="col-span-4 truncate player-name-cell text-left hover:underline"
      >
        {player.name}
      </button>
      <div className="col-span-2">
        <BubbleSymbol pos={player.position} colors={colors} />
      </div>
      <div className="col-span-3 text-right font-bold" style={{ color: getValueDiffColor(player.valueDiff) }}>
        {player.valueDiff !== "--" && Number.parseFloat(player.valueDiff) > 0 ? "+" : ""}
        {player.valueDiff}
      </div>
      <div className="col-span-2 text-right font-bold" style={{ color: colors.gold }}>
        {player.adp}
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

    return available
      .map((player) => {
        if (player.adp !== undefined && !isNaN(player.adp) && currentPick) {
          // Calculation: currentPick - ADP
          // Positive value = player available later than their ADP (good value)
          // Negative value = player should have been drafted earlier (bad value/missed opportunity)
          const valueDiff = Number.parseFloat(currentPick) - Number.parseFloat(player.adp)
          return {
            ...player,
            valueDiff: valueDiff.toFixed(1),
          }
        }
        return {
          ...player,
          valueDiff: "--",
        }
      })
      .sort((a, b) => {
        if (a.valueDiff === "--") return 1
        if (b.valueDiff === "--") return -1
        // Sort by highest positive value first (best value picks)
        return Number.parseFloat(b.valueDiff) - Number.parseFloat(a.valueDiff)
      })
  }

  const getValueDiffColor = (diff) => {
    if (diff === "--") return colors.textSecondary
    const numValue = Number.parseFloat(diff)
    return numValue >= 0 ? "#22c55e" : "#ef4444" // green for positive, red for negative
  }

  const queuedIds = new Set(Object.values(queues).flat().map((p) => p.id))

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
        <div className="overflow-y-auto max-h-80">
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
            {getBestValuePicks()
              .slice(0, 20)
              .map((player, idx) => (
                <DraggableValueRow
                  key={player.id}
                  player={player}
                  idx={idx}
                  isBestValue={idx === 0}
                  colors={colors}
                  getValueDiffColor={getValueDiffColor}
                  isQueued={queuedIds.has(player.id)}
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
