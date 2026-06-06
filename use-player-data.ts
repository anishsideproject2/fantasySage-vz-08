"use client"

import { useState, useEffect, useCallback } from "react"
import { findPresetById } from "./ranking-presets"

const POSITIONS = ["All", "Flex", "QB", "RB", "WR", "TE"]
const FLEX_POSITIONS = ["RB", "WR", "TE"]

export function usePlayerData() {
  const [rankings, setRankings] = useState([
    { data: [], name: null },
    { data: [], name: null },
  ])
  const [activeRankingIndex, setActiveRankingIndex] = useState(0)
  const [isPapaParseLoaded, setIsPapaParseLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [positionFilter, setPositionFilter] = useState("All")

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
    return name
      .toLowerCase()
      .replace(/(\s|,)+(jr\.?|sr\.?|ii|iii|iv|v)\b/g, "")
      .replace(/[^a-z]/g, "")
      .trim()
  }

  const handleFileUpload = useCallback(
    (event, rankingIndex = 0) => {
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

              // Update the specific ranking
              setRankings((prev) => {
                const newRankings = [...prev]
                newRankings[rankingIndex] = {
                  data: players,
                  name: file.name.replace(".csv", ""),
                }
                return newRankings
              })

              // Set as active if it's the first ranking or if current active is empty
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

              // Update the specific ranking
              setRankings((prev) => {
                const newRankings = [...prev]
                newRankings[rankingIndex] = {
                  data: players,
                  name: file.name.replace(".csv", ""),
                }
                return newRankings
              })

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
    [isPapaParseLoaded, rankings, activeRankingIndex],
  )

  const loadPreset = useCallback(
    (presetId, rankingIndex = 0) => {
      const preset = findPresetById(presetId)
      if (!preset) return

      // Clone players so drafted state stays independent per load
      const players = preset.players.map((p) => ({ ...p, drafted: false }))

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
    loadPreset,
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
