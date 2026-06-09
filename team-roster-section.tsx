"use client"

import { useMemo, useCallback, useState } from "react"
import { User, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const POSITION_LABELS = {
  FLEX: "WRT",
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  BN: "BN",
}

const FLEX_POSITIONS = ["RB", "WR", "TE"]

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
  ARI: "ARI",
  ATL: "ATL",
  BAL: "BAL",
  BUF: "BUF",
  CAR: "CAR",
  CHI: "CHI",
  CIN: "CIN",
  CLE: "CLE",
  DAL: "DAL",
  DEN: "DEN",
  DET: "DET",
  GB: "GB",
  HOU: "HOU",
  IND: "IND",
  JAX: "JAX",
  KC: "KC",
  LV: "LV",
  LAC: "LAC",
  LAR: "LAR",
  MIA: "MIA",
  MIN: "MIN",
  NE: "NE",
  NO: "NO",
  NYG: "NYG",
  NYJ: "NYJ",
  PHI: "PHI",
  PIT: "PIT",
  SF: "SF",
  SEA: "SEA",
  TB: "TB",
  TEN: "TEN",
  WAS: "WAS",
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
    case "BN":
      return { bg: colors.pillBN, text: colors.pillTextBN }
    default:
      return { bg: "#333", text: colors.white }
  }
}

function generateRosterSlots(settings) {
  const slotOrder = []
  if (!settings) {
    return ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN", "BN", "BN", "BN"]
  }

  const positionMap = {
    0: "QB",
    2: "RB",
    4: "WR",
    6: "TE",
    23: "FLEX",
    16: "BN",
  }

  if (settings.slots_qb) {
    // Sleeper format
    for (let i = 0; i < (settings.slots_qb || 1); i++) slotOrder.push("QB")
    for (let i = 0; i < (settings.slots_rb || 2); i++) slotOrder.push("RB")
    for (let i = 0; i < (settings.slots_wr || 2); i++) slotOrder.push("WR")
    for (let i = 0; i < (settings.slots_te || 1); i++) slotOrder.push("TE")
    for (let i = 0; i < (settings.slots_flex || 1); i++) slotOrder.push("FLEX")
    for (let i = 0; i < (settings.slots_bn || 5); i++) slotOrder.push("BN")
  } else if (settings.rosterSettings) {
    // ESPN format
    const { lineupSlotCounts } = settings.rosterSettings
    const sortedSlots = Object.keys(lineupSlotCounts).sort((a, b) => {
      const order = [0, 2, 4, 6, 23, 16]
      return order.indexOf(Number.parseInt(a)) - order.indexOf(Number.parseInt(b))
    })

    sortedSlots.forEach((slotId) => {
      const position = positionMap[slotId]
      if (position) {
        for (let i = 0; i < lineupSlotCounts[slotId]; i++) {
          slotOrder.push(position)
        }
      }
    })
  }
  return slotOrder
}

function mapPlayersToRosterSlots(players, settings) {
  const rosterTemplate = generateRosterSlots(settings)
  const filledRoster = Array(rosterTemplate.length).fill(null)
  const playersToSlot = [...players].sort((a, b) => a.pick_no - b.pick_no)

  const findAndSlotPlayer = (isMatch) => {
    const playerIndex = playersToSlot.findIndex(isMatch)
    if (playerIndex > -1) {
      const [player] = playersToSlot.splice(playerIndex, 1)
      return player
    }
    return null
  }

  rosterTemplate.forEach((slotType, i) => {
    if (filledRoster[i] === null && !["FLEX", "BN"].includes(slotType)) {
      const player = findAndSlotPlayer((p) => p.position === slotType)
      if (player) filledRoster[i] = player
    }
  })

  rosterTemplate.forEach((slotType, i) => {
    if (filledRoster[i] === null && slotType === "FLEX") {
      const player = findAndSlotPlayer((p) => FLEX_POSITIONS.includes(p.position))
      if (player) filledRoster[i] = player
    }
  })

  rosterTemplate.forEach((slotType, i) => {
    if (filledRoster[i] === null && slotType === "BN") {
      if (playersToSlot.length > 0) {
        const player = playersToSlot.shift()
        filledRoster[i] = player
      }
    }
  })

  return filledRoster
}

const getSleeperAvatarUrl = (avatar) => (avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : null)

const QUEUE_POSITIONS = ["QB", "RB", "WR", "TE", "FLEX"]

function QueueDropZone({ position, players, colors, addToQueue, removeFromQueue }) {
  const [isOver, setIsOver] = useState(false)
  const slotColors = getBubbleColorsForSlot(position, colors)

  const accepts = (playerPos) => {
    if (position === "FLEX") return FLEX_POSITIONS.includes(playerPos)
    return playerPos === position
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsOver(false)
    try {
      const player = JSON.parse(e.dataTransfer.getData("application/json"))
      if (player && accepts(player.position)) {
        addToQueue(position, player)
      }
    } catch {
      // ignore malformed drops
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className="rounded-lg border-2 p-2 transition-colors"
      style={{
        borderStyle: "dashed",
        borderColor: isOver ? colors.headingGreen : colors.cardBorder,
        background: isOver ? `${colors.headingGreen}1a` : colors.tableRow,
        minHeight: "64px",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs flex-shrink-0"
          style={{ background: slotColors.bg, color: slotColors.text }}
        >
          {POSITION_LABELS[position] || position}
        </div>
        <span className="text-xs font-bold" style={{ color: colors.textSecondary }}>
          {players.length > 0 ? `${players.length} queued` : "Drag players here"}
        </span>
      </div>
      <div className="space-y-1">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between gap-2 px-2 py-1 rounded text-sm"
            style={{ background: colors.card, color: colors.textPrimary }}
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{player.name}</div>
              <div className="text-xs" style={{ color: colors.textSecondary }}>
                {player.position}
                {player.team ? ` - ${getTeamAbbr(player.team)}` : ""}
                {player.adp ? ` · ADP ${player.adp}` : ""}
              </div>
            </div>
            <button
              onClick={() => removeFromQueue(position, player.id)}
              className="flex-shrink-0 rounded p-1 hover:opacity-70"
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

export function TeamRosterSection({
  colors,
  draftData,
  selectedTeamRosterId,
  setSelectedTeamRosterId,
  draftedPlayers,
  platform,
  queues,
  addToQueue,
  removeFromQueue,
}) {
  const getSelectedTeamRosterPlayers = useCallback(() => {
    if (!selectedTeamRosterId || !draftedPlayers?.length) return []
    return draftedPlayers.filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
  }, [selectedTeamRosterId, draftedPlayers])

  const selectedTeam = draftData?.teams.find((team) => String(team.roster_id) === String(selectedTeamRosterId))
  const selectedTeamName = selectedTeam ? selectedTeam.team_name : "Select a Team"
  const selectedTeamOwnerDisplayName = selectedTeam ? selectedTeam.owner.display_name : ""
  const selectedTeamOwnerAvatar = selectedTeam ? selectedTeam.owner.avatar : null

  const teamRosterPlayers = useMemo(() => getSelectedTeamRosterPlayers(), [getSelectedTeamRosterPlayers])

  const fullRosterSlots = useMemo(
    () => mapPlayersToRosterSlots(teamRosterPlayers, draftData?.slotSettings),
    [teamRosterPlayers, draftData?.slotSettings],
  )

  const draftScore = useMemo(() => {
    const scores = { QB: 0, RB: 0, WR: 0, TE: 0, Overall: 0 }
    if (!draftData || !teamRosterPlayers.length) return scores

    const starterSlots = generateRosterSlots(draftData.slotSettings).filter((slot) => slot !== "BN")
    const mappedRoster = mapPlayersToRosterSlots(teamRosterPlayers, draftData.slotSettings)

    const starters = mappedRoster.slice(0, starterSlots.length)

    starters.forEach((player) => {
      if (player && player.adp && player.pick_no) {
        const value = player.pick_no - Number.parseFloat(player.adp)
        if (scores.hasOwnProperty(player.position)) {
          scores[player.position] += value
        } else if (FLEX_POSITIONS.includes(player.position)) {
          scores[player.position] += value
        }
        scores.Overall += value
      }
    })

    for (const pos in scores) {
      scores[pos] = Number.parseFloat(scores[pos].toFixed(1))
    }

    return scores
  }, [teamRosterPlayers, draftData])

  // Find the most recent pick for highlighting
  const mostRecentPickNo = useMemo(() => {
    if (!teamRosterPlayers.length) return null
    return Math.max(...teamRosterPlayers.map((p) => p.pick_no))
  }, [teamRosterPlayers])

  return (
    <div className="space-y-4">
      <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
        <CardContent className="p-4">
          <Select
            value={selectedTeamRosterId || ""}
            onValueChange={(value) => setSelectedTeamRosterId(value ? value : null)}
            disabled={!draftData || !draftData.teams || draftData.teams.length === 0}
          >
            <SelectTrigger
              className="w-full text-center font-bold"
              style={{
                background: "#6B7280", // Gray color
                color: "white", // White text
                borderColor: colors.cardBorder,
              }}
            >
              <SelectValue placeholder="-- Select a Team --" />
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: "#6B7280", borderColor: colors.cardBorder }}>
              {draftData?.teams.map((team) => (
                <SelectItem
                  key={team.roster_id}
                  value={team.roster_id}
                  style={{
                    backgroundColor: "#6B7280",
                    color: "white",
                    "&:hover": { backgroundColor: "#4B5563" },
                    "&:focus": { backgroundColor: "#4B5563" },
                  }}
                  className="text-white hover:bg-gray-600 focus:bg-gray-600"
                >
                  {team.team_name} {platform === "sleeper" ? `(@${team.owner.display_name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Player Queue - drag players here from Best Value */}
      <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold tracking-wide" style={{ color: colors.gold }}>
              PLAYER QUEUE
            </CardTitle>
            <span className="text-xs" style={{ color: colors.textSecondary }}>
              Drag from Best Value
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUEUE_POSITIONS.map((position) => (
              <QueueDropZone
                key={position}
                position={position}
                players={queues?.[position] || []}
                colors={colors}
                addToQueue={addToQueue}
                removeFromQueue={removeFromQueue}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedTeamRosterId && (
        <Card
          className="flex-1 flex flex-col"
          style={{
            background: colors.card,
            border: `1px solid ${colors.lightBorder}`,
            minHeight: "700px",
          }}
        >
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {selectedTeamOwnerAvatar ? (
                  <img
                    src={getSleeperAvatarUrl(selectedTeamOwnerAvatar) || "/placeholder.svg"}
                    alt={selectedTeamOwnerDisplayName}
                    className="w-10 h-10 rounded-full border-2"
                    style={{ borderColor: colors.headingGreen }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center"
                    style={{
                      background: colors.darkBlue,
                      borderColor: colors.headingGreen,
                    }}
                  >
                    <User size={20} style={{ color: colors.headingGreen }} />
                  </div>
                )}
                <div>
                  <h3 className="font-bold" style={{ color: colors.textPrimary }}>
                    {selectedTeamName}
                  </h3>
                  {platform === "sleeper" && (
                    <span className="text-xs" style={{ color: colors.textSecondary }}>
                      @{selectedTeamOwnerDisplayName}
                    </span>
                  )}
                </div>
              </div>
              <div
                className="px-3 py-2 rounded border"
                style={{
                  background: colors.darkBlue,
                  borderColor: colors.lightBorder,
                }}
              >
                <div className="text-xs text-center mb-1" style={{ color: colors.textSecondary }}>
                  DRAFT SCORE (Starters)
                </div>
                <div className="flex gap-2 text-xs">
                  {["Overall", "QB", "RB", "WR", "TE"].map((pos) => {
                    const score = draftScore[pos]
                    const isGood = score >= 0
                    const showPlus = score > 0
                    return (
                      <div key={pos} className="text-center">
                        <div
                          className="font-bold"
                          style={{
                            color: pos === "Overall" ? colors.gold : colors.textPrimary,
                          }}
                        >
                          {pos}
                        </div>
                        <div
                          className="font-bold"
                          style={{
                            color: score === 0 ? colors.textPrimary : isGood ? colors.adpPositive : colors.adpNegative,
                          }}
                        >
                          {showPlus ? "+" : ""}
                          {score}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1 flex flex-col min-h-0 px-2">
            <div className="flex-1 space-y-2">
              {fullRosterSlots.map((player, idx) => {
                const slotType = generateRosterSlots(draftData?.slotSettings)[idx]
                const slotColors = getBubbleColorsForSlot(slotType, colors)
                const isRecentPick = player && player.pick_no === mostRecentPickNo

                return (
                  <div
                    key={idx + "-" + (player?.id || "empty")}
                    className="flex items-center px-3 py-2 rounded border-2"
                    style={{
                      background: colors.tableRow,
                      borderColor: colors.purple,
                      opacity: player ? 1 : 0.55,
                      minHeight: "48px",
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center font-bold text-sm mr-4 flex-shrink-0"
                      style={{
                        background: slotColors.bg,
                        color: slotColors.text,
                      }}
                    >
                      {POSITION_LABELS[slotType] || slotType}
                    </div>
                    {player ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-base" style={{ color: colors.textPrimary }}>
                            {player.name}
                          </div>
                          <div className="text-sm flex items-center gap-2" style={{ color: colors.textSecondary }}>
                            <span>{player.position}</span>
                            <span>-</span>
                            <span>{getTeamAbbr(player.team)}</span>
                          </div>
                        </div>
                        <div className="text-right min-w-20">
                          <div className="font-bold text-base" style={{ color: colors.textPrimary }}>
                            {`${Math.floor((player.pick_no - 1) / (draftData?.numTeams || 1)) + 1}.${String(((player.pick_no - 1) % (draftData?.numTeams || 1)) + 1).padStart(2, "0")}`}
                          </div>
                          {player.adp && player.pick_no && (
                            <div
                              className="text-sm font-bold"
                              style={{
                                color:
                                  player.pick_no - Number.parseFloat(player.adp) >= 0
                                    ? colors.adpPositive
                                    : colors.adpNegative,
                              }}
                            >
                              Value: {player.pick_no - Number.parseFloat(player.adp) > 0 ? "+" : ""}
                              {(player.pick_no - Number.parseFloat(player.adp)).toFixed(1)}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1" style={{ color: colors.textPrimary }}>
                        <span className="italic text-base">Empty</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
