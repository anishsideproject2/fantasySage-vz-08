"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "./header"
import { BestValueSection } from "./best-value-section"
import { DraftedPlayersSection } from "./drafted-players-section"
import { ScoreboardSection } from "./scoreboard-section"
import { TeamRosterSection } from "./team-roster-section"
import { AvailablePlayersSection } from "./available-players-section"
import { PlayerQueueSection } from "./player-queue-section"
import { SuggestedPicksSection } from "./suggested-picks-section"
import { useTheme } from "./use-theme"
import { useDraftData } from "./use-draft-data"
import { usePlayerData } from "./use-player-data"
import { COLORS } from "./theme-colors"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

const QUEUE_POSITIONS = ["QB", "RB", "WR", "TE"]

const normalizePlayerName = (name) => {
  if (!name) return ""
  return name
    .toLowerCase()
    .replace(/(\s|,)+(jr\.?|sr\.?|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z]/g, "")
    .trim()
}

const getQueueValueDiff = (player, currentPick) => {
  const adp = Number.parseFloat(player?.adp)
  const pick = Number.parseFloat(currentPick)

  if (Number.isNaN(adp) || Number.isNaN(pick)) return "--"

  return (pick - adp).toFixed(1)
}

const areQueuedPlayersEqual = (previousPlayer, nextPlayer) =>
  previousPlayer.id === nextPlayer.id &&
  previousPlayer.name === nextPlayer.name &&
  previousPlayer.firstName === nextPlayer.firstName &&
  previousPlayer.lastName === nextPlayer.lastName &&
  previousPlayer.position === nextPlayer.position &&
  previousPlayer.team === nextPlayer.team &&
  previousPlayer.adp === nextPlayer.adp &&
  previousPlayer.valueDiff === nextPlayer.valueDiff

export function FantasyDraftAssistant() {
  const { theme, toggleTheme } = useTheme()
  const colors = useMemo(() => COLORS[theme], [theme])

  const {
    rankings,
    setRankings,
    activeRankingIndex,
    setActiveRankingIndex,
    csvData,
    handleFileUpload,
    loadPreset,
    isPapaParseLoaded,
    searchTerm,
    setSearchTerm,
    positionFilter,
    setPositionFilter,
    getFilteredPlayers,
    getAvailablePlayers,
  } = usePlayerData()

  const {
    draftData,
    draftedPlayers,
    platform,
    setPlatform,
    sleeperUrl,
    setSleeperUrl,
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
  } = useDraftData(csvData)

  const [bestValuePosition, setBestValuePosition] = useState("All")
  const [showCopiedMessage, setShowCopiedMessage] = useState(false)

  // Per-position queue of planned players (added via + button)
  const [queues, setQueues] = useState({ QB: [], RB: [], WR: [], TE: [] })

  const addToQueue = (position, player) => {
    if (!position || !player) return
    setQueues((prev) => {
      const list = prev[position] || []
      if (list.some((p) => p.id === player.id)) return prev
      return {
        ...prev,
        [position]: [
          ...list,
          {
            ...player,
            valueDiff: getQueueValueDiff(player, currentPick),
          },
        ],
      }
    })
  }

  const removeFromQueue = (position, playerId) => {
    setQueues((prev) => ({
      ...prev,
      [position]: (prev[position] || []).filter((p) => p.id !== playerId),
    }))
  }

  const clearQueue = () => setQueues({ QB: [], RB: [], WR: [], TE: [] })

  // Calculate draft pick counts
  const totalPossiblePicks = draftData?.rounds && draftData?.numTeams ? draftData.rounds * draftData.numTeams : 0
  const draftedCount = draftedPlayers?.length || 0
  const remainingCount = totalPossiblePicks - draftedCount

  // Keep ranking drafted flags in sync with the active draft. This must also
  // clear flags when switching to a new draft with no picks yet.
  useEffect(() => {
    const draftedNames = new Set((draftedPlayers || []).map((drafted) => normalizePlayerName(drafted.name)))

    setRankings((prevRankings) => {
      let changed = false
      const nextRankings = prevRankings.map((ranking) => ({
        ...ranking,
        data: ranking.data.map((player) => {
          const drafted = draftedNames.has(normalizePlayerName(player.name))
          if (player.drafted !== drafted) changed = true
          return {
            ...player,
            drafted,
          }
        }),
      }))

      return changed ? nextRankings : prevRankings
    })
  }, [draftedPlayers, setRankings])

  // Keep queued player details and value synced as the draft pick advances.
  useEffect(() => {
    setQueues((prev) => {
      const playersById = new Map(csvData.map((player) => [String(player.id), player]))
      const playersByName = new Map(csvData.map((player) => [normalizePlayerName(player.name), player]))
      let changed = false
      const next = {}

      for (const pos of QUEUE_POSITIONS) {
        next[pos] = (prev[pos] || []).map((queuedPlayer) => {
          const latestPlayer =
            playersById.get(String(queuedPlayer.id)) || playersByName.get(normalizePlayerName(queuedPlayer.name)) || queuedPlayer
          const updatedPlayer = {
            ...queuedPlayer,
            ...latestPlayer,
            valueDiff: getQueueValueDiff(latestPlayer, currentPick),
          }

          if (!areQueuedPlayersEqual(queuedPlayer, updatedPlayer)) {
            changed = true
          }

          return updatedPlayer
        })
      }

      return changed ? next : prev
    })
  }, [csvData, currentPick])

  // Remove queued players once they've been drafted
  useEffect(() => {
    if (!draftedPlayers || draftedPlayers.length === 0) return
    const isDrafted = (player) =>
      draftedPlayers.some(
        (drafted) =>
          drafted.name.toLowerCase().includes(player.name.toLowerCase()) ||
          player.name.toLowerCase().includes(drafted.name.toLowerCase()),
      )
    setQueues((prev) => {
      let changed = false
      const next = {}
      for (const pos of Object.keys(prev)) {
        const filtered = prev[pos].filter((p) => !isDrafted(p))
        if (filtered.length !== prev[pos].length) changed = true
        next[pos] = filtered
      }
      return changed ? next : prev
    })
  }, [draftedPlayers])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setShowCopiedMessage(true)
    setTimeout(() => setShowCopiedMessage(false), 2000)
  }

  const handleShareTwitter = () => {
    const text =
      "Check out this Fantasy Draft Assistant! 🏈 Crush your Sleeper drafts with live data and multiple ranking sources. #FantasyFootball #Draft"
    const url = window.location.href
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, "_blank", "width=600,height=400")
  }

  const handleShareReddit = () => {
    const redditUrl =
      "https://www.reddit.com/r/fantasyfootball/comments/1m3gk5u/your_feedback_here_is_helping_me_build_a_better"
    window.open(redditUrl, "_blank", "width=600,height=400")
  }

  return (
    <div
      className="min-h-screen w-full font-sans transition-colors duration-300"
      style={{
        background: colors.background,
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      }}
    >
      <style jsx global>{`
        /* Custom scrollbar styles */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: ${colors.card};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: ${colors.purple};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: ${colors.purple}CC;
        }
        
        /* Firefox scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: ${colors.purple} ${colors.card};
        }

        /* Hover effects for best value and available players */
        .best-value-row:hover,
        .player-row:hover {
          background-color: ${colors.purple}40 !important;
          cursor: pointer;
        }

        .best-value-row:hover .player-name-cell,
        .player-row:hover .player-name-cell {
          color: ${colors.textPrimary} !important;
        }
      `}</style>

      <div className="mx-auto max-w-[1920px] px-3 py-3 sm:px-4 lg:px-5">
        <Header
          theme={theme}
          toggleTheme={toggleTheme}
          colors={colors}
          rankings={rankings}
          setRankings={setRankings}
          activeRankingIndex={activeRankingIndex}
          setActiveRankingIndex={setActiveRankingIndex}
          handleFileUpload={handleFileUpload}
          loadPreset={loadPreset}
          isPapaParseLoaded={isPapaParseLoaded}
          platform={platform}
          setPlatform={setPlatform}
          sleeperUrl={sleeperUrl}
          setSleeperUrl={setSleeperUrl}
          handleSync={handleSync}
          isManualSyncing={isManualSyncing}
          isSyncDisabled={isSyncDisabled}
          error={error}
          handleCopyLink={handleCopyLink}
          handleShareTwitter={handleShareTwitter}
          handleShareReddit={handleShareReddit}
          showCopiedMessage={showCopiedMessage}
          draftData={draftData}
        />

        {/* Main Content Grid */}
        <div className="grid gap-3 lg:gap-4">
              {/* Mobile: Stack all sections vertically */}
              <div className="grid gap-4 lg:hidden">
                <BestValueSection
                  colors={colors}
                  csvData={csvData}
                  draftData={draftData}
                  currentPick={currentPick}
                  bestValuePosition={bestValuePosition}
                  setBestValuePosition={setBestValuePosition}
                  lastUpdate={lastUpdate}
                  timeSinceUpdate={timeSinceUpdate}
                  getAvailablePlayers={getAvailablePlayers}
                  queues={queues}
                  addToQueue={addToQueue}
                  removeFromQueue={removeFromQueue}
                  draftedPlayers={draftedPlayers}
                  selectedTeamRosterId={selectedTeamRosterId}
                />

                <PlayerQueueSection
                  colors={colors}
                  queues={queues}
                  removeFromQueue={removeFromQueue}
                  clearQueue={clearQueue}
                />

                <AvailablePlayersSection
                  colors={colors}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  positionFilter={positionFilter}
                  setPositionFilter={setPositionFilter}
                  getFilteredPlayers={getFilteredPlayers}
                  queues={queues}
                  addToQueue={addToQueue}
                  removeFromQueue={removeFromQueue}
                />

                <SuggestedPicksSection
                  colors={colors}
                  draftData={draftData}
                  currentPick={currentPick}
                  getAvailablePlayers={getAvailablePlayers}
                  draftedPlayers={draftedPlayers}
                  selectedTeamRosterId={selectedTeamRosterId}
                />

                <DraftedPlayersSection
                  colors={colors}
                  draftedPlayers={draftedPlayers}
                  draftData={draftData}
                  totalPossiblePicks={totalPossiblePicks}
                  draftedCount={draftedCount}
                  remainingCount={remainingCount}
                />

                <TeamRosterSection
                  colors={colors}
                  draftData={draftData}
                  selectedTeamRosterId={selectedTeamRosterId}
                  setSelectedTeamRosterId={setSelectedTeamRosterId}
                  draftedPlayers={draftedPlayers}
                  platform={platform}
                />

                <ScoreboardSection
                  colors={colors}
                  draftData={draftData}
                  draftedPlayers={draftedPlayers}
                  selectedTeamRosterId={selectedTeamRosterId}
                />
              </div>

              {/* Desktop: Resizable command-center layout. Resize is useful during drafts; drag/reorder was intentionally avoided because stable muscle memory matters more under time pressure. */}
              <div className="hidden lg:block">
                <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-260px)] rounded-2xl">
                  <ResizablePanel defaultSize={31} minSize={24} className="pr-3">
                    <div className="h-full space-y-3 overflow-y-auto pr-1">
                  <BestValueSection
                    colors={colors}
                    csvData={csvData}
                    draftData={draftData}
                    currentPick={currentPick}
                    bestValuePosition={bestValuePosition}
                    setBestValuePosition={setBestValuePosition}
                    lastUpdate={lastUpdate}
                    timeSinceUpdate={timeSinceUpdate}
                    getAvailablePlayers={getAvailablePlayers}
                    queues={queues}
                    addToQueue={addToQueue}
                    removeFromQueue={removeFromQueue}
                    draftedPlayers={draftedPlayers}
                    selectedTeamRosterId={selectedTeamRosterId}
                  />

                  <PlayerQueueSection
                    colors={colors}
                    queues={queues}
                    removeFromQueue={removeFromQueue}
                    clearQueue={clearQueue}
                  />

                  <ScoreboardSection
                    colors={colors}
                    draftData={draftData}
                    draftedPlayers={draftedPlayers}
                    selectedTeamRosterId={selectedTeamRosterId}
                  />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle className="w-2 rounded-full" style={{ backgroundColor: colors.cardBorder }} />
                  <ResizablePanel defaultSize={38} minSize={28} className="px-3">
                    <div className="h-full overflow-y-auto pr-1">
                  <TeamRosterSection
                    colors={colors}
                    draftData={draftData}
                    selectedTeamRosterId={selectedTeamRosterId}
                    setSelectedTeamRosterId={setSelectedTeamRosterId}
                    draftedPlayers={draftedPlayers}
                    platform={platform}
                  />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle className="w-2 rounded-full" style={{ backgroundColor: colors.cardBorder }} />
                  <ResizablePanel defaultSize={31} minSize={24} className="pl-3">
                    <div className="h-full space-y-3 overflow-y-auto pr-1">
                  <SuggestedPicksSection
                    colors={colors}
                    draftData={draftData}
                    currentPick={currentPick}
                    getAvailablePlayers={getAvailablePlayers}
                    draftedPlayers={draftedPlayers}
                    selectedTeamRosterId={selectedTeamRosterId}
                  />

                  <DraftedPlayersSection
                    colors={colors}
                    draftedPlayers={draftedPlayers}
                    draftData={draftData}
                    totalPossiblePicks={totalPossiblePicks}
                    draftedCount={draftedCount}
                    remainingCount={remainingCount}
                  />

                  <AvailablePlayersSection
                    colors={colors}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    positionFilter={positionFilter}
                    setPositionFilter={setPositionFilter}
                    getFilteredPlayers={getFilteredPlayers}
                    queues={queues}
                    addToQueue={addToQueue}
                    removeFromQueue={removeFromQueue}
                  />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
        </div>
      </div>
    </div>
  )
}
