"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "./header"
import { BestValueSection } from "./best-value-section"
import { DraftedPlayersSection } from "./drafted-players-section"
import { ScoreboardSection } from "./scoreboard-section"
import { TeamRosterSection } from "./team-roster-section"
import { AvailablePlayersSection } from "./available-players-section"
import { PlayerQueueSection } from "./player-queue-section"
import { useTheme } from "./use-theme"
import { useDraftData } from "./use-draft-data"
import { usePlayerData } from "./use-player-data"
import { COLORS } from "./theme-colors"

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
  const [isPhoneMode, setIsPhoneMode] = useState(false)

  // Per-position queue of planned players (added via + button)
  const [queues, setQueues] = useState({ QB: [], RB: [], WR: [], TE: [] })

  const addToQueue = (position, player) => {
    if (!position || !player) return
    setQueues((prev) => {
      const list = prev[position] || []
      if (list.some((p) => p.id === player.id)) return prev
      return { ...prev, [position]: [...list, player] }
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

  // Update drafted players when draftedPlayers changes
  useEffect(() => {
    if (draftedPlayers && draftedPlayers.length > 0) {
      // Mark drafted players in CSV data
      const updatedRankings = rankings.map((ranking) => ({
        ...ranking,
        data: ranking.data.map((player) => ({
          ...player,
          drafted: draftedPlayers.some(
            (drafted) =>
              drafted.name.toLowerCase().includes(player.name.toLowerCase()) ||
              player.name.toLowerCase().includes(drafted.name.toLowerCase()),
          ),
        })),
      }))
      setRankings(updatedRankings)
    }
  }, [draftedPlayers])

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

      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
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

        {/* Phone Mode Toggle */}
        <div className="mb-4 flex justify-center">
          <button
            onClick={() => setIsPhoneMode(!isPhoneMode)}
            className="px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{
              backgroundColor: isPhoneMode ? colors.headingGreen : colors.card,
              color: isPhoneMode ? "#000000" : colors.textPrimary,
              border: `1px solid ${colors.cardBorder}`,
            }}
          >
            📱 {isPhoneMode ? "Exit Phone Mode" : "Phone Mode"}
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 lg:gap-6">
          {isPhoneMode ? (
            /* Phone Mode: Only Best Value and Team Roster side by side */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              />

              <TeamRosterSection
                colors={colors}
                draftData={draftData}
                selectedTeamRosterId={selectedTeamRosterId}
                setSelectedTeamRosterId={setSelectedTeamRosterId}
                draftedPlayers={draftedPlayers}
                platform={platform}
              />
            </div>
          ) : (
            <>
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

              {/* Desktop: Multi-column layout with wider team roster */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
                {/* Left Column */}
                <div className="lg:col-span-4 space-y-4">
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

                {/* Middle Column - Wider for Team Roster */}
                <div className="lg:col-span-4">
                  <TeamRosterSection
                    colors={colors}
                    draftData={draftData}
                    selectedTeamRosterId={selectedTeamRosterId}
                    setSelectedTeamRosterId={setSelectedTeamRosterId}
                    draftedPlayers={draftedPlayers}
                    platform={platform}
                  />
                </div>

                {/* Right Column */}
                <div className="lg:col-span-4 space-y-4">
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
