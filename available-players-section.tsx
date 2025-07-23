"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"
import { BubbleSymbol } from "./bubble-symbol"

const POSITIONS = ["All", "Flex", "QB", "RB", "WR", "TE"]

export function AvailablePlayersSection({
  colors,
  searchTerm,
  setSearchTerm,
  positionFilter,
  setPositionFilter,
  getFilteredPlayers,
}) {
  return (
    <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold tracking-wide" style={{ color: colors.gold }}>
          AVAILABLE PLAYERS
        </CardTitle>
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              size={16}
              style={{ color: colors.textSecondary }}
            />
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-8 text-sm"
              style={{
                background: colors.background,
                color: colors.textPrimary,
                borderColor: colors.cardBorder,
              }}
            />
          </div>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
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
      </CardHeader>
      <CardContent className="pt-0 px-2">
        <div className="overflow-y-auto max-h-[48rem]">
          <div className="space-y-1">
            {/* Header */}
            <div
              className="grid grid-cols-12 gap-2 px-2 py-1 text-xs font-bold border-b-2"
              style={{
                color: colors.gold,
                borderColor: colors.lightBorder,
              }}
            >
              <div className="col-span-6">Player</div>
              <div className="col-span-2">Pos</div>
              <div className="col-span-2">Team</div>
              <div className="col-span-2 text-right">ADP</div>
            </div>

            {/* Player Rows */}
            {getFilteredPlayers().map((player, idx) => (
              <div
                key={player.id}
                className="grid grid-cols-12 gap-2 px-2 py-1 rounded text-sm player-row transition-colors duration-150 hover:cursor-pointer"
                style={{
                  background: idx % 2 !== 0 ? colors.tableRow : "transparent",
                  color: colors.textPrimary,
                }}
                onClick={() => {
                  const slug = `${player.firstName}-${player.lastName}`.toLowerCase().replace(/[^a-z-]/g, "")
                  const url = `https://www.playerprofiler.com/nfl/${slug}`
                  if (url) window.open(url, "_blank", "noopener,noreferrer")
                }}
              >
                <div className="col-span-6 truncate player-name-cell">{player.name}</div>
                <div className="col-span-2">
                  <BubbleSymbol pos={player.position} colors={colors} />
                </div>
                <div className="col-span-2 text-xs" style={{ color: colors.textSecondary }}>
                  {player.team}
                </div>
                <div className="col-span-2 text-right font-bold" style={{ color: colors.gold }}>
                  {player.adp}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <style jsx>{`
        .player-row:hover {
          background-color: ${colors.purple}60 !important;
        }
      `}</style>
    </Card>
  )
}
