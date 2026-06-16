"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export function useDraftData(csvData) {
  const [draftData, setDraftData] = useState(null)
  const [draftedPlayers, setDraftedPlayers] = useState([])
  const [platform, setPlatform] = useState("sleeper")
  const [sleeperUrl, setSleeperUrl] = useState("")
  const [espnLeagueId, setEspnLeagueId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isManualSyncing, setIsManualSyncing] = useState(false)
  const [error, setError] = useState("")
  const [currentPick, setCurrentPick] = useState(1)
  const [selectedTeamRosterId, setSelectedTeamRosterId] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(0)

  const intervalRef = useRef(null)

  const normalizeName = (name) => {
    if (!name) return ""
    return name
      .toLowerCase()
      .replace(/(\s|,)+(jr\.?|sr\.?|ii|iii|iv|v)\b/g, "")
      .replace(/[^a-z]/g, "")
      .trim()
  }

  const extractSleeperDraftId = (url) => {
    const match = url.match(/\/draft\/nfl\/(\d+)/)
    return match ? match[1] : null
  }

  const fetchSleeperData = useCallback(
    async (isManual = false) => {
      if (!sleeperUrl || !csvData.length) return

      if (isManual) setIsManualSyncing(true)
      else setIsLoading(true)
      setError("")

      try {
        const draftId = extractSleeperDraftId(sleeperUrl)
        if (!draftId) throw new Error("Invalid Sleeper URL format.")

        const [draftRes, picksRes] = await Promise.all([
          fetch(`https://api.sleeper.com/v1/draft/${draftId}`),
          fetch(`https://api.sleeper.com/v1/draft/${draftId}/picks`),
        ])

        if (!draftRes.ok || !picksRes.ok) throw new Error("Could not fetch Sleeper draft details.")

        const draft = await draftRes.json()
        const picks = await picksRes.json()
        const leagueId = draft.league_id

        let users = []
        let rosters = []
        if (leagueId) {
          const [usersRes, rostersRes] = await Promise.all([
            fetch(`https://api.sleeper.com/v1/league/${leagueId}/users`),
            fetch(`https://api.sleeper.com/v1/league/${leagueId}/rosters`),
          ])
          if (usersRes.ok && rostersRes.ok) {
            users = await usersRes.json()
            rosters = await rostersRes.json()
          }
        }

        const teams = Object.keys(draft.slot_to_roster_id)
          .sort((a, b) => Number.parseInt(a) - Number.parseInt(b))
          .map((slot) => {
            const rosterId = draft.slot_to_roster_id[slot]
            const roster = rosters.find((r) => String(r.roster_id) === String(rosterId))
            const user = roster ? users.find((u) => u.user_id === roster.owner_id) : null
            return {
              roster_id: rosterId,
              team_name: user?.metadata?.team_name || user?.display_name || `Team ${slot}`,
              owner: { display_name: user?.display_name || `Owner ${slot}`, avatar: user?.avatar || null },
            }
          })

        const updatedDrafted = picks
          .map((pick) => {
            const rosterIdFromSlot = draft.slot_to_roster_id[pick.draft_slot]
            const pickNormName = normalizeName(`${pick.metadata.first_name} ${pick.metadata.last_name}`)
            const player = csvData.find((p) => normalizeName(`${p.firstName} ${p.lastName}`) === pickNormName)

            return {
              ...(player || {
                id: pick.player_id,
                name: `${pick.metadata.first_name} ${pick.metadata.last_name}`,
                firstName: pick.metadata.first_name,
                lastName: pick.metadata.last_name,
                position: pick.metadata.position,
                team: pick.metadata.team,
                adp: 999,
              }),
              pick_no: pick.pick_no,
              roster_id: rosterIdFromSlot,
              drafted: true,
            }
          })
          .filter(Boolean)

        setDraftedPlayers(updatedDrafted)
        setCurrentPick(picks.length + 1)
        setDraftData({
          teams: teams,
          numTeams: draft.settings.teams,
          rounds: draft.settings.rounds,
          slotSettings: draft.settings,
          pickedNamesSet: new Set(updatedDrafted.map((p) => normalizeName(`${p.firstName} ${p.lastName}`))),
        })
        setError("")
        setLastUpdate(Date.now())
        setSelectedTeamRosterId((previousRosterId) =>
          teams.some((team) => String(team.roster_id) === String(previousRosterId))
            ? previousRosterId
            : teams[0]?.roster_id || null,
        )
      } catch (err) {
        setError(`Sleeper Error: ${err.message}`)
      } finally {
        if (isManual) setIsManualSyncing(false)
        else setIsLoading(false)
      }
    },
    [sleeperUrl, csvData],
  )

  const fetchEspnData = useCallback(
    async (isManual = false) => {
      if (!espnLeagueId || !csvData.length) return

      if (isManual) setIsManualSyncing(true)
      else setIsLoading(true)
      setError("")

      try {
        const year = new Date().getFullYear()
        const res = await fetch(
          `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${espnLeagueId}?view=mDraftDetail&view=mSettings&view=mTeam`,
        )
        if (!res.ok) {
          throw new Error(
            `Could not fetch ESPN data. This may be a private league or an invalid ID. Only public leagues are currently supported.`,
          )
        }
        const data = await res.json()

        const positionMap = { 1: "QB", 2: "RB", 3: "WR", 4: "TE" }

        const updatedDrafted = data.draftDetail.picks.map((pick) => {
          const playerDetails = pick.playerPoolEntry.player
          const normName = normalizeName(playerDetails.fullName)
          const player = csvData.find((p) => normalizeName(p.name) === normName)

          return {
            ...(player || {
              id: playerDetails.id,
              name: playerDetails.fullName,
              firstName: playerDetails.firstName,
              lastName: playerDetails.lastName,
              team: "N/A",
              adp: 999,
            }),
            position: positionMap[playerDetails.defaultPositionId] || "N/A",
            pick_no: pick.overallPickNumber,
            roster_id: pick.teamId,
            drafted: true,
          }
        })

        const teams = data.teams.map((team) => ({
          roster_id: team.id,
          team_name: `${team.location} ${team.nickname}`.trim(),
          owner: { display_name: `Owner ${team.id}`, avatar: null },
        }))

        setDraftedPlayers(updatedDrafted)
        setCurrentPick(data.draftDetail.picks.length + 1)
        setDraftData({
          teams: teams,
          numTeams: data.settings.size,
          rounds: data.settings.draftSettings.numberOfRounds,
          slotSettings: data.settings,
          pickedNamesSet: new Set(updatedDrafted.map((p) => normalizeName(p.name))),
        })
        setError("")
        setLastUpdate(Date.now())
        setSelectedTeamRosterId((previousRosterId) =>
          teams.some((team) => String(team.roster_id) === String(previousRosterId))
            ? previousRosterId
            : teams[0]?.roster_id || null,
        )
      } catch (err) {
        setError(`ESPN Error: ${err.message}`)
      } finally {
        if (isManual) setIsManualSyncing(false)
        else setIsLoading(false)
      }
    },
    [espnLeagueId, csvData],
  )

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setDraftData(null)
    setDraftedPlayers([])
    setCurrentPick(1)
    setSelectedTeamRosterId(null)
    setLastUpdate(null)
    setTimeSinceUpdate(0)
    setError("")
  }, [platform, sleeperUrl, espnLeagueId])

  const handleSync = useCallback(
    (isManual = false) => {
      if (platform === "sleeper") {
        fetchSleeperData(isManual)
      } else {
        fetchEspnData(isManual)
      }
    },
    [platform, fetchSleeperData, fetchEspnData],
  )

  useEffect(() => {
    const isReady = (platform === "sleeper" && sleeperUrl) || (platform === "espn" && espnLeagueId)
    if (isReady && csvData.length > 0) {
      handleSync()
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => handleSync(), 850)
      return () => clearInterval(intervalRef.current)
    }
  }, [platform, sleeperUrl, espnLeagueId, csvData.length, handleSync])

  useEffect(() => {
    if (!lastUpdate) return
    const timer = setInterval(() => {
      setTimeSinceUpdate(Math.round((Date.now() - lastUpdate) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [lastUpdate])

  const isSyncDisabled =
    isManualSyncing ||
    !csvData.length ||
    (platform === "sleeper" && !sleeperUrl) ||
    (platform === "espn" && !espnLeagueId)

  return {
    draftData,
    draftedPlayers,
    platform,
    setPlatform,
    sleeperUrl,
    setSleeperUrl,
    espnLeagueId,
    setEspnLeagueId,
    isLoading,
    isManualSyncing,
    error,
    currentPick,
    selectedTeamRosterId,
    setSelectedTeamRosterId,
    lastUpdate,
    timeSinceUpdate,
    handleSync,
    isSyncDisabled,
  }
}
