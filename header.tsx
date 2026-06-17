"use client"
import { useState } from "react"
import { Moon, Sun, Copy, Twitter, MessageSquare, CheckCircle, AlertCircle, TrendingUp, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FileManager } from "./file-manager"
import { RedditPostCard } from "./reddit-post-card"
import { RANKING_PRESET_GROUPS } from "./ranking-presets"

const getAccuracyTypeStyle = (type: string, colors: any) => ({
  backgroundColor: type === "Draft" ? `${colors.purple}30` : type === "Hybrid" ? `${colors.headingGreen}26` : `${colors.gold}26`,
  color: type === "Draft" ? colors.purple : type === "Hybrid" ? colors.headingGreen : colors.gold,
  borderColor: type === "Draft" ? colors.purple : type === "Hybrid" ? colors.headingGreen : colors.gold,
})

const POSITION_RANKS = ["QB", "RB", "WR", "TE"] as const

const SageLogo = () => (
  <img src="https://imgur.com/TKUdYzv.png" alt="FantasySage Logo" className="w-32 h-36 sm:w-44 sm:h-48" />
)

export function Header({
  theme,
  toggleTheme,
  colors,
  rankings,
  setRankings,
  activeRankingIndex,
  setActiveRankingIndex,
  handleFileUpload,
  loadPreset,
  isPapaParseLoaded,
  platform,
  setPlatform,
  sleeperUrl,
  setSleeperUrl,
  handleSync,
  isManualSyncing,
  isSyncDisabled,
  error,
  handleCopyLink,
  handleShareTwitter,
  handleShareReddit,
  showCopiedMessage,
  draftData,
}) {
  const [showFileManager, setShowFileManager] = useState(false)
  const [showMediaGrid, setShowMediaGrid] = useState(false)

  const handleShareRedditUpdated = () => {
    const title = "Fantasy Draft Assistant - Crush your Sleeper drafts with live data and multiple ranking sources"
    const url = window.location.href
    const redditUrl = `https://www.reddit.com/r/fantasyfootball/comments/1m3gk5u/your_feedback_here_is_helping_me_build_a_better/`
    window.open(redditUrl, "_blank", "width=600,height=400")
  }

  // Only show connected if we have draft data with actual content and no error
  const isConnected = draftData && draftData.teams && draftData.teams.length > 0 && !error && sleeperUrl.trim()

  return (
    <header className="mb-6">
      {/* Main Header with Logo */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        {/* Left: Logo and Info */}
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SageLogo />
              <div>
                <h1
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold uppercase tracking-wide"
                  style={{ color: colors.headingGreen }}
                >
                  Fantasy Football
                  <br />
                  Draft Assistant
                </h1>
                <p className="text-sm sm:text-base mt-2 max-w-md font-medium" style={{ color: colors.purple }}>
                  Combine rankings from top FantasyPros experts or use Underdog's ADP rankings to see the best available
                  player, live, during your Sleeper draft.
                </p>

                {/* Share Buttons */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Button
                    onClick={handleCopyLink}
                    size="sm"
                    className="h-8 px-3 text-xs hover:opacity-90"
                    style={{
                      backgroundColor: colors.headingGreen,
                      color: "#000000",
                    }}
                  >
                    <Copy size={12} className="mr-1" />
                    Copy Link
                  </Button>
                  <Button
                    onClick={handleShareTwitter}
                    size="sm"
                    className="h-8 px-3 text-xs bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Twitter size={12} className="mr-1" />
                    Twitter
                  </Button>
                  <Button
                    onClick={handleShareRedditUpdated}
                    size="sm"
                    className="h-8 px-3 text-xs text-white hover:opacity-90"
                    style={{
                      backgroundColor: "#FF4500",
                    }}
                  >
                    <MessageSquare size={12} className="mr-1" />
                    Reddit
                  </Button>
                  <Button
                    onClick={toggleTheme}
                    size="sm"
                    className="h-8 px-3 text-xs border hover:scale-105 transition-transform"
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      color: colors.textPrimary,
                    }}
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun size={12} className="mr-1" style={{ color: "#f59e0b" }} />
                        Light
                      </>
                    ) : (
                      <>
                        <Moon size={12} className="mr-1" style={{ color: "#3b82f6" }} />
                        Dark
                      </>
                    )}
                  </Button>
                  {showCopiedMessage && (
                    <span className="text-xs font-semibold" style={{ color: colors.gold }}>
                      ✓ Link copied!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Media Grid - Hidden on mobile */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-4 flex-1">
          <iframe
            src="https://giphy.com/embed/gVXQzc3Sd7TNmKEjsD"
            className="w-full h-72 rounded-lg border"
            style={{
              border: `1px solid ${colors.lightBorder}`,
              boxShadow: colors.shadow,
            }}
            frameBorder="0"
            allowFullScreen
          />
          <RedditPostCard colors={colors} />
        </div>
      </div>

      {/* Getting Started Steps */}
      <div
        className="mb-6 p-4 rounded-lg border"
        style={{ backgroundColor: colors.card, borderColor: colors.lightBorder }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: colors.headingGreen }}>
          🚀 Getting Started - 3 Easy Steps:
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                style={{
                  backgroundColor: colors.headingGreen,
                  color: "#000000",
                }}
              >
                1
              </div>
              <h3 className="font-bold text-lg" style={{ color: colors.textPrimary }}>
                Load Rankings
              </h3>
            </div>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Tap an expert ranking below to load it instantly — no download needed. Want your own? Click "Upload Custom
              CSV" to import rankings from{" "}
              <a
                href="https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
                style={{ color: colors.headingGreen }}
              >
                FantasyPros
              </a>{" "}
              or{" "}
              <a
                href="https://www.4for4.com/underdog/adp"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
                style={{ color: colors.headingGreen }}
              >
                Underdog
              </a>
              .
            </p>
            <Button
              onClick={() => setShowFileManager(!showFileManager)}
              size="sm"
              className="hover:opacity-90"
              style={{
                backgroundColor: colors.headingGreen,
                color: "#000000",
              }}
            >
              {showFileManager ? "Hide Custom Upload" : "Upload Custom CSV"}
            </Button>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                style={{
                  backgroundColor: colors.headingGreen,
                  color: "#000000",
                }}
              >
                2
              </div>
              <h3 className="font-bold text-lg" style={{ color: colors.textPrimary }}>
                Connect Draft
              </h3>
            </div>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Copy your Sleeper draft URL from the draft room and paste it below. The app will automatically sync live
              draft data every 10 seconds.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                style={{
                  backgroundColor: colors.headingGreen,
                  color: "#000000",
                }}
              >
                3
              </div>
              <h3 className="font-bold text-lg" style={{ color: colors.textPrimary }}>
                Draft Smart
              </h3>
            </div>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              See best available players, value picks, team rosters, and live draft scores. Toggle between ranking
              sources to compare different perspectives.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Expert Rankings - One Click Load */}
      <div
        className="mb-6 p-4 rounded-lg border"
        style={{ backgroundColor: colors.card, borderColor: colors.lightBorder }}
      >
        <div className="mb-3">
          <h2 className="text-xl font-bold" style={{ color: colors.headingGreen }}>
            ⚡ Load Expert Rankings Instantly
          </h2>
          <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            Pick a scoring format, then click one card to load that board into the active ranking slot.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RANKING_PRESET_GROUPS.map((group) => (
            <div
              key={group.id}
              className="rounded-lg border p-2.5 space-y-2 h-full"
              style={{ borderColor: colors.cardBorder, backgroundColor: colors.darkBlue }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                  {group.label}
                </span>
                <span className="truncate text-xs" style={{ color: colors.textSecondary }}>
                  {group.description}
                </span>
              </div>

              <div className="space-y-1.5">
                {group.presets.map((preset) => {
                  const isActive = rankings[activeRankingIndex]?.presetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => loadPreset(preset.id, activeRankingIndex)}
                      className="block w-full rounded-md border p-2 text-left transition-colors hover:opacity-90"
                      style={{
                        borderColor: isActive ? colors.headingGreen : colors.cardBorder,
                        backgroundColor: isActive ? `${colors.headingGreen}1a` : colors.card,
                      }}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <TrendingUp size={14} style={{ color: colors.headingGreen }} className="shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: colors.textPrimary }}>
                              {preset.analyst}
                            </div>
                            <div className="text-xs truncate" style={{ color: colors.textSecondary }}>
                              {preset.source}
                            </div>
                            <div className="text-[10px] uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                              Updated {preset.updated}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          {preset.accuracyRanks && (
                            <div
                              className="grid grid-cols-2 overflow-hidden rounded-md border text-[10px] leading-none"
                              style={{ borderColor: colors.cardBorder, backgroundColor: colors.darkBlue }}
                              aria-label="Position accuracy ranks"
                            >
                              {POSITION_RANKS.map((position, index) => (
                                <div
                                  key={position}
                                  className="flex min-w-12 items-center justify-between gap-1 px-1.5 py-1"
                                  style={{
                                    borderColor: colors.cardBorder,
                                    borderRightWidth: index % 2 === 0 ? 1 : 0,
                                    borderBottomWidth: index < 2 ? 1 : 0,
                                  }}
                                >
                                  <span className="font-bold" style={{ color: colors.gold }}>
                                    {position}
                                  </span>
                                  <span className="font-semibold" style={{ color: colors.textPrimary }}>
                                    {preset.accuracyRanks?.[position] ?? "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className="flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap rounded-full border px-1.5 py-0.5"
                              style={getAccuracyTypeStyle(preset.accuracyType, colors)}
                            >
                              <Award size={12} /> {preset.accuracyType} #{preset.accuracyRank}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isActive ? colors.headingGreen : colors.textSecondary }}>
                              {isActive ? "Loaded" : "Load"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 truncate text-[10px]" style={{ color: colors.textSecondary }}>
                        {preset.accuracyNote}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* File Manager */}
      {showFileManager && (
        <div
          className="mb-6 p-4 rounded-lg border"
          style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
        >
          <FileManager
            colors={colors}
            rankings={rankings}
            setRankings={setRankings}
            activeRankingIndex={activeRankingIndex}
            setActiveRankingIndex={setActiveRankingIndex}
            handleFileUpload={handleFileUpload}
            loadPreset={loadPreset}
            isPapaParseLoaded={isPapaParseLoaded}
          />
        </div>
      )}

      {/* Mobile Media Toggle */}
      <div className="lg:hidden mb-6">
        <Button
          onClick={() => setShowMediaGrid(!showMediaGrid)}
          variant="outline"
          size="sm"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            color: colors.textPrimary,
          }}
        >
          {showMediaGrid ? "Hide" : "Show"} Tutorials & Community
        </Button>

        {showMediaGrid && (
          <div className="grid grid-cols-1 gap-4 mt-4">
            <iframe
              src="https://giphy.com/embed/gVXQzc3Sd7TNmKEjsD"
              className="w-full h-72 rounded-lg border"
              style={{
                border: `1px solid ${colors.lightBorder}`,
                boxShadow: colors.shadow,
              }}
              frameBorder="0"
              allowFullScreen
            />
            <RedditPostCard colors={colors} />
          </div>
        )}
      </div>

      {/* Sync Section */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 rounded-lg border"
        style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
      >
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger
                className="w-full sm:w-32"
                style={{
                  backgroundColor: colors.darkBlue,
                  borderColor: colors.cardBorder,
                  color: colors.textPrimary,
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sleeper">Sleeper</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 relative">
              <Input
                type="url"
                placeholder="https://sleeper.app/draft/nfl/..."
                value={sleeperUrl}
                onChange={(e) => setSleeperUrl(e.target.value)}
                className="w-full pr-10"
                style={{
                  backgroundColor: colors.darkBlue,
                  borderColor: colors.cardBorder,
                  color: colors.textPrimary,
                }}
              />
              {/* Connection Status Icon - only show when actually connected */}
              {isConnected && (
                <CheckCircle
                  size={16}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: colors.headingGreen }}
                />
              )}
              {error && (
                <AlertCircle
                  size={16}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: colors.adpNegative }}
                />
              )}
            </div>

            <Button
              onClick={handleSync}
              disabled={isSyncDisabled || isManualSyncing || !sleeperUrl.trim()}
              className="hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: colors.headingGreen,
                color: "#000000",
                minWidth: "100px",
              }}
            >
              {isManualSyncing ? "Syncing..." : "Sync Draft"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          {/* Connection Status - only show when actually connected */}
          {isConnected && (
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} style={{ color: colors.headingGreen }} />
              <span className="text-sm font-semibold" style={{ color: colors.headingGreen }}>
                Connected to Sleeper
              </span>
            </div>
          )}

          {error && (
            <div
              className="text-sm p-2 rounded mb-2"
              style={{ backgroundColor: colors.adpNegative + "20", color: colors.adpNegative }}
            >
              {error}
            </div>
          )}
          <div className="text-xs space-y-1" style={{ color: colors.textSecondary }}>
            <p>• Paste your Sleeper draft URL to sync live draft data</p>
            <p>• Data updates automatically every 10 seconds during active drafts</p>
          </div>
        </div>
      </div>
    </header>
  )
}
