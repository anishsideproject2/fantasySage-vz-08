"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "./header"
import { BestValueSection } from "./best-value-section"
import { SuggestedPicksSection } from "./suggested-picks-section"
import { DraftBoardSection } from "./draft-board-section"
import { TeamRosterSection } from "./team-roster-section"
import { useTheme } from "./use-theme"
import { useDraftData } from "./use-draft-data"
import { usePlayerData } from "./use-player-data"
import { COLORS } from "./theme-colors"

const normalizePlayerName = (name) => {
  if (!name) return ""
  const canonicalName = String(name).replace(/\bKenny\s+Gainwell\b/i, "Kenneth Gainwell")
  return canonicalName
    .toLowerCase()
    .replace(/(\s|,)+(jr\.?|sr\.?|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z]/g, "")
    .trim()
}

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
    handleRankingsPaste,
    loadPreset,
    customRankingSets,
    saveLoadedRankingSet,
    loadCustomRankingSet,
    removeCustomRankingSet,
    isPapaParseLoaded,
    searchTerm,
    setSearchTerm,
    getAvailablePlayers,
  } = usePlayerData()

  const {
    draftData,
    draftedPlayers,
    platform,
    setPlatform,
    sleeperUrl,
    sleeperUrls,
    setSleeperUrl,
    activeSleeperUrlIndex,
    setActiveSleeperUrlIndex,
    autoSwitchSleeperDrafts,
    setAutoSwitchSleeperDrafts,
    sleeperUsername,
    setSleeperUsername,
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
  const [selectedStrategyOverride, setSelectedStrategyOverride] = useState("auto")
  const [isDraftBoardMaximized, setIsDraftBoardMaximized] = useState(false)
  const [isMaximizedRosterOpen, setIsMaximizedRosterOpen] = useState(true)
  const [isMaximizedBestValueOpen, setIsMaximizedBestValueOpen] = useState(true)

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

  const maximizedDraftBoardTopContent = (
    <div className="grid max-h-[44vh] min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div className="min-h-0">
        <SuggestedPicksSection
          colors={colors}
          draftData={draftData}
          currentPick={currentPick}
          getAvailablePlayers={getAvailablePlayers}
          draftedPlayers={draftedPlayers}
          selectedTeamRosterId={selectedTeamRosterId}
          layout="horizontal"
          selectedStrategyOverride={selectedStrategyOverride}
          setSelectedStrategyOverride={setSelectedStrategyOverride}
          compact
        />
      </div>
      <div className="grid min-h-0 gap-3 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border" style={{ borderColor: colors.lightBorder }}>
          <button
            type="button"
            onClick={() => setIsMaximizedRosterOpen((value) => !value)}
            className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-widest"
            style={{ background: colors.tableRow, color: colors.textPrimary }}
            aria-expanded={isMaximizedRosterOpen}
          >
            <span>Selected roster</span>
            <span style={{ color: colors.headingGreen }}>{isMaximizedRosterOpen ? "Minimize ↑" : "Expand ↓"}</span>
          </button>
          {isMaximizedRosterOpen && (
            <div className="h-[min(16rem,24vh)] min-h-0">
              <TeamRosterSection
                colors={colors}
                draftData={draftData}
                selectedTeamRosterId={selectedTeamRosterId}
                setSelectedTeamRosterId={setSelectedTeamRosterId}
                draftedPlayers={draftedPlayers}
                platform={platform}
                variant="compact"
              />
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border" style={{ borderColor: colors.lightBorder }}>
          <button
            type="button"
            onClick={() => setIsMaximizedBestValueOpen((value) => !value)}
            className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-widest"
            style={{ background: colors.tableRow, color: colors.textPrimary }}
            aria-expanded={isMaximizedBestValueOpen}
          >
            <span>Best value</span>
            <span style={{ color: colors.headingGreen }}>{isMaximizedBestValueOpen ? "Minimize ↑" : "Expand ↓"}</span>
          </button>
          {isMaximizedBestValueOpen && (
            <div className="h-[min(16rem,24vh)] min-h-0">
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
                draftedPlayers={draftedPlayers}
                selectedTeamRosterId={selectedTeamRosterId}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                compact
                maxPlayers={30}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div
      className="min-h-screen w-full font-sans transition-colors duration-300"
      style={{
        background: colors.background,
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      }}
    >
      <style jsx global>{`
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

        * {
          scrollbar-width: thin;
          scrollbar-color: ${colors.purple} ${colors.card};
        }

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

      <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col px-3 py-3 sm:px-4 lg:px-5">
        <Header
          theme={theme}
          toggleTheme={toggleTheme}
          colors={colors}
          rankings={rankings}
          setRankings={setRankings}
          activeRankingIndex={activeRankingIndex}
          setActiveRankingIndex={setActiveRankingIndex}
          handleFileUpload={handleFileUpload}
          handleRankingsPaste={handleRankingsPaste}
          loadPreset={loadPreset}
          customRankingSets={customRankingSets}
          saveLoadedRankingSet={saveLoadedRankingSet}
          loadCustomRankingSet={loadCustomRankingSet}
          removeCustomRankingSet={removeCustomRankingSet}
          isPapaParseLoaded={isPapaParseLoaded}
          platform={platform}
          setPlatform={setPlatform}
          sleeperUrl={sleeperUrl}
          sleeperUrls={sleeperUrls}
          setSleeperUrl={setSleeperUrl}
          activeSleeperUrlIndex={activeSleeperUrlIndex}
          setActiveSleeperUrlIndex={setActiveSleeperUrlIndex}
          autoSwitchSleeperDrafts={autoSwitchSleeperDrafts}
          setAutoSwitchSleeperDrafts={setAutoSwitchSleeperDrafts}
          sleeperUsername={sleeperUsername}
          setSleeperUsername={setSleeperUsername}
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

        <main className="flex-1 pb-6">
          <div className="space-y-4 lg:hidden">
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
              draftedPlayers={draftedPlayers}
              selectedTeamRosterId={selectedTeamRosterId}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
            <SuggestedPicksSection
              colors={colors}
              draftData={draftData}
              currentPick={currentPick}
              getAvailablePlayers={getAvailablePlayers}
              draftedPlayers={draftedPlayers}
              selectedTeamRosterId={selectedTeamRosterId}
              layout="horizontal"
              selectedStrategyOverride={selectedStrategyOverride}
              setSelectedStrategyOverride={setSelectedStrategyOverride}
            />
            <TeamRosterSection
              colors={colors}
              draftData={draftData}
              selectedTeamRosterId={selectedTeamRosterId}
              setSelectedTeamRosterId={setSelectedTeamRosterId}
              draftedPlayers={draftedPlayers}
              platform={platform}
            />
            <DraftBoardSection
              colors={colors}
              draftData={draftData}
              draftedPlayers={draftedPlayers}
              currentPick={currentPick}
              selectedTeamRosterId={selectedTeamRosterId}
              setSelectedTeamRosterId={setSelectedTeamRosterId}
              visibleRoundCount={null}
              isMaximized={isDraftBoardMaximized}
              onToggleMaximized={() => setIsDraftBoardMaximized((value) => !value)}
              selectedStrategyOverride={selectedStrategyOverride}
              maximizedTopContent={maximizedDraftBoardTopContent}
            />
          </div>

          <div className="hidden items-stretch gap-4 lg:grid lg:h-[52rem] lg:grid-cols-[minmax(300px,0.85fr)_minmax(300px,0.85fr)_minmax(620px,1.6fr)]">
            <div className="flex min-h-0 flex-col">
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
                draftedPlayers={draftedPlayers}
                selectedTeamRosterId={selectedTeamRosterId}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
              />
            </div>
            <div className="flex min-h-0 flex-col">
              <TeamRosterSection
                colors={colors}
                draftData={draftData}
                selectedTeamRosterId={selectedTeamRosterId}
                setSelectedTeamRosterId={setSelectedTeamRosterId}
                draftedPlayers={draftedPlayers}
                platform={platform}
              />
            </div>
            <div className="flex min-h-0 flex-col gap-4">
              <SuggestedPicksSection
                colors={colors}
                draftData={draftData}
                currentPick={currentPick}
                getAvailablePlayers={getAvailablePlayers}
                draftedPlayers={draftedPlayers}
                selectedTeamRosterId={selectedTeamRosterId}
                layout="horizontal"
                selectedStrategyOverride={selectedStrategyOverride}
                setSelectedStrategyOverride={setSelectedStrategyOverride}
              />
              <div className="flex min-h-0 flex-1 flex-col">
                <DraftBoardSection
                  colors={colors}
                  draftData={draftData}
                  draftedPlayers={draftedPlayers}
                  currentPick={currentPick}
                  selectedTeamRosterId={selectedTeamRosterId}
                  setSelectedTeamRosterId={setSelectedTeamRosterId}
                  visibleRoundCount={null}
                  isMaximized={isDraftBoardMaximized}
                  onToggleMaximized={() => setIsDraftBoardMaximized((value) => !value)}
                  selectedStrategyOverride={selectedStrategyOverride}
                  maximizedTopContent={maximizedDraftBoardTopContent}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
