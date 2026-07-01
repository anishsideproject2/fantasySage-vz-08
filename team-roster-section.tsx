"use client"

import { useMemo, useCallback } from "react"
import { AlertTriangle, CheckCircle2, User } from "lucide-react"
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
  const isDarkTheme = colors.card !== "#FFFFFF"
  switch (pos) {
    case "QB":
      return { bg: colors.pillQB, text: colors.pillTextQB }
    case "RB":
      return { bg: colors.pillRB, text: colors.pillTextRB }
    case "WR":
      return { bg: isDarkTheme ? colors.pillWR : colors.fantasyProsBlue, text: isDarkTheme ? colors.pillTextWR : colors.white }
    case "TE":
      return { bg: colors.pillTE, text: colors.pillTextTE }
    case "FLEX":
      return { bg: isDarkTheme ? colors.pillWR : colors.fantasyProsBlue, text: isDarkTheme ? colors.pillTextWR : colors.white }
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


const groupRosterSlotsByPosition = (players, template) => {
  const groups = []

  template.forEach((slotType, index) => {
    const lastGroup = groups[groups.length - 1]
    const slot = { slotType, player: players[index], index }

    if (lastGroup?.slotType === slotType) {
      lastGroup.slots.push(slot)
    } else {
      groups.push({ slotType, slots: [slot] })
    }
  })

  return groups
}

const getStarterSlotCount = (settings) => generateRosterSlots(settings).filter((slot) => slot !== "BN").length

const getRosterBuildInsights = (counts, template) => {
  const requiredCounts = template.reduce((acc, slot) => {
    if (["QB", "RB", "WR", "TE"].includes(slot)) acc[slot] = (acc[slot] || 0) + 1
    return acc
  }, { QB: 0, RB: 0, WR: 0, TE: 0 })
  const flexSlots = template.filter((slot) => slot === "FLEX").length
  const flexEligibleCount = FLEX_POSITIONS.reduce((sum, pos) => sum + (counts[pos] || 0), 0)
  const flexCoreTarget = (requiredCounts.RB || 0) + (requiredCounts.WR || 0) + (requiredCounts.TE || 0) + flexSlots
  const openStarters = ["QB", "RB", "WR", "TE"].filter((pos) => (counts[pos] || 0) < (requiredCounts[pos] || 0))
  const starterCount = template.filter((slot) => slot !== "BN").length
  const benchCount = Math.max((counts.total || 0) - starterCount, 0)
  const benchSlots = template.filter((slot) => slot === "BN").length

  if ((counts.WR || 0) < (requiredCounts.WR || 0)) {
    return { tone: "warning", label: "WR starter gap", text: `Prioritize target-earning WRs: ${Math.max((requiredCounts.WR || 0) - (counts.WR || 0), 0)} dedicated WR slot${(requiredCounts.WR || 0) - (counts.WR || 0) === 1 ? "" : "s"} still open.` }
  }
  if (openStarters.length) {
    return { tone: "warning", label: "Starter gap", text: `Open starters remain at ${openStarters.join(", ")}; keep suggestions filtered toward real lineup holes before bench depth.` }
  }
  if (flexEligibleCount < flexCoreTarget) {
    return { tone: "warning", label: "Flex core open", text: `Add one more RB/WR/TE for flex coverage before low-upside backups.` }
  }
  if (benchCount < benchSlots) {
    return { tone: "good", label: "Starters covered", text: `Starter shell is filled. Use ${benchSlots - benchCount} bench slot${benchSlots - benchCount === 1 ? "" : "s"} on RB contingency value and WR spike weeks.` }
  }
  return { tone: "good", label: "Roster filled", text: "Roster slots are filled; compare recent picks by ADP value and positional balance." }
}

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
  variant = "full",
}) {
  const getSelectedTeamRosterPlayers = useCallback(() => {
    if (!selectedTeamRosterId || !draftedPlayers?.length) return []
    return draftedPlayers.filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
  }, [selectedTeamRosterId, draftedPlayers])

  const selectedTeam = draftData?.teams.find((team) => String(team.roster_id) === String(selectedTeamRosterId))
  const selectedTeamName = selectedTeam ? selectedTeam.team_name : "Select a Team"
  const selectedTeamOwnerDisplayName = selectedTeam ? selectedTeam.owner.display_name : ""
  const selectedTeamOwnerAvatar = selectedTeam ? selectedTeam.avatar || selectedTeam.owner.avatar : null
  const selectedTeamOwnerAvatarUrl = getSleeperAvatarUrl(selectedTeamOwnerAvatar)

  const teamRosterPlayers = useMemo(() => getSelectedTeamRosterPlayers(), [getSelectedTeamRosterPlayers])

  const fullRosterSlots = useMemo(
    () => mapPlayersToRosterSlots(teamRosterPlayers, draftData?.slotSettings),
    [teamRosterPlayers, draftData?.slotSettings],
  )
  const rosterCounts = useMemo(() => getRosterCounts(teamRosterPlayers), [teamRosterPlayers])
  const rosterTemplate = useMemo(() => generateRosterSlots(draftData?.slotSettings), [draftData?.slotSettings])
  const rosterSlotGroups = useMemo(
    () => groupRosterSlotsByPosition(fullRosterSlots, rosterTemplate),
    [fullRosterSlots, rosterTemplate],
  )
  const starterSlotCount = useMemo(() => getStarterSlotCount(draftData?.slotSettings), [draftData?.slotSettings])
  const rosterProgress = rosterTemplate.length ? Math.min(100, Math.round((rosterCounts.total / rosterTemplate.length) * 100)) : 0
  const starterProgress = starterSlotCount ? Math.min(100, Math.round((Math.min(rosterCounts.total, starterSlotCount) / starterSlotCount) * 100)) : 0
  const rosterBuildInsight = useMemo(() => getRosterBuildInsights(rosterCounts, rosterTemplate), [rosterCounts, rosterTemplate])

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


  if (variant === "compact") {
    return (
      <Card className="flex h-full min-h-0 flex-col overflow-hidden shadow-2xl" style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
        <CardHeader className="border-b px-2.5 py-2" style={{ borderColor: colors.lightBorder, background: `linear-gradient(135deg, ${colors.tableRow}, ${colors.card})` }}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {selectedTeamOwnerAvatarUrl ? (
                <img src={selectedTeamOwnerAvatarUrl} alt={selectedTeamOwnerDisplayName || selectedTeamName} className="h-8 w-8 shrink-0 rounded-lg border object-cover" style={{ borderColor: colors.headingGreen }} />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ background: colors.darkBlue, borderColor: colors.headingGreen }}>
                  <User size={15} style={{ color: colors.headingGreen }} />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: colors.headingGreen }}>Selected roster</div>
                <div className="truncate text-sm font-black" style={{ color: colors.textPrimary }}>{selectedTeamName}</div>
              </div>
            </div>
          </div>
        </CardHeader>

        {!selectedTeamRosterId ? (
          <CardContent className="p-2">
            <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
              Select a draft slot to preview its roster.
            </div>
          </CardContent>
        ) : (
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {fullRosterSlots.map((player, index) => {
                const slotType = rosterTemplate[index] || "BN"
                const slotColors = getBubbleColorsForSlot(slotType, colors)
                const isRecentPick = player && player.pick_no === mostRecentPickNo
                const value = player?.adp && player?.pick_no ? player.pick_no - Number.parseFloat(player.adp) : null

                return (
                  <div key={index + "-compact-" + (player?.id || "empty")} className="min-w-0 rounded-lg border px-1.5 py-1.5" style={{ background: isRecentPick ? `${colors.headingGreen}18` : `linear-gradient(180deg, ${slotColors.bg}14, ${colors.card})`, borderColor: isRecentPick ? colors.headingGreen : `${slotColors.bg}66`, boxShadow: `inset 3px 0 0 ${slotColors.bg}`, opacity: player ? 1 : 0.72 }}>
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span className="rounded px-1.5 py-0.5 text-[8px] font-black" style={{ background: `${slotColors.bg}24`, color: slotColors.bg }}>{POSITION_LABELS[slotType] || slotType}</span>
                      {player?.pick_no && <span className="text-[8px] font-bold" style={{ color: colors.textSecondary }}>{getPickLabel(player.pick_no, draftData?.numTeams || 1)}</span>}
                    </div>
                    {player ? (
                      <>
                        <div className="truncate text-[11px] font-black leading-tight" style={{ color: colors.textPrimary }} title={player.name}>{player.name}</div>
                        <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px]" style={{ color: colors.textSecondary }}>
                          <span className="truncate">{player.position} · {getTeamAbbr(player.team)}</span>
                          {value !== null && <span className="font-black" style={{ color: value >= 0 ? colors.adpPositive : colors.adpNegative }}>{value > 0 ? "+" : ""}{value.toFixed(1)}</span>}
                        </div>
                      </>
                    ) : (
                      <div className="truncate text-[11px] font-bold italic" style={{ color: colors.textSecondary }}>Open {POSITION_LABELS[slotType] || slotType}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden" style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="border-b px-3 py-2" style={{ borderColor: colors.lightBorder, background: `linear-gradient(135deg, ${colors.tableRow}, ${colors.card})` }}>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {selectedTeamOwnerAvatarUrl ? (
              <img src={selectedTeamOwnerAvatarUrl} alt={selectedTeamOwnerDisplayName} className="h-14 w-14 rounded-2xl border-2 object-cover shadow-lg" style={{ borderColor: colors.headingGreen }} />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 shadow-lg" style={{ background: colors.darkBlue, borderColor: colors.headingGreen }}>
                <User size={24} style={{ color: colors.headingGreen }} />
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
            <SelectTrigger className="h-14 w-full rounded-2xl text-left font-bold xl:w-[24rem]" style={{ background: colors.darkBlue, color: colors.textPrimary, borderColor: colors.cardBorder }}>
              {selectedTeam ? (
                <div className="flex min-w-0 items-center gap-3">
                  {selectedTeamOwnerAvatarUrl ? (
                    <img src={selectedTeamOwnerAvatarUrl} alt={selectedTeamOwnerDisplayName || selectedTeamName} className="h-10 w-10 shrink-0 rounded-xl border object-cover" style={{ borderColor: colors.headingGreen }} />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ background: colors.card, borderColor: colors.cardBorder }}>
                      <User size={18} style={{ color: colors.headingGreen }} />
                    </div>
                  )}
                  <span className="min-w-0 truncate">{selectedTeamName}</span>
                </div>
              ) : (
                <SelectValue placeholder="-- Select a Team --" />
              )}
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}>
              {draftData?.teams.map((team) => {
                const avatar = team.avatar || team.owner?.avatar
                const ownerName = team.owner?.display_name || team.owner?.username
                return (
                  <SelectItem key={team.roster_id} value={team.roster_id} className="py-2 pl-8 pr-3 text-sm" style={{ color: colors.textPrimary }}>
                    <div className="flex min-w-0 items-center gap-3">
                      {platform === "sleeper" && avatar ? (
                        <img src={getSleeperAvatarUrl(avatar) || "/placeholder.svg"} alt={ownerName || team.team_name} className="h-9 w-9 shrink-0 rounded-xl border object-cover" style={{ borderColor: colors.headingGreen }} />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border" style={{ background: colors.darkBlue, borderColor: colors.cardBorder }}>
                          <User size={16} style={{ color: colors.headingGreen }} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-black">{team.team_name}</div>
                        {platform === "sleeper" && ownerName && <div className="truncate text-xs" style={{ color: colors.textSecondary }}>@{ownerName}</div>}
                      </div>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px]">
          {["Overall", "QB", "RB", "WR", "TE"].map((pos) => {
            const score = draftScore[pos]
            const isGood = score >= 0
            return (
              <div key={pos} className="rounded-lg border px-1.5 py-1" style={{ borderColor: colors.lightBorder, background: colors.tableRow }}>
                <div className="font-black" style={{ color: pos === "Overall" ? colors.gold : colors.textSecondary }}>{pos}</div>
                <div className="text-xs font-black" style={{ color: score === 0 ? colors.textPrimary : isGood ? colors.adpPositive : colors.adpNegative }}>{score > 0 ? "+" : ""}{score}</div>
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
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
          <div className="mb-2 rounded-xl border p-2" style={{ borderColor: rosterBuildInsight.tone === "warning" ? `${colors.gold}88` : `${colors.headingGreen}66`, background: rosterBuildInsight.tone === "warning" ? `${colors.gold}12` : `${colors.headingGreen}10` }}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0" style={{ color: rosterBuildInsight.tone === "warning" ? colors.gold : colors.headingGreen }}>
                {rosterBuildInsight.tone === "warning" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: rosterBuildInsight.tone === "warning" ? colors.gold : colors.headingGreen }}>{rosterBuildInsight.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug" style={{ color: colors.textSecondary }}>{rosterBuildInsight.text}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold" style={{ color: colors.textSecondary }}>
              <div>
                <div className="mb-1 flex justify-between"><span>Starters</span><span>{starterProgress}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: colors.lightBorder }}><div className="h-full rounded-full" style={{ width: `${starterProgress}%`, background: colors.headingGreen }} /></div>
              </div>
              <div>
                <div className="mb-1 flex justify-between"><span>Roster</span><span>{rosterProgress}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: colors.lightBorder }}><div className="h-full rounded-full" style={{ width: `${rosterProgress}%`, background: colors.fantasyProsBlue }} /></div>
              </div>
            </div>
          </div>
          <div className="mb-2 grid grid-cols-4 gap-1">
            {["QB", "RB", "WR", "TE"].map((pos) => (
              <div key={pos} className="rounded-lg border px-1.5 py-1 text-center shadow-sm" style={{ borderColor: colors.lightBorder, background: `linear-gradient(180deg, ${colors.darkBlue}, ${colors.tableRow})` }}>
                <div className="text-[10px] font-black" style={{ color: colors.textSecondary }}>{pos}</div>
                <div className="text-sm font-black" style={{ color: getBubbleColorsForSlot(pos, colors).bg }}>{rosterCounts[pos] || 0}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {rosterSlotGroups.map((group) => {
              const groupColors = getBubbleColorsForSlot(group.slotType, colors)

              return (
                <section key={`${group.slotType}-${group.slots[0]?.index}`} className="overflow-hidden rounded-xl border" style={{ borderColor: `${groupColors.bg}66`, background: `${groupColors.bg}10` }}>
                  <div className="flex items-center justify-between border-b px-2.5 py-1.5" style={{ borderColor: `${groupColors.bg}44`, background: `linear-gradient(90deg, ${groupColors.bg}24, transparent)` }}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: groupColors.bg }} />
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: groupColors.bg }}>{POSITION_LABELS[group.slotType] || group.slotType}</span>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: colors.textSecondary }}>{group.slots.filter((slot) => slot.player).length}/{group.slots.length}</span>
                  </div>
                  <div className="space-y-1 p-1.5">
                    {group.slots.map(({ player, slotType, index }) => {
                      const slotColors = getBubbleColorsForSlot(slotType, colors)
                      const isRecentPick = player && player.pick_no === mostRecentPickNo
                      const value = player?.adp && player?.pick_no ? player.pick_no - Number.parseFloat(player.adp) : null

                      return (
                        <div key={index + "-" + (player?.id || "empty")} className="group rounded-lg border px-2 py-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" style={{ background: isRecentPick ? `${colors.headingGreen}18` : `linear-gradient(180deg, ${slotColors.bg}18, ${colors.card})`, borderColor: isRecentPick ? colors.headingGreen : `${slotColors.bg}66`, boxShadow: `inset 4px 0 0 ${slotColors.bg}`, opacity: player ? 1 : 0.78 }}>
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black shadow-inner" style={{ background: `${slotColors.bg}22`, borderColor: `${slotColors.bg}66`, color: slotColors.bg }}>
                              {POSITION_LABELS[slotType] || slotType}
                            </div>
                            {player ? (
                              <>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-black leading-snug" style={{ color: colors.textPrimary }} title={player.name}>{player.name}</div>
                                  <div className="flex min-w-0 items-center gap-1.5 text-[11px]" style={{ color: colors.textSecondary }}>
                                    <span className="rounded px-1.5 py-0.5 text-[9px] font-black" style={{ background: `${getBubbleColorsForSlot(player.position, colors).bg}22`, color: getBubbleColorsForSlot(player.position, colors).bg }}>{player.position}</span>
                                    <span className="truncate">{getTeamAbbr(player.team)}{isRecentPick ? " · Latest" : ""}</span>
                                  </div>
                                </div>
                                <div className="shrink-0 whitespace-nowrap text-right text-[11px] font-black">
                                  <span style={{ color: colors.textPrimary }}>{getPickLabel(player.pick_no, draftData?.numTeams || 1)}</span>
                                  {value !== null && <span className="ml-1" style={{ color: value >= 0 ? colors.adpPositive : colors.adpNegative }}>{value > 0 ? "+" : ""}{value.toFixed(1)}</span>}
                                </div>
                              </>
                            ) : (
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold italic" style={{ color: colors.textSecondary }}>Open {POSITION_LABELS[slotType] || slotType}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
