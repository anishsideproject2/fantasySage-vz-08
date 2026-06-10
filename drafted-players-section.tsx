"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BubbleSymbol } from "./bubble-symbol"

export function DraftedPlayersSection({
  colors,
  draftedPlayers,
  draftData,
  totalPossiblePicks = 0,
  draftedCount = 0,
  remainingCount = 0,
}) {
  const getRecentPicks = () => {
    if (!draftedPlayers || draftedPlayers.length === 0) return []
    return [...draftedPlayers].sort((a, b) => b.pick_no - a.pick_no).slice(0, 5)
  }

  const getTeamName = (rosterId) => {
    if (!draftData?.teams) return `Team ${rosterId}`
    const team = draftData.teams.find((t) => String(t.roster_id) === String(rosterId))
    return team ? team.team_name : `Team ${rosterId}`
  }

  return (
    <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-3">
        <CardTitle
          className="text-base font-bold tracking-wide flex items-center justify-between"
          style={{ color: colors.gold }}
        >
          <span>RECENT PICKS</span>
          {totalPossiblePicks > 0 && (
            <span className="text-xs font-normal" style={{ color: colors.textSecondary }}>
              {draftedCount} picked • {remainingCount} left
            </span>
          )}
        </CardTitle>
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
              <div className="col-span-2">Pick</div>
              <div className="col-span-4">Player</div>
              <div className="col-span-2">Pos</div>
              <div className="col-span-4">Team</div>
            </div>

            {/* Player Rows */}
            {getRecentPicks().map((player, idx) => {
              const round = draftData?.numTeams ? Math.floor((player.pick_no - 1) / draftData.numTeams) + 1 : "-"
              const pickInRound = draftData?.numTeams ? ((player.pick_no - 1) % draftData.numTeams) + 1 : "-"

              return (
                <div
                  key={`${player.id}-${player.pick_no}`}
                  className="grid grid-cols-12 gap-2 px-2 py-1 rounded text-sm transition-colors duration-150"
                  style={{
                    background: idx % 2 !== 0 ? colors.tableRow : "transparent",
                    color: colors.textPrimary,
                  }}
                >
                  <div className="col-span-2 text-xs font-bold" style={{ color: colors.gold }}>
                    {round}.{String(pickInRound).padStart(2, "0")}
                  </div>
                  <div className="col-span-4 truncate">{player.name}</div>
                  <div className="col-span-2">
                    <BubbleSymbol pos={player.position} colors={colors} />
                  </div>
                  <div className="col-span-4 text-xs truncate" style={{ color: colors.textSecondary }}>
                    {player.team || getTeamName(player.roster_id)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
