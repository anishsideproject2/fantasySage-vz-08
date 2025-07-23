"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ScoreboardSection({ colors, draftData, draftedPlayers, selectedTeamRosterId }) {
  const getTeamStats = () => {
    if (!draftData?.teams || !draftedPlayers) return []

    return draftData.teams.map((team) => {
      const teamPicks = draftedPlayers.filter((player) => String(player.roster_id) === String(team.roster_id))
      const totalPicks = teamPicks.length

      // Calculate draft score (sum of pick value vs ADP)
      const draftScore = teamPicks.reduce((sum, player) => {
        if (player.adp && player.pick_no) {
          return sum + (player.pick_no - Number.parseFloat(player.adp))
        }
        return sum
      }, 0)

      return {
        ...team,
        totalPicks,
        draftScore: draftScore.toFixed(1),
        isSelected: String(team.roster_id) === String(selectedTeamRosterId),
      }
    })
  }

  const teamStats = getTeamStats()

  return (
    <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold tracking-wide" style={{ color: colors.gold }}>
          DRAFT SCOREBOARD
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
              <div className="col-span-6">Team</div>
              <div className="col-span-3 text-center">Picks</div>
              <div className="col-span-3 text-right">Score</div>
            </div>

            {/* Team Rows */}
            {teamStats
              .sort((a, b) => Number.parseFloat(b.draftScore) - Number.parseFloat(a.draftScore))
              .map((team, idx) => (
                <div
                  key={team.roster_id}
                  className="grid grid-cols-12 gap-2 px-2 py-1 rounded text-sm transition-colors duration-150"
                  style={{
                    background: team.isSelected ? colors.highlight : idx % 2 !== 0 ? colors.tableRow : "transparent",
                    color: colors.textPrimary,
                  }}
                >
                  <div className="col-span-6 truncate">{team.team_name}</div>
                  <div className="col-span-3 text-center font-bold" style={{ color: colors.gold }}>
                    {team.totalPicks}
                  </div>
                  <div
                    className="col-span-3 text-right font-bold"
                    style={{
                      color: Number.parseFloat(team.draftScore) >= 0 ? colors.adpPositive : colors.adpNegative,
                    }}
                  >
                    {Number.parseFloat(team.draftScore) > 0 ? "+" : ""}
                    {team.draftScore}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
