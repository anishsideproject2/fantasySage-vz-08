"use client"

import { X, ListPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const QUEUE_POSITIONS = ["QB", "RB", "WR", "TE"]

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
    default:
      return { bg: "#333", text: colors.white }
  }
}

const getValueColor = (valueDiff, colors) => {
  if (valueDiff === undefined || valueDiff === "--") return colors.textSecondary
  return Number.parseFloat(valueDiff) >= 0 ? "#22c55e" : "#ef4444"
}

const formatValue = (valueDiff) => {
  if (valueDiff === undefined || valueDiff === "--") return null
  const num = Number.parseFloat(valueDiff)
  return `${num > 0 ? "+" : ""}${valueDiff}`
}

function QueuedPlayerRow({ position, player, idx, colors, removeFromQueue }) {
  const value = formatValue(player.valueDiff)
  return (
    <div
      className="flex items-center gap-2 px-2 py-2 rounded-lg"
      style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}
    >
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: colors.darkBlue, color: colors.gold }}
      >
        {idx + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold whitespace-normal break-words" style={{ color: colors.textPrimary }}>
          {player.name}
        </div>
        <div className="text-xs" style={{ color: colors.textSecondary }}>
          {player.position}
          {player.team ? ` · ${getTeamAbbr(player.team)}` : ""}
          {player.adp ? ` · ADP ${player.adp}` : ""}
        </div>
      </div>
      {value && (
        <span className="text-sm font-bold flex-shrink-0" style={{ color: getValueColor(player.valueDiff, colors) }}>
          {value}
        </span>
      )}
      <button
        onClick={() => removeFromQueue(position, player.id)}
        className="flex-shrink-0 rounded-md p-1 transition-colors hover:opacity-70"
        style={{ color: colors.adpNegative }}
        aria-label={`Remove ${player.name} from ${position} queue`}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function PositionGroup({ position, players, colors, removeFromQueue }) {
  const slotColors = getBubbleColorsForSlot(position, colors)
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
          style={{ background: slotColors.bg, color: slotColors.text }}
        >
          {position}
        </div>
        <span className="text-xs font-bold tracking-wide" style={{ color: colors.textSecondary }}>
          {players.length} QUEUED
        </span>
      </div>
      <div className="space-y-1.5">
        {players.map((player, idx) => (
          <QueuedPlayerRow
            key={player.id}
            position={position}
            player={player}
            idx={idx}
            colors={colors}
            removeFromQueue={removeFromQueue}
          />
        ))}
      </div>
    </div>
  )
}

export function PlayerQueueSection({ colors, queues, removeFromQueue, clearQueue }) {
  const totalQueued = QUEUE_POSITIONS.reduce((sum, pos) => sum + (queues?.[pos]?.length || 0), 0)
  const activePositions = QUEUE_POSITIONS.filter((pos) => (queues?.[pos]?.length || 0) > 0)

  const isEmpty = totalQueued === 0

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
          <div className="flex items-center gap-2">
            {totalQueued > 0 && (
              <button
                onClick={clearQueue}
                className="text-xs font-bold px-2 py-1 rounded-md transition-colors hover:opacity-80"
                style={{ background: colors.darkBlue, color: colors.adpNegative }}
                aria-label="Clear all queued players"
              >
                Clear all
              </button>
            )}
            <span
              className="text-xs font-bold px-2 py-1 rounded-full"
              style={{
                background: colors.darkBlue,
                color: totalQueued > 0 ? colors.headingGreen : colors.textSecondary,
              }}
            >
              {totalQueued > 0 ? `${totalQueued} planned` : "Tap + to add"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3">
        <div
          className="rounded-xl border-2 border-dashed p-3 transition-all duration-150"
          style={{
            borderColor: colors.cardBorder,
            minHeight: isEmpty ? "120px" : undefined,
          }}
        >
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center text-center gap-1 py-6">
              <ListPlus size={22} style={{ color: colors.textSecondary }} />
              <span className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                No players queued yet
              </span>
              <span className="text-xs" style={{ color: colors.textSecondary }}>
                Tap the + on any player to queue them — they&apos;ll auto-sort by position
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {activePositions.map((position) => (
                <PositionGroup
                  key={position}
                  position={position}
                  players={queues[position]}
                  colors={colors}
                  removeFromQueue={removeFromQueue}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
