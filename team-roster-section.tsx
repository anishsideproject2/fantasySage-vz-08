"use client"

import { useMemo, useCallback } from "react"
import { User } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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

const getSleeperAvatarUrl = (avatar) => {
  if (!avatar) return null
  const value = String(avatar)
  if (value.startsWith("http")) return value
  return `https://sleepercdn.com/avatars/${value}`
}

const getPickLabel = (pickNo, numTeams = 1) => `${Math.floor((pickNo - 1) / numTeams) + 1}.${String(((pickNo - 1) % numTeams) + 1).padStart(2, "0")}`

const getRosterCounts = (players) =>
  players.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] || 0) + 1
    counts.total += 1
    return counts
  }, { QB: 0, RB: 0, WR: 0, TE: 0, total: 0 })

export function TeamRosterSection({
  colors,
  draftData,
  selectedTeamRosterId,
  setSelectedTeamRosterId,
  draftedPlayers,
  platform,
}) {
  const getSelectedTeamRosterPlayers = useCallback(() => {
    if (!selectedTeamRosterId || !draftedPlayers?.length) return []
    return draftedPlayers.filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
  }, [selectedTeamRosterId, draftedPlayers])

  const selectedTeam = draftData?.teams.find((team) => String(team.roster_id) === String(selectedTeamRosterId))
  const selectedTeamName = selectedTeam ? selectedTeam.team_name : "Select a Team"
  const selectedTeamOwnerDisplayName = selectedTeam ? selectedTeam.owner.display_name : ""
  const selectedTeamOwnerAvatar = selectedTeam ? selectedTeam.avatar || selectedTeam.owner.avatar : null

  const teamRosterPlayers = useMemo(() => getSelectedTeamRosterPlayers(), [getSelectedTeamRosterPlayers])

  const fullRosterSlots = useMemo(
    () => mapPlayersToRosterSlots(teamRosterPlayers, draftData?.slotSettings),
    [teamRosterPlayers, draftData?.slotSettings],
  )
  const rosterCounts = useMemo(() => getRosterCounts(teamRosterPlayers), [teamRosterPlayers])
  const rosterTemplate = useMemo(() => generateRosterSlots(draftData?.slotSettings), [draftData?.slotSettings])

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
    <Card className="flex flex-col overflow-hidden" style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="border-b px-3 py-3" style={{ borderColor: colors.lightBorder, background: `linear-gradient(135deg, ${colors.tableRow}, ${colors.card})` }}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {selectedTeamOwnerAvatar ? (
              <img src={getSleeperAvatarUrl(selectedTeamOwnerAvatar) || "/placeholder.svg"} alt={selectedTeamOwnerDisplayName} className="h-11 w-11 rounded-2xl border-2 object-cover" style={{ borderColor: colors.headingGreen }} />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2" style={{ background: colors.darkBlue, borderColor: colors.headingGreen }}>
                <User size={20} style={{ color: colors.headingGreen }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest" style={{ background: `${colors.headingGreen}22`, color: colors.headingGreen }}>
                  Team roster
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.textSecondary }}>{rosterCounts.total} drafted</span>
              </div>
              <h3 className="truncate text-lg font-black" style={{ color: colors.textPrimary }}>{selectedTeamName}</h3>
              {platform === "sleeper" && selectedTeamOwnerDisplayName && <span className="text-xs" style={{ color: colors.textSecondary }}>@{selectedTeamOwnerDisplayName}</span>}
            </div>
          </div>
          <Select value={selectedTeamRosterId || ""} onValueChange={(value) => setSelectedTeamRosterId(value ? value : null)} disabled={!draftData || !draftData.teams || draftData.teams.length === 0}>
            <SelectTrigger className="h-10 w-full rounded-xl text-left font-bold xl:w-[16rem]" style={{ background: colors.darkBlue, color: colors.textPrimary, borderColor: colors.cardBorder }}>
              <SelectValue placeholder="-- Select a Team --" />
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}>
              {draftData?.teams.map((team) => (
                <SelectItem key={team.roster_id} value={team.roster_id} className="text-sm" style={{ color: colors.textPrimary }}>
                  {team.team_name} {platform === "sleeper" ? `(@${team.owner.display_name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px]">
          {["Overall", "QB", "RB", "WR", "TE"].map((pos) => {
            const score = draftScore[pos]
            const isGood = score >= 0
            return (
              <div key={pos} className="rounded-xl border px-2 py-2" style={{ borderColor: colors.lightBorder, background: colors.tableRow }}>
                <div className="font-black" style={{ color: pos === "Overall" ? colors.gold : colors.textSecondary }}>{pos}</div>
                <div className="text-sm font-black" style={{ color: score === 0 ? colors.textPrimary : isGood ? colors.adpPositive : colors.adpNegative }}>{score > 0 ? "+" : ""}{score}</div>
              </div>
            )
          })}
        </div>
      </CardHeader>

      {!selectedTeamRosterId ? (
        <CardContent className="p-3">
          <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
            Pick a team from the live draft board or selector to inspect roster construction.
          </div>
        </CardContent>
      ) : (
        <CardContent className="px-3 py-3">
          <div className="mb-3 grid grid-cols-4 gap-2">
            {["QB", "RB", "WR", "TE"].map((pos) => (
              <div key={pos} className="rounded-2xl border px-2 py-2 text-center shadow-sm" style={{ borderColor: colors.lightBorder, background: `linear-gradient(180deg, ${colors.darkBlue}, ${colors.tableRow})` }}>
                <div className="text-[10px] font-black" style={{ color: colors.textSecondary }}>{pos}</div>
                <div className="text-lg font-black" style={{ color: getBubbleColorsForSlot(pos, colors).bg }}>{rosterCounts[pos] || 0}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {fullRosterSlots.map((player, idx) => {
              const slotType = rosterTemplate[idx]
              const slotColors = getBubbleColorsForSlot(slotType, colors)
              const isRecentPick = player && player.pick_no === mostRecentPickNo
              const value = player?.adp && player?.pick_no ? player.pick_no - Number.parseFloat(player.adp) : null

              return (
                <div key={idx + "-" + (player?.id || "empty")} className="group rounded-2xl border p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" style={{ background: isRecentPick ? `${colors.headingGreen}18` : `linear-gradient(180deg, ${colors.tableRow}, ${colors.card})`, borderColor: isRecentPick ? colors.headingGreen : colors.lightBorder, opacity: player ? 1 : 0.62 }}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-2xl text-xs font-black shadow-inner" style={{ background: slotColors.bg, color: slotColors.text }}>{POSITION_LABELS[slotType] || slotType}</div>
                    {player ? (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black" style={{ color: colors.textPrimary }} title={player.name}>{player.name}</div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: colors.textSecondary }}>
                            <span className="rounded-full px-1.5 py-0.5" style={{ background: `${slotColors.bg}22`, color: slotColors.bg }}>{player.position}</span><span>{getTeamAbbr(player.team)}</span>{isRecentPick && <span className="rounded-full px-1.5 py-0.5 font-black" style={{ background: `${colors.headingGreen}22`, color: colors.headingGreen }}>Latest</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-black" style={{ color: colors.textPrimary }}>{getPickLabel(player.pick_no, draftData?.numTeams || 1)}</div>
                          {value !== null && <div className="text-[11px] font-black" style={{ color: value >= 0 ? colors.adpPositive : colors.adpNegative }}>{value > 0 ? "+" : ""}{value.toFixed(1)}</div>}
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold italic" style={{ color: colors.textSecondary }}>Open {POSITION_LABELS[slotType] || slotType}</div>
                        <div className="text-[11px]" style={{ color: colors.textSecondary }}>Use the suggestions panel to fill this slot.</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
