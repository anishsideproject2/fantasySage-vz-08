"use client"

import { useState, useEffect, useCallback } from "react"
import { findPresetById } from "./ranking-presets"

const POSITIONS = ["All", "Flex", "QB", "RB", "WR", "TE"]
const FLEX_POSITIONS = ["RB", "WR", "TE"]
const DEFAULT_RANKING_PRESET_ID = "del-don-full-ppr"
const CUSTOM_RANKING_LIBRARY_KEY = "fantasy-sage-custom-ranking-library"
const CUSTOM_RANKING_LIBRARY_LIMIT = 25
const CUSTOM_RANKING_LIBRARY_API = "/api/custom-rankings"

export function usePlayerData() {
  const [rankings, setRankings] = useState([
    { data: [], name: null },
    { data: [], name: null },
  ])
  const [activeRankingIndex, setActiveRankingIndex] = useState(0)
  const [isPapaParseLoaded, setIsPapaParseLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [positionFilter, setPositionFilter] = useState("All")
  const [customRankingSets, setCustomRankingSets] = useState([])

  useEffect(() => {
    let ignore = false

    const loadCustomRankingSets = async () => {
      try {
        const response = await fetch(CUSTOM_RANKING_LIBRARY_API, { cache: "no-store" })
        if (!response.ok) throw new Error(`Custom rankings request failed: ${response.status}`)
        const { sets } = await response.json()
        if (!ignore) setCustomRankingSets(Array.isArray(sets) ? sets.slice(0, CUSTOM_RANKING_LIBRARY_LIMIT) : [])
      } catch (err) {
        console.error("Custom rankings library load error:", err)
        try {
          const savedSets = window.localStorage.getItem(CUSTOM_RANKING_LIBRARY_KEY)
          if (savedSets && !ignore) setCustomRankingSets(JSON.parse(savedSets).slice(0, CUSTOM_RANKING_LIBRARY_LIMIT))
        } catch (localErr) {
          console.error("Custom rankings local fallback load error:", localErr)
        }
      }
    }

    loadCustomRankingSets()

    return () => {
      ignore = true
    }
  }, [])

  const saveCustomRankingSets = useCallback((sets) => {
    const limitedSets = sets.slice(0, CUSTOM_RANKING_LIBRARY_LIMIT)
    setCustomRankingSets(limitedSets)
    try {
      window.localStorage.setItem(CUSTOM_RANKING_LIBRARY_KEY, JSON.stringify(limitedSets))
    } catch (err) {
      console.error("Custom rankings local fallback save error:", err)
    }
  }, [])

  const addCustomRankingSet = useCallback(async (customSet) => {
    const optimisticSets = [customSet, ...customRankingSets.filter((set) => set.id !== customSet.id)].slice(
      0,
      CUSTOM_RANKING_LIBRARY_LIMIT,
    )
    saveCustomRankingSets(optimisticSets)

    try {
      const response = await fetch(CUSTOM_RANKING_LIBRARY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set: customSet }),
      })
      if (!response.ok) throw new Error(`Custom rankings save failed: ${response.status}`)
      const { sets } = await response.json()
      if (Array.isArray(sets)) saveCustomRankingSets(sets)
    } catch (err) {
      console.error("Custom rankings library save error:", err)
    }
  }, [customRankingSets, saveCustomRankingSets])

  const normalizeRankingUpdateDate = (dateValue = "") => {
    const trimmedDate = String(dateValue).trim()
    const slashDate = trimmedDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashDate) {
      const [, month, day, year] = slashDate
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }
    return trimmedDate
  }

  const normalizeAnalysts = (analystValue = "") => {
    const rawAnalysts = Array.isArray(analystValue) ? analystValue : String(analystValue).split(/,|\s+&\s+|\s+and\s+/i)

    return rawAnalysts
      .map((analyst) => String(analyst || "").trim())
      .filter(Boolean)
  }

  const buildRankingMetadata = (shareOptions = {}, defaults = {}) => {
    const analysts = normalizeAnalysts(shareOptions.analysts || shareOptions.analyst || defaults.analysts || defaults.analyst)
    const analyst = analysts.join(", ")

    return {
      analyst,
      analysts,
      format: shareOptions.format?.trim() || defaults.format || "",
      updated: normalizeRankingUpdateDate(shareOptions.updated || defaults.updated),
    }
  }

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js"
    script.async = true
    script.onload = () => setIsPapaParseLoaded(true)
    document.head.appendChild(script)
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [])

  const normalizeName = (name) => {
    if (!name) return ""

    const canonicalName = String(name).replace(/\bKenny\s+Gainwell\b/i, "Kenneth Gainwell")

    return canonicalName
      .toLowerCase()
      .replace(/(\s|,)+(jr\.?|sr\.?|ii|iii|iv|v)\b/g, "")
      .replace(/[^a-z]/g, "")
      .trim()
  }


  const buildPlayersFromFantasyProsText = useCallback((rawText) => {
    const seenRanks = new Set()

    return String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\t+/).map((cell) => cell.trim()))
      .filter((cells) => /^\d+$/.test(cells[0] || "") && cells.length >= 3)
      .filter((cells) => {
        if (seenRanks.has(cells[0])) return false
        seenRanks.add(cells[0])
        return true
      })
      .map((cells, index) => {
        const rank = Number.parseInt(cells[0], 10)
        const name = cells[1] || ""
        const nameParts = name.split(" ")
        const firstName = nameParts.shift() || ""
        const lastName = nameParts.join(" ")
        const position = (cells[2] || "").replace(/\d/g, "").toUpperCase() || "FLEX"
        const team = cells[3] || "FA"
        const adpValue = Number.parseFloat(cells[7])

        return {
          id: `pasted-${rank || index + 1}`,
          name,
          firstName,
          lastName,
          position,
          team,
          adp: rank || (!Number.isNaN(adpValue) ? adpValue : index + 1),
          expertRank: rank || index + 1,
          marketAdp: !Number.isNaN(adpValue) ? adpValue : rank || index + 1,
          value: 0,
          drafted: false,
        }
      })
  }, [])

  const handleRankingsPaste = useCallback(
    (rawText, rankingIndex = 0, shareOptions = {}) => {
      const players = buildPlayersFromFantasyProsText(rawText)
      if (players.length === 0) return { ok: false, message: "No FantasyPros ranking rows found." }

      const metadata = buildRankingMetadata(shareOptions)
      const name = `${metadata.analyst || "Pasted FantasyPros Rankings"}${metadata.format ? ` (${metadata.format})` : ""}`

      setRankings((prev) => {
        const newRankings = [...prev]
        newRankings[rankingIndex] = { data: players, name, metadata }
        return newRankings
      })

      const shouldShare = metadata.analyst && metadata.format && metadata.updated

      if (shouldShare) {
        const customSet = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          ...metadata,
          playerCount: players.length,
          data: players.map((player) => ({ ...player, drafted: false })),
        }
        addCustomRankingSet(customSet)
      }

      setActiveRankingIndex(rankingIndex)
      return {
        ok: true,
        message: shouldShare
          ? `${players.length} pasted rankings loaded and shared.`
          : `${players.length} pasted rankings loaded. Add analyst(s), format, and update date to share.`,
      }
    },
    [addCustomRankingSet, buildPlayersFromFantasyProsText],
  )

  const handleFileUpload = useCallback(
    (event, rankingIndex = 0, shareOptions = {}) => {
      const file = event.target.files[0]
      if (!file) return
      if (!isPapaParseLoaded || typeof window.Papa === "undefined") {
        return
      }

      window.Papa.parse(file, {
        complete: (results) => {
          try {
            const originalHeaders = results.meta.fields
            const lowerCaseHeaders = originalHeaders.map((h) => h.toLowerCase().trim())
            let players = []

            const findHeader = (variants) => {
              const lowerVariant = variants.find((v) => lowerCaseHeaders.includes(v.toLowerCase()))
              if (lowerVariant) {
                return originalHeaders.find((h) => h.toLowerCase().trim() === lowerVariant.toLowerCase())
              }
              return null
            }

            // Check for Underdog format first (has firstName, lastName, slotName columns)
            const firstNameHeader = findHeader(["firstName", "first_name", "First Name"])
            const lastNameHeader = findHeader(["lastName", "last_name", "Last Name"])
            const slotNameHeader = findHeader(["slotName", "slot_name", "Slot Name", "slot"])
            const teamNameHeader = findHeader(["teamName", "team_name", "Team Name"])
            const underdogAdpHeader = findHeader(["adp", "ADP"])
            const underdogIdHeader = findHeader(["id", "ID", "playerId", "player_id"])
            const projectedPointsHeader = findHeader(["projectedPoints", "projected_points", "Projected Points", "fpts", "FPTS"])

            const isUnderdogFormat = firstNameHeader && lastNameHeader && slotNameHeader

            if (isUnderdogFormat) {
              // Parse Underdog format
              players = results.data
                .filter((row) => row[firstNameHeader] && row[lastNameHeader] && row[slotNameHeader])
                .map((row, index) => {
                  const firstName = (row[firstNameHeader] || "").trim()
                  const lastName = (row[lastNameHeader] || "").trim()
                  const name = `${firstName} ${lastName}`.trim()
                  const position = (row[slotNameHeader] || "").replace(/\d/g, "").toUpperCase()
                  const adpValue = underdogAdpHeader ? Number.parseFloat(row[underdogAdpHeader]) : index + 1
                  const projectedPoints = projectedPointsHeader ? Number.parseFloat(row[projectedPointsHeader]) : 0

                  return {
                    id: underdogIdHeader ? row[underdogIdHeader] : `row-${index}`,
                    name: name,
                    firstName: firstName,
                    lastName: lastName,
                    position: position,
                    team: teamNameHeader ? row[teamNameHeader] : "N/A",
                    adp: !isNaN(adpValue) ? adpValue : 999,
                    projectedPoints: !isNaN(projectedPoints) ? projectedPoints : 0,
                    value: 0,
                    drafted: false,
                  }
                })

              const name = file.name.replace(".csv", "")
              const metadata = buildRankingMetadata(shareOptions)

              // Update the specific ranking
              setRankings((prev) => {
                const newRankings = [...prev]
                newRankings[rankingIndex] = {
                  data: players,
                  name,
                  metadata,
                }
                return newRankings
              })

              // Set as active if it's the first ranking or if current active is empty
              if (shareOptions.publish && metadata.analyst && metadata.format && metadata.updated) {
                const customSet = {
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  name,
                  ...metadata,
                  playerCount: players.length,
                  data: players.map((player) => ({ ...player, drafted: false })),
                }
                addCustomRankingSet(customSet)
              }

              if (rankingIndex === 0 || rankings[activeRankingIndex].data.length === 0) {
                setActiveRankingIndex(rankingIndex)
              }
              return
            }

            // Fall back to generic format (FantasyPros, etc.)
            const genericPlayerHeader = findHeader(["Player", "Player Name"])
            const genericPosHeader = findHeader(["Pos", "Position"])

            if (genericPlayerHeader && genericPosHeader) {
              const adpDateHeaders = originalHeaders
                .filter((h) => h.toLowerCase().startsWith("adp on "))
                .sort((a, b) => {
                  const dateA = new Date(a.substring(7))
                  const dateB = new Date(b.substring(7))
                  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0
                  return dateB - dateA
                })

              let adpSourceHeader = adpDateHeaders.length > 0 ? adpDateHeaders[0] : findHeader(["ADP"])
              const rankHeader = findHeader(["Rank", "Rk"])

              if (!adpSourceHeader && rankHeader) {
                adpSourceHeader = rankHeader
              }

              const teamHeader = findHeader(["Team"])

              players = results.data
                .filter((row) => row[genericPlayerHeader] && row[genericPosHeader])
                .map((row, index) => {
                  const name = row[genericPlayerHeader] || ""
                  const nameParts = name.split(" ")
                  const firstName = nameParts.shift() || ""
                  const lastName = nameParts.join(" ")
                  const position = (row[genericPosHeader] || "").replace(/\d/g, "")
                  const adpValue = adpSourceHeader ? Number.parseFloat(row[adpSourceHeader]) : index + 1

                  return {
                    id: rankHeader ? row[rankHeader] : `row-${index}`,
                    name: name,
                    firstName: firstName,
                    lastName: lastName,
                    position: position,
                    team: teamHeader ? row[teamHeader] : "N/A",
                    adp: !isNaN(adpValue) ? adpValue : 999,
                    value: 0,
                    drafted: false,
                  }
                })

              const name = file.name.replace(".csv", "")
              const metadata = buildRankingMetadata(shareOptions)

              // Update the specific ranking
              setRankings((prev) => {
                const newRankings = [...prev]
                newRankings[rankingIndex] = {
                  data: players,
                  name,
                  metadata,
                }
                return newRankings
              })

              if (shareOptions.publish && metadata.analyst && metadata.format && metadata.updated) {
                const customSet = {
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  name,
                  ...metadata,
                  playerCount: players.length,
                  data: players.map((player) => ({ ...player, drafted: false })),
                }
                addCustomRankingSet(customSet)
              }

              // Set as active if it's the first ranking or if current active is empty
              if (rankingIndex === 0 || rankings[activeRankingIndex].data.length === 0) {
                setActiveRankingIndex(rankingIndex)
              }
            }
          } catch (err) {
            console.error("CSV Parsing Error:", err)
          }
        },
        header: true,
        skipEmptyLines: true,
      })
    },
    [addCustomRankingSet, isPapaParseLoaded, rankings, activeRankingIndex],
  )

  const saveLoadedRankingSet = useCallback((rankingIndex = activeRankingIndex, metadata = {}) => {
    const ranking = rankings[rankingIndex]
    if (!ranking?.data?.length) return { ok: false, message: "No rankings loaded in that slot." }

    const rankingMetadata = ranking.metadata || {}
    const normalizedMetadata = buildRankingMetadata(metadata, rankingMetadata)
    const analyst = normalizedMetadata.analyst || ranking.name || "Custom Rankings"
    const analysts = normalizedMetadata.analysts.length ? normalizedMetadata.analysts : [analyst]
    const format = normalizedMetadata.format || "PPR"
    const updated = normalizedMetadata.updated

    if (!analyst || !format || !updated) {
      return { ok: false, message: "Analyst, format, and update date are required." }
    }

    const customSet = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: ranking.name || analyst,
      analyst,
      analysts,
      format,
      updated,
      playerCount: ranking.data.length,
      data: ranking.data.map((player) => ({ ...player, drafted: false })),
    }
    addCustomRankingSet(customSet)
    return { ok: true, message: `${customSet.playerCount} rankings saved to the quick switch board.` }
  }, [activeRankingIndex, addCustomRankingSet, rankings])

  const loadCustomRankingSet = useCallback((setId, rankingIndex = 0) => {
    const customSet = customRankingSets.find((set) => set.id === setId)
    if (!customSet) return

    setRankings((prev) => {
      const newRankings = [...prev]
      newRankings[rankingIndex] = {
        data: customSet.data.map((player) => ({ ...player, drafted: false })),
        name: `${customSet.analyst} (${customSet.format})`,
        customSetId: customSet.id,
        metadata: { analyst: customSet.analyst, analysts: customSet.analysts || [customSet.analyst], format: customSet.format, updated: customSet.updated },
      }
      return newRankings
    })
    setActiveRankingIndex(rankingIndex)
  }, [customRankingSets])

  const removeCustomRankingSet = useCallback((setId) => {
    const nextSets = customRankingSets.filter((set) => set.id !== setId)
    saveCustomRankingSets(nextSets)

    fetch(`${CUSTOM_RANKING_LIBRARY_API}?id=${encodeURIComponent(setId)}`, { method: "DELETE" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Custom rankings delete failed: ${response.status}`)
        const { sets } = await response.json()
        if (Array.isArray(sets)) saveCustomRankingSets(sets)
      })
      .catch((err) => console.error("Custom rankings library delete error:", err))
  }, [customRankingSets, saveCustomRankingSets])

  const loadPreset = useCallback(
    (presetId, rankingIndex = 0) => {
      const preset = findPresetById(presetId)
      if (!preset) return

      // Clone players so drafted state stays independent per load
      const players = preset.players.map((p) => ({
        ...p,
        expertRank: p.adp,
        marketAdp: p.marketAdp || p.adp,
        hybridSource: preset.sourceByPosition?.[p.position] || preset.analyst,
        drafted: false,
      }))

      setRankings((prev) => {
        const newRankings = [...prev]
        newRankings[rankingIndex] = {
          data: players,
          name: `${preset.analyst} (${preset.updated})`,
          presetId: preset.id,
        }
        return newRankings
      })

      setActiveRankingIndex(rankingIndex)
    },
    [],
  )

  useEffect(() => {
    const hasLoadedRankings = rankings.some((ranking) => ranking.data.length > 0 || ranking.presetId)
    if (!hasLoadedRankings) {
      loadPreset(DEFAULT_RANKING_PRESET_ID, 0)
    }
  }, [loadPreset, rankings])

  const getActiveRankingData = useCallback(() => {
    return rankings[activeRankingIndex]?.data || []
  }, [rankings, activeRankingIndex])

  const getAvailablePlayers = useCallback(() => {
    return getActiveRankingData().filter((player) => !player.drafted)
  }, [getActiveRankingData])

  const getFilteredPlayers = useCallback(() => {
    const availablePlayers = getAvailablePlayers()
    return availablePlayers.filter((player) => {
      const matchesSearch =
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (player.team && player.team.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesPosition =
        positionFilter === "All" ||
        (positionFilter === "Flex" ? FLEX_POSITIONS.includes(player.position) : player.position === positionFilter)
      return matchesSearch && matchesPosition
    })
  }, [getAvailablePlayers, searchTerm, positionFilter])

  const updateDraftedPlayers = useCallback((draftedPlayerNames) => {
    setRankings((prevRankings) => {
      return prevRankings.map((ranking) => ({
        ...ranking,
        data: ranking.data.map((player) => {
          const isPlayerDrafted = draftedPlayerNames.some((draftedName) => {
            const normalizedDrafted = normalizeName(draftedName)
            const normalizedPlayer = normalizeName(player.name)
            return normalizedDrafted === normalizedPlayer
          })
          return {
            ...player,
            drafted: isPlayerDrafted,
          }
        }),
      }))
    })
  }, [])

  return {
    rankings,
    setRankings,
    activeRankingIndex,
    setActiveRankingIndex,
    csvData: getActiveRankingData(), // For backward compatibility
    handleFileUpload,
    handleRankingsPaste,
    loadPreset,
    customRankingSets,
    saveLoadedRankingSet,
    loadCustomRankingSet,
    removeCustomRankingSet,
    isPapaParseLoaded,
    searchTerm,
    setSearchTerm,
    positionFilter,
    setPositionFilter,
    getFilteredPlayers,
    getAvailablePlayers,
    updateDraftedPlayers,
    normalizeName,
  }
}
