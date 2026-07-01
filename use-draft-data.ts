"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export function useDraftData(csvData) {
  const [draftData, setDraftData] = useState(null)
  const [draftedPlayers, setDraftedPlayers] = useState([])
  const [platform, setPlatform] = useState("sleeper")
  const [sleeperUrls, setSleeperUrls] = useState([])
  const [activeSleeperUrlIndex, setActiveSleeperUrlIndex] = useState(0)
  const [autoSwitchSleeperDrafts, setAutoSwitchSleeperDrafts] = useState(true)
  const sleeperUrl = sleeperUrls[activeSleeperUrlIndex] || ""
  const [espnLeagueId, setEspnLeagueId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isManualSyncing, setIsManualSyncing] = useState(false)
  const [error, setError] = useState("")
  const [currentPick, setCurrentPick] = useState(1)
  const [selectedTeamRosterId, setSelectedTeamRosterIdState] = useState(null)
  const [selectedSleeperUserId, setSelectedSleeperUserId] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(0)

  const intervalRef = useRef(null)
  const syncInFlightRef = useRef(false)
  const sleeperDraftCacheRef = useRef({})

  const getSleeperUserIdForRosterId = useCallback((teams, rosterId) => {
    const team = (teams || []).find((candidate) => String(candidate.roster_id) === String(rosterId))
    return team?.user_id || team?.owner?.user_id || null
  }, [])

  const setSelectedTeamRosterId = useCallback((rosterId, teamsOverride = null) => {
    setSelectedTeamRosterIdState(rosterId)
    const teams = teamsOverride || draftData?.teams || []
    const userId = getSleeperUserIdForRosterId(teams, rosterId)
    if (userId) setSelectedSleeperUserId(userId)
  }, [draftData?.teams, getSleeperUserIdForRosterId])

  const normalizeName = (name) => {
    if (!name) return ""

    const canonicalName = String(name)
      // Sleeper now returns Kenny Gainwell while several analyst boards still
      // carry Kenneth Gainwell. Treat them as the same player for draft matching.
      .replace(/\bKenny\s+Gainwell\b/i, "Kenneth Gainwell")

    return canonicalName
      .toLowerCase()
      .replace(/(\s|,)+(jr\.?|sr\.?|ii|iii|iv|v)\b/g, "")
      .replace(/[^a-z]/g, "")
      .trim()
  }

  const extractSleeperDraftId = (url) => {
    const value = String(url || "").trim()
    const match = value.match(/\/draft\/nfl\/(\d+)/) || value.match(/sleeper\.com\/draft\/(\d+)/) || value.match(/^(\d+)$/)
    return match ? match[1] : null
  }

  const setSleeperUrl = useCallback((value) => {
    const urls = String(value || "")
      .split(/[\n,]+/)
      .map((url) => url.trim())
      .filter(Boolean)
    setSleeperUrls(urls)
    setActiveSleeperUrlIndex((index) => Math.min(index, Math.max(urls.length - 1, 0)))
  }, [])

  const getDraftSlotForPick = (pickNo, numTeams) => {
    const round = Math.floor((pickNo - 1) / numTeams) + 1
    const pickInRound = ((pickNo - 1) % numTeams) + 1
    return round % 2 === 0 ? numTeams - pickInRound + 1 : pickInRound
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

        const cachedDraft = sleeperDraftCacheRef.current[draftId] || { draft: null, users: [], rosters: [] }
        const shouldRefreshDraftMeta = isManual || !cachedDraft.draft
        let draft = cachedDraft.draft
        let users = cachedDraft.users
        let rosters = cachedDraft.rosters

        const picksPromise = fetch(`https://api.sleeper.com/v1/draft/${draftId}/picks`)

        if (shouldRefreshDraftMeta) {
          const draftRes = await fetch(`https://api.sleeper.com/v1/draft/${draftId}`)
          if (!draftRes.ok) throw new Error("Could not fetch Sleeper draft details.")
          draft = await draftRes.json()

          users = []
          rosters = []
          if (draft.league_id) {
            const [usersRes, rostersRes] = await Promise.all([
              fetch(`https://api.sleeper.com/v1/league/${draft.league_id}/users`),
              fetch(`https://api.sleeper.com/v1/league/${draft.league_id}/rosters`),
            ])
            if (usersRes.ok && rostersRes.ok) {
              users = await usersRes.json()
              rosters = await rostersRes.json()
            }
          }

          sleeperDraftCacheRef.current[draftId] = { draft, users, rosters }
        }

        const picksRes = await picksPromise
        if (!picksRes.ok || !draft) throw new Error("Could not fetch Sleeper draft picks.")
        const picks = await picksRes.json()

        const teams = Object.keys(draft.slot_to_roster_id)
          .sort((a, b) => Number.parseInt(a) - Number.parseInt(b))
          .map((slot) => {
            const rosterId = draft.slot_to_roster_id[slot]
            const roster = rosters.find((r) => String(r.roster_id) === String(rosterId))
            const user = roster ? users.find((u) => u.user_id === roster.owner_id) : null
            const draftOrderUserId = Object.entries(draft.draft_order || {}).find(([, draftSlot]) => String(draftSlot) === String(slot))?.[0]
            const userId = roster?.owner_id || user?.user_id || draftOrderUserId || null
            const username = user?.username || user?.display_name || (userId ? `Sleeper ${String(userId).slice(0, 6)}` : `Owner ${slot}`)
            return {
              roster_id: rosterId,
              user_id: userId,
              draft_slot: Number(slot),
              team_name: roster?.metadata?.team_name || user?.metadata?.team_name || user?.display_name || username || `Team ${slot}`,
              avatar: roster?.metadata?.avatar || user?.metadata?.avatar || user?.avatar || null,
              owner: { user_id: userId, username, display_name: user?.display_name || username, avatar: user?.avatar || user?.metadata?.avatar || null },
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
        const currentSlot = getDraftSlotForPick(picks.length + 1, draft.settings.teams)
        const currentTeamRosterId = draft.slot_to_roster_id[currentSlot]

        setDraftData({
          teams: teams,
          draftId,
          draftUrl: sleeperUrl,
          activeSleeperUrlIndex,
          currentTeamRosterId,
          currentTeamUserId: teams.find((team) => String(team.roster_id) === String(currentTeamRosterId))?.user_id || null,
          numTeams: draft.settings.teams,
          rounds: draft.settings.rounds,
          draftType: draft.type,
          slotSettings: draft.settings,
          scoringFormat: draft.metadata?.scoring_type || draft.settings?.scoring_type || null,
          pickedNamesSet: new Set(updatedDrafted.map((p) => normalizeName(`${p.firstName} ${p.lastName}`))),
        })
        setError("")
        setLastUpdate(Date.now())
        setSelectedTeamRosterIdState((previousRosterId) => {
          const selectedUserTeam = selectedSleeperUserId
            ? teams.find((team) => String(team.user_id || team.owner?.user_id) === String(selectedSleeperUserId))
            : null
          const nextRosterId = selectedUserTeam?.roster_id || (teams.some((team) => String(team.roster_id) === String(previousRosterId)) ? previousRosterId : teams[0]?.roster_id || null)
          const nextUserId = getSleeperUserIdForRosterId(teams, nextRosterId)
          if (nextUserId) setSelectedSleeperUserId(nextUserId)
          return nextRosterId
        })
      } catch (err) {
        setError(`Sleeper Error: ${err.message}`)
      } finally {
        if (isManual) setIsManualSyncing(false)
        else setIsLoading(false)
      }
    },
    [sleeperUrl, csvData, activeSleeperUrlIndex, selectedSleeperUserId, getSleeperUserIdForRosterId],
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
          draftType: data.settings.draftSettings.type || null,
          slotSettings: data.settings,
          pickedNamesSet: new Set(updatedDrafted.map((p) => normalizeName(p.name))),
        })
        setError("")
        setLastUpdate(Date.now())
        setSelectedTeamRosterIdState((previousRosterId) =>
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
    setSelectedTeamRosterIdState(null)
    setSelectedSleeperUserId(null)
    setLastUpdate(null)
    setTimeSinceUpdate(0)
    sleeperDraftCacheRef.current = {}
    setError("")
  }, [platform, sleeperUrls.join("|"), espnLeagueId])

  const handleSync = useCallback(
    async (isManual = false) => {
      if (syncInFlightRef.current && !isManual) return
      syncInFlightRef.current = true
      try {
        if (platform === "sleeper") {
          await fetchSleeperData(isManual)
        } else {
          await fetchEspnData(isManual)
        }
      } finally {
        syncInFlightRef.current = false
      }
    },
    [platform, fetchSleeperData, fetchEspnData],
  )

  useEffect(() => {
    const isReady = (platform === "sleeper" && sleeperUrls.length > 0) || (platform === "espn" && espnLeagueId)
    if (isReady && csvData.length > 0) {
      handleSync()
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => handleSync(), 600)
      return () => clearInterval(intervalRef.current)
    }
  }, [platform, sleeperUrls.join("|"), activeSleeperUrlIndex, espnLeagueId, csvData.length, handleSync])

  useEffect(() => {
    if (platform !== "sleeper" || !autoSwitchSleeperDrafts || sleeperUrls.length < 2 || !selectedTeamRosterId || !draftData) return
    const activeTeam = (draftData.teams || []).find((team) => String(team.roster_id) === String(selectedTeamRosterId))
    const selectedUserId = selectedSleeperUserId || activeTeam?.user_id || activeTeam?.owner?.user_id
    if (!selectedUserId) return
    if (String(draftData.currentTeamUserId || draftData.teams?.find((team) => String(team.roster_id) === String(draftData.currentTeamRosterId))?.user_id) === String(selectedUserId)) return

    let cancelled = false

    const findDraftOnClock = async () => {
      for (let index = 0; index < sleeperUrls.length; index += 1) {
        if (index === activeSleeperUrlIndex) continue
        const draftId = extractSleeperDraftId(sleeperUrls[index])
        if (!draftId) continue

        try {
          let draft = sleeperDraftCacheRef.current[draftId]?.draft
          if (!draft) {
            const draftRes = await fetch(`https://api.sleeper.com/v1/draft/${draftId}`)
            if (!draftRes.ok) continue
            draft = await draftRes.json()
            sleeperDraftCacheRef.current[draftId] = { ...(sleeperDraftCacheRef.current[draftId] || {}), draft }
          }

          const cachedForDraft = sleeperDraftCacheRef.current[draftId] || {}
          if (draft.league_id && (!cachedForDraft.rosters || !cachedForDraft.users)) {
            const [usersRes, rostersRes] = await Promise.all([
              fetch(`https://api.sleeper.com/v1/league/${draft.league_id}/users`),
              fetch(`https://api.sleeper.com/v1/league/${draft.league_id}/rosters`),
            ])
            sleeperDraftCacheRef.current[draftId] = {
              ...cachedForDraft,
              draft,
              users: usersRes.ok ? await usersRes.json() : cachedForDraft.users || [],
              rosters: rostersRes.ok ? await rostersRes.json() : cachedForDraft.rosters || [],
            }
          }

          const picksRes = await fetch(`https://api.sleeper.com/v1/draft/${draftId}/picks`)
          if (!picksRes.ok) continue
          const picks = await picksRes.json()
          const currentSlot = getDraftSlotForPick(picks.length + 1, draft.settings.teams)
          const currentTeamRosterId = draft.slot_to_roster_id[currentSlot]
          const cached = sleeperDraftCacheRef.current[draftId] || {}
          const rostersForDraft = cached.rosters || []
          const roster = rostersForDraft.find((candidate) => String(candidate.roster_id) === String(currentTeamRosterId))
          const currentTeamUserId = roster?.owner_id || Object.entries(draft.draft_order || {}).find(([, draftSlot]) => String(draftSlot) === String(currentSlot))?.[0]

          if (!cancelled && String(currentTeamUserId) === String(selectedUserId)) {
            setActiveSleeperUrlIndex(index)
            return
          }
        } catch (err) {
          // Ignore background auto-switch checks so the active draft can keep syncing.
        }
      }
    }

    findDraftOnClock()

    return () => {
      cancelled = true
    }
  }, [
    activeSleeperUrlIndex,
    autoSwitchSleeperDrafts,
    draftData,
    platform,
    selectedTeamRosterId,
    selectedSleeperUserId,
    sleeperUrls.join("|"),
    lastUpdate,
  ])

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
    (platform === "sleeper" && !sleeperUrls.length) ||
    (platform === "espn" && !espnLeagueId)

  return {
    draftData,
    draftedPlayers,
    platform,
    setPlatform,
    sleeperUrl,
    sleeperUrls,
    setSleeperUrl,
    setSleeperUrls,
    activeSleeperUrlIndex,
    setActiveSleeperUrlIndex,
    autoSwitchSleeperDrafts,
    setAutoSwitchSleeperDrafts,
    espnLeagueId,
    setEspnLeagueId,
    isLoading,
    isManualSyncing,
    error,
    currentPick,
    selectedTeamRosterId,
    selectedSleeperUserId,
    setSelectedTeamRosterId,
    lastUpdate,
    timeSinceUpdate,
    handleSync,
    isSyncDisabled,
  }
}
