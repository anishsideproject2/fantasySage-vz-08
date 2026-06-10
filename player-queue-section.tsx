"use client"

import { useDroppable } from "@dnd-kit/core"
import { X, ListPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const POSITION_LABELS = {
  FLEX: "FLX",
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
}

const FLEX_POSITIONS = ["RB", "WR", "TE"]

const QUEUE_POSITIONS = ["QB", "RB", "WR", "TE", "FLEX"]

const TEAM_ABBREVIATIONS = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Las Vegas Raiders": "LV",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WAS",
}

const getTeamAbbr = (teamName) => TEAM_ABBREVIATIONS[teamName] || teamName

const getBubbleColorsForSlot = (pos, colors) => {
  switch (pos) {
    case "QB":
      return { bg: colors.pillQB, text: colors.pillTextQB }
    case "RB":
      return { bg: colors.pillRB, text: colors.pillTextRB }
    case "WR":
      return { bg: colors.pillWR, text: colors.pillTextWR }
    case "TE":
      return { bg: colors.pillTE, text: colors.pillTextTE }
    case "FLEX":
      return { bg: colors.pillWR, text: colors.pillTextWR }
    default:
      return { bg: "#333", text: colors.white }
  }
}

function QueueDropZone({ position, players, colors, removeFromQueue, activePlayer }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `queue-${position}`,
    data: { position },
  })

  const slotColors = getBubbleColorsForSlot(position, colors)

  const accepts = (playerPos) => {
    if (!playerPos) return false
    if (position === "FLEX") return FLEX_POSITIONS.includes(playerPos)
    return playerPos === position
  }

  // Is the currently dragged player eligible for this zone?
  const isEligibleTarget = activePlayer ? accepts(activePlayer.position) : false
  const isActiveOver = isOver && isEligibleTarget
  const isRejecting = isOver && activePlayer && !isEligibleTarget

  let borderColor = colors.cardBorder
  let background = colors.tableRow
  if (isActiveOver) {
    borderColor = colors.headingGreen
    background = `${colors.headingGreen}26`
  } else if (isRejecting) {
    borderColor = colors.adpNegative
    background = `${colors.adpNegative}1a`
  } else if (isEligibleTarget) {
    // Highlight all valid drop targets while dragging
    borderColor = `${colors.headingGreen}99`
    background = `${colors.headingGreen}0d`
  }

  return (
    <div
      ref={setNodeRef}
      className="rounded-xl border-2 border-dashed p-2.5 transition-all duration-150"
      style={{
        borderColor,
        background,
        minHeight: "76px",
        boxShadow: isActiveOver ? `0 0 0 3px ${colors.headingGreen}33` : "none",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
          style={{ background: slotColors.bg, color: slotColors.text }}
        >
          {POSITION_LABELS[position] || position}
        </div>
        <span className="text-xs font-bold tracking-wide" style={{ color: colors.textSecondary }}>
          {players.length > 0 ? `${players.length} QUEUED` : "Drop here"}
        </span>
      </div>
      <div className="space-y-1.5">
        {players.map((player, idx) => (
          <div
            key={player.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: colors.darkBlue, color: colors.gold }}
            >
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold" style={{ color: colors.textPrimary }}>
                {player.name}
              </div>
              <div className="text-xs truncate" style={{ color: colors.textSecondary }}>
                {player.position}
                {player.team ? ` · ${getTeamAbbr(player.team)}` : ""}
                {player.adp ? ` · ADP ${player.adp}` : ""}
              </div>
            </div>
            <button
              onClick={() => removeFromQueue(position, player.id)}
              className="flex-shrink-0 rounded-md p-1 transition-colors hover:opacity-70"
              style={{ color: colors.adpNegative }}
              aria-label={`Remove ${player.name} from ${position} queue`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PlayerQueueSection({ colors, queues, removeFromQueue, activePlayer }) {
  const totalQueued = QUEUE_POSITIONS.reduce((sum, pos) => sum + (queues?.[pos]?.length || 0), 0)

  return (
    <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListPlus size={18} style={{ color: colors.gold }} />
            <CardTitle className="text-base font-bold tracking-wide" style={{ color: colors.gold }}>
              PLAYER QUEUE
            </CardTitle>
          </div>
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{
              background: colors.darkBlue,
              color: totalQueued > 0 ? colors.headingGreen : colors.textSecondary,
            }}
          >
            {totalQueued > 0 ? `${totalQueued} planned` : "Drag from Best Value"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {QUEUE_POSITIONS.map((position) => (
            <QueueDropZone
              key={position}
              position={position}
              players={queues?.[position] || []}
              colors={colors}
              removeFromQueue={removeFromQueue}
              activePlayer={activePlayer}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
