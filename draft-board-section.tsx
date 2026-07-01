"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BubbleSymbol } from "./bubble-symbol"

const getSleeperAvatarUrl = (avatar) => {
  if (!avatar) return null
  const value = String(avatar)
  if (value.startsWith("http")) return value
  return `https://sleepercdn.com/avatars/${value}`
}

const getTeamInitials = (name) =>
  String(name || "T")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "T"

const getDraftSlotForPick = (pickNo, numTeams) => {
  const round = Math.floor((pickNo - 1) / numTeams) + 1
  const pickInRound = ((pickNo - 1) % numTeams) + 1
  const isSnakeBackHalf = round % 2 === 0
  return isSnakeBackHalf ? numTeams - pickInRound + 1 : pickInRound
}

const POSITION_ORDER = ["QB", "RB", "WR", "TE"]

const STRATEGY_TYPE_LABELS = {
  auto: "Auto strategy",
  balanced: "Balanced BPA",
  "hero-rb": "Hero RB",
  "double-hero-rb": "Double Hero RB",
  "zero-rb": "Zero RB",
  "wr-heavy": "WR-Heavy",
  "robust-rb": "Robust RB",
  "elite-te": "Elite TE",
  "early-qb": "Elite/Early QB",
  "late-qb-te": "Late QB/TE",
}

const getPositionBoardColors = (pos, colors) => {
  switch (pos) {
    case "QB":
      return { border: colors.pillQB, background: `${colors.pillQB}18` }
    case "RB":
      return { border: colors.pillRB, background: `${colors.pillRB}18` }
    case "WR":
      return { border: colors.pillWR, background: `${colors.pillWR}18` }
    case "TE":
      return { border: colors.pillTE, background: `${colors.pillTE}20` }
    default:
      return { border: colors.lightBorder, background: colors.tableRow }
  }
}

const getPickValue = (player) => {
  if (!player?.pick_no) return null
  const adp = Number.parseFloat(player.adp)
  if (Number.isNaN(adp)) return null
  return Number((Number(player.pick_no) - adp).toFixed(1))
}

const MEANINGFUL_PICK_VALUE_DIFF = 20

const getValueLabel = (value) => {
  if (value === null || Math.abs(value) < MEANINGFUL_PICK_VALUE_DIFF) return null
  if (value > 0) return "💎 Value"
  return "🫏 Reach"
}

export function DraftBoardSection({ colors, draftData, draftedPlayers = [], currentPick = 1, selectedTeamRosterId, setSelectedTeamRosterId, visibleRoundCount = null, isMaximized = false, onToggleMaximized, maximizedTopContent = null, selectedStrategyOverride = "auto" }) {
  const teams = draftData?.teams || []
  const [openRosterPositions, setOpenRosterPositions] = useState({ QB: true, RB: true, WR: true, TE: true })
  const numTeams = draftData?.numTeams || teams.length || 0
  const rounds = draftData?.rounds || 0
  const totalPicks = numTeams && rounds ? numTeams * rounds : 0
  const picksByNumber = new Map((draftedPlayers || []).map((player) => [Number(player.pick_no), player]))
  const latestPickNo = draftedPlayers.length ? Math.max(...draftedPlayers.map((player) => Number(player.pick_no) || 0)) : null
  const latestPickRef = useRef(null)
  const currentSlot = numTeams ? getDraftSlotForPick(currentPick, numTeams) : null
  const currentTeam = currentSlot ? teams[currentSlot - 1] : null
  const isSelectedOnClock = currentTeam && String(currentTeam.roster_id) === String(selectedTeamRosterId)
  const picksUntilSelected = useMemo(() => {
    if (!numTeams || !rounds || !selectedTeamRosterId || currentPick > totalPicks) return null
    for (let pick = currentPick; pick <= totalPicks; pick += 1) {
      const slot = getDraftSlotForPick(pick, numTeams)
      const team = teams[slot - 1]
      if (team && String(team.roster_id) === String(selectedTeamRosterId)) return pick - currentPick
    }
    return null
  }, [currentPick, numTeams, rounds, selectedTeamRosterId, teams, totalPicks])
  const rosterSummaries = useMemo(() => {
    const summaries = new Map()
    teams.forEach((team) => {
      summaries.set(String(team.roster_id), { QB: 0, RB: 0, WR: 0, TE: 0, picks: 0, value: 0 })
    })
    ;(draftedPlayers || []).forEach((player) => {
      const key = String(player.roster_id)
      const summary = summaries.get(key) || { QB: 0, RB: 0, WR: 0, TE: 0, picks: 0, value: 0 }
      if (POSITION_ORDER.includes(player.position)) summary[player.position] += 1
      summary.picks += 1
      const value = getPickValue(player)
      if (value !== null) summary.value += value
      summaries.set(key, summary)
    })
    summaries.forEach((summary) => {
      summary.value = Number(summary.value.toFixed(1))
    })
    return summaries
  }, [draftedPlayers, teams])

  const strategyTypeLabel = STRATEGY_TYPE_LABELS[selectedStrategyOverride] || STRATEGY_TYPE_LABELS.auto

  const selectedDraftValue = useMemo(() => {
    const selectedPlayers = (draftedPlayers || []).filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
    const value = selectedPlayers.reduce((sum, player) => {
      const adp = Number.parseFloat(player.adp)
      return Number.isNaN(adp) || !player.pick_no ? sum : sum + (Number(player.pick_no) - adp)
    }, 0)
    return Number(value.toFixed(1))
  }, [draftedPlayers, selectedTeamRosterId])

  useEffect(() => {
    if (!latestPickRef.current) return
    latestPickRef.current.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" })
  }, [latestPickNo])

  const currentRound = numTeams ? Math.floor((Number(currentPick || 1) - 1) / numTeams) + 1 : 1
  const latestPlayer = latestPickNo ? picksByNumber.get(latestPickNo) : null
  const selectedSummary = selectedTeamRosterId ? rosterSummaries.get(String(selectedTeamRosterId)) : null
  const selectedRosterPlayers = useMemo(
    () => (draftedPlayers || [])
      .filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
      .sort((a, b) => Number(a.pick_no || 0) - Number(b.pick_no || 0)),
    [draftedPlayers, selectedTeamRosterId],
  )
  const selectedRosterByPosition = useMemo(() => {
    const groups = POSITION_ORDER.reduce((acc, position) => ({ ...acc, [position]: [] }), {})
    selectedRosterPlayers.forEach((player) => {
      if (groups[player.position]) groups[player.position].push(player)
    })
    return groups
  }, [selectedRosterPlayers])
  const toggleRosterPosition = (position) => setOpenRosterPositions((current) => ({ ...current, [position]: !current[position] }))
  const shouldLimitRounds = Number.isFinite(Number(visibleRoundCount)) && Number(visibleRoundCount) > 0 && Number(visibleRoundCount) < rounds
  const firstVisibleRound = shouldLimitRounds ? Math.max(1, Math.min(currentRound - 2, Math.max(1, rounds - Number(visibleRoundCount) + 1))) : 1
  const visibleRounds = shouldLimitRounds
    ? Array.from({ length: Math.min(Number(visibleRoundCount), rounds) }, (_, index) => firstVisibleRound + index).filter((round) => round >= 1 && round <= rounds)
    : Array.from({ length: rounds }, (_, index) => index + 1)
  const lastVisibleRound = visibleRounds[visibleRounds.length - 1] || firstVisibleRound
  if (!numTeams || !rounds) {
    return (
      <Card style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold tracking-wide" style={{ color: colors.gold }}>LIVE DRAFT BOARD</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-0">
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
            Connect a Sleeper draft to visualize every pick by round and team.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`flex h-full min-h-0 flex-col ${isMaximized ? "fixed inset-3 z-50 shadow-2xl sm:inset-4" : ""}`} style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="px-3 pb-2 pt-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold tracking-wide" style={{ color: colors.gold }}>
          <span>LIVE DRAFT BOARD</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Showing {shouldLimitRounds ? `rounds ${firstVisibleRound}-${lastVisibleRound}` : `all ${rounds} rounds`} • Pick {Math.min(currentPick, totalPicks || currentPick)} of {totalPicks} • Selected value {selectedDraftValue > 0 ? "+" : ""}{selectedDraftValue}
            </span>
            {isMaximized && (
              <span className="rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide" style={{ borderColor: colors.gold, background: `${colors.gold}18`, color: colors.gold }}>
                Strategy: {strategyTypeLabel}
              </span>
            )}
            {onToggleMaximized && (
              <button
                type="button"
                onClick={onToggleMaximized}
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wide transition hover:opacity-85 focus:outline-none focus:ring-2"
                style={{ borderColor: colors.lightBorder, background: colors.tableRow, color: colors.textPrimary }}
                aria-label={isMaximized ? "Minimize draft board" : "Maximize draft board"}
                title={isMaximized ? "Minimize draft board" : "Maximize draft board"}
              >
                {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isMaximized ? "Minimize" : "Maximize"}
              </button>
            )}
          </div>
        </CardTitle>
        <div className="mt-2 grid gap-2 text-xs font-bold sm:grid-cols-3">
          <div className="rounded-xl border px-3 py-2" style={{ borderColor: isSelectedOnClock ? colors.headingGreen : colors.lightBorder, background: isSelectedOnClock ? `${colors.headingGreen}22` : colors.tableRow, color: isSelectedOnClock ? colors.headingGreen : colors.textSecondary }}>
            <div className="text-[9px] uppercase tracking-wide">Selected clock</div>
            <div className="mt-0.5">
              {selectedTeamRosterId
                ? isSelectedOnClock
                  ? "🚨 You are on the clock"
                  : picksUntilSelected === null
                    ? "Draft complete"
                    : `${picksUntilSelected} pick${picksUntilSelected === 1 ? "" : "s"} away`
                : "Select a team"}
            </div>
          </div>
          <div className="rounded-xl border px-3 py-2" style={{ borderColor: colors.lightBorder, background: colors.tableRow, color: colors.textSecondary }}>
            <div className="text-[9px] uppercase tracking-wide">On clock now</div>
            <div className="mt-0.5 truncate" style={{ color: colors.textPrimary }}>{currentTeam?.team_name || "Waiting for draft"}</div>
          </div>
          <div className="rounded-xl border px-3 py-2" style={{ borderColor: colors.lightBorder, background: colors.tableRow, color: colors.textSecondary }}>
            <div className="text-[9px] uppercase tracking-wide">Latest pick</div>
            <div className="mt-0.5 truncate" style={{ color: colors.textPrimary }}>{latestPlayer ? `${latestPickNo}. ${latestPlayer.name}` : "No picks yet"}</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold" style={{ color: colors.textSecondary }}>
          {POSITION_ORDER.map((pos) => {
            const positionColors = getPositionBoardColors(pos, colors)
            return (
              <span key={pos} className="rounded-full border px-2 py-0.5" style={{ borderColor: positionColors.border, background: positionColors.background, color: positionColors.border }}>
                {pos}
              </span>
            )
          })}
          <span>Green outline = current pick</span>
          <span>Purple wash = selected team</span>
          {selectedSummary && (
            <span className="ml-auto">Selected roster: {POSITION_ORDER.map((pos) => `${pos} ${selectedSummary[pos] || 0}`).join(" · ")}</span>
          )}
        </div>
        {selectedTeamRosterId && (
          <div className={`mt-2 rounded-xl border p-2 ${isMaximized ? "space-y-1" : ""}`} style={{ borderColor: colors.lightBorder, background: colors.tableRow }}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] font-black uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              <span>Compact selected roster</span>
              <span>{selectedRosterPlayers.length} drafted</span>
            </div>
            <div className={isMaximized ? "space-y-1" : "grid gap-1 sm:grid-cols-2 xl:grid-cols-4"}>
              {POSITION_ORDER.map((pos) => {
                const positionColors = getPositionBoardColors(pos, colors)
                const players = selectedRosterByPosition[pos] || []
                const isOpen = !!openRosterPositions[pos]
                return (
                  <section key={pos} className="overflow-hidden rounded-lg border" style={{ borderColor: `${positionColors.border}66`, background: colors.card }}>
                    <button
                      type="button"
                      onClick={() => toggleRosterPosition(pos)}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-wide"
                      style={{ background: positionColors.background, color: positionColors.border }}
                      aria-expanded={isOpen}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {pos}
                      </span>
                      <span>{players.length}</span>
                    </button>
                    {isOpen && (
                      <div className={isMaximized ? "grid gap-1 p-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-1 p-1.5"}>
                        {players.length ? players.map((player) => (
                          <div key={`${player.pick_no}-${player.name}`} className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1 text-[10px]" style={{ background: colors.tableRow, color: colors.textSecondary }}>
                            <span className="min-w-0 truncate font-black" style={{ color: colors.textPrimary }} title={player.name}>{player.name}</span>
                            <span className="shrink-0 font-bold">#{player.pick_no}</span>
                          </div>
                        )) : (
                          <div className="rounded-md border border-dashed px-2 py-1 text-[10px] font-semibold" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>No {pos} drafted</div>
                        )}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        )}

      </CardHeader>
      {isMaximized && maximizedTopContent && (
        <div className="px-2 pb-2">
          {maximizedTopContent}
        </div>
      )}
      <CardContent className="min-h-0 flex-1 px-2 pt-0 pb-2">
        <div className="h-full min-h-0 overflow-auto rounded-xl border" style={{ borderColor: colors.lightBorder }}>
          <div className="min-w-[920px]">
            <div
              className="grid"
              style={{ gridTemplateColumns: `3rem repeat(${numTeams}, minmax(8.25rem, 1fr))`, backgroundColor: colors.darkBlue }}
            >
              <div className="border-r px-2 py-2 text-[10px] font-black uppercase" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                Rd
              </div>
              {teams.map((team, index) => {
                const avatarUrl = getSleeperAvatarUrl(team.avatar || team.owner?.avatar)
                const isSelected = String(team.roster_id) === String(selectedTeamRosterId)
                return (
                  <button
                    key={team.roster_id || index}
                    onClick={() => setSelectedTeamRosterId?.(team.roster_id)}
                    className="min-w-0 border-r px-2 py-2 text-left transition hover:opacity-90"
                    style={{ borderColor: colors.lightBorder, backgroundColor: isSelected ? `${colors.headingGreen}22` : "transparent" }}
                    title={team.team_name}
                  >
                    <div className="flex items-center gap-2">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: colors.purple, color: colors.white }}>
                          {getTeamInitials(team.team_name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-black" style={{ color: colors.textPrimary }}>{team.team_name}</div>
                        <div className="truncate text-[9px]" style={{ color: colors.textSecondary }}>@{team.owner?.username || team.owner?.display_name}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {visibleRounds.map((round) => {
              return (
                <div
                  key={round}
                  className="grid border-t"
                  style={{ gridTemplateColumns: `3rem repeat(${numTeams}, minmax(8.25rem, 1fr))`, borderColor: colors.lightBorder }}
                >
                  <div className="flex items-center justify-center border-r text-xs font-black" style={{ borderColor: colors.lightBorder, color: colors.gold }}>
                    {round}
                  </div>
                  {teams.map((team, teamIndex) => {
                    const draftSlot = teamIndex + 1
                    const pickNo = (round - 1) * numTeams + (round % 2 === 0 ? numTeams - teamIndex : teamIndex + 1)
                    const player = picksByNumber.get(pickNo)
                    const isCurrentPick = pickNo === Number(currentPick)
                    const isSelectedTeam = String(team.roster_id) === String(selectedTeamRosterId)
                    const positionColors = getPositionBoardColors(player?.position, colors)
                    const baseBackground = player ? positionColors.background : colors.tableRow
                    const pickValue = getPickValue(player)
                    const pickValueLabel = getValueLabel(pickValue)
                    return (
                      <button
                        key={`${round}-${draftSlot}`}
                        ref={pickNo === latestPickNo ? latestPickRef : null}
                        onClick={() => setSelectedTeamRosterId?.(team.roster_id)}
                        className="min-h-[4.6rem] border-r p-2 text-left transition hover:opacity-90"
                        style={{
                          borderColor: player ? positionColors.border : colors.lightBorder,
                          background: isCurrentPick ? `${colors.headingGreen}26` : isSelectedTeam ? `linear-gradient(180deg, ${colors.purple}16, ${baseBackground})` : baseBackground,
                          boxShadow: isCurrentPick ? `inset 0 0 0 2px ${colors.headingGreen}` : player ? `inset 0 0 0 1px ${positionColors.border}55` : "none",
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold" style={{ color: isCurrentPick ? colors.headingGreen : colors.textSecondary }}>
                          <span>{round}.{String(getDraftSlotForPick(pickNo, numTeams)).padStart(2, "0")}</span>
                          <span>{isCurrentPick ? "ON CLOCK" : `#${pickNo}`}</span>
                        </div>
                        {player ? (
                          <div className="space-y-1">
                            <div className="truncate text-xs font-black" style={{ color: colors.textPrimary }} title={player.name}>{player.name}</div>
                            <div className="flex items-center justify-between gap-2">
                              <BubbleSymbol pos={player.position} colors={colors} />
                              <span className="truncate text-[10px]" style={{ color: colors.textSecondary }}>{player.team}</span>
                            </div>
                            {pickValueLabel && (
                              <div className="flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 text-[9px] font-black" style={{ background: colors.card, color: pickValue >= 0 ? colors.adpPositive : colors.adpNegative }}>
                                <span>{pickValueLabel}</span>
                                <span>{pickValue > 0 ? "+" : ""}{pickValue}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-9 items-center justify-center rounded border border-dashed text-[10px] font-semibold" style={{ borderColor: colors.cardBorder, color: isCurrentPick ? colors.headingGreen : colors.textSecondary }}>
                            {isCurrentPick ? "On clock" : "Upcoming"}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
