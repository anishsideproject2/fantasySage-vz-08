"use client"
import { useState } from "react"
import { Moon, Sun, Copy, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FileManager } from "./file-manager"
import { RANKING_PRESET_GROUPS } from "./ranking-presets"

const getAccuracyTypeStyle = (type: string, colors: any) => ({
  backgroundColor: type === "Draft" ? `${colors.purple}30` : type === "Hybrid" ? `${colors.headingGreen}26` : `${colors.gold}26`,
  color: type === "Draft" ? colors.purple : type === "Hybrid" ? colors.headingGreen : colors.gold,
  borderColor: type === "Draft" ? colors.purple : type === "Hybrid" ? colors.headingGreen : colors.gold,
})

const POSITION_RANKS = ["QB", "RB", "WR", "TE"] as const

const getAccuracyYear = (preset: any) => preset.accuracyNote?.match(/20\d{2}/)?.[0] || ""

const getAccuracyAwardLabel = (preset: any) => {
  const year = getAccuracyYear(preset)
  const type = preset.accuracyType === "Hybrid" ? "Hybrid accuracy" : `${preset.accuracyType || "Accuracy"} accuracy`
  return year ? `${year} ${type}` : type
}

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
  showCopiedMessage,
  draftData,
}) {
  const [showFileManager, setShowFileManager] = useState(false)

  // Only show connected if we have draft data with actual content and no error
  const isConnected = draftData && draftData.teams && draftData.teams.length > 0 && !error && sleeperUrl.trim()

  return (
    <header className="mb-3 space-y-3">
      <div
        className="rounded-2xl border p-3 shadow-sm"
        style={{ backgroundColor: colors.card, borderColor: colors.lightBorder, boxShadow: colors.shadow }}
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.4fr)_minmax(320px,1fr)] xl:items-center">
          <div className="flex items-center gap-3 min-w-0">
            <img src="https://imgur.com/TKUdYzv.png" alt="FantasySage Logo" className="h-16 w-14 shrink-0 sm:h-20 sm:w-16" />
            <div className="min-w-0">
              <h1 className="text-xl font-black uppercase leading-none tracking-wide sm:text-2xl" style={{ color: colors.headingGreen }}>
                FantasySage Draft Command Center
              </h1>
              <p className="mt-1 line-clamp-2 text-xs font-medium sm:text-sm" style={{ color: colors.purple }}>
                Live Sleeper sync, analyst boards, best values, roster build, and draft room context in one no-scroll cockpit.
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[8rem_minmax(0,1fr)_7rem]">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-10" style={{ backgroundColor: colors.darkBlue, borderColor: colors.cardBorder, color: colors.textPrimary }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sleeper">Sleeper</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                type="url"
                placeholder="Paste Sleeper draft URL…"
                value={sleeperUrl}
                onChange={(e) => setSleeperUrl(e.target.value)}
                className="h-10 w-full pr-10"
                style={{ backgroundColor: colors.darkBlue, borderColor: colors.cardBorder, color: colors.textPrimary }}
              />
              {isConnected && <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: colors.headingGreen }} />}
              {error && <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: colors.adpNegative }} />}
            </div>
            <Button
              onClick={handleSync}
              disabled={isSyncDisabled || isManualSyncing || !sleeperUrl.trim()}
              className="h-10 font-bold hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: colors.headingGreen, color: "#000000" }}
            >
              {isManualSyncing ? "Syncing…" : "Sync"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: colors.darkBlue, color: isConnected ? colors.headingGreen : colors.textSecondary }}>
              {isConnected ? "● Connected" : "○ Ready to connect"}
            </span>
            <Button onClick={() => setShowFileManager(!showFileManager)} size="sm" className="h-8 hover:opacity-90" style={{ backgroundColor: colors.headingGreen, color: "#000000" }}>
              {showFileManager ? "Hide Upload" : "Upload CSV"}
            </Button>
            <Button onClick={handleCopyLink} size="sm" className="h-8 px-2 text-xs hover:opacity-90" style={{ backgroundColor: colors.darkBlue, color: colors.textPrimary }}>
              <Copy size={12} className="mr-1" /> Share
            </Button>
            <Button onClick={toggleTheme} size="sm" className="h-8 px-2 text-xs border" style={{ backgroundColor: colors.darkBlue, borderColor: colors.cardBorder, color: colors.textPrimary }}>
              {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
            </Button>
            {showCopiedMessage && <span className="text-xs font-semibold" style={{ color: colors.gold }}>Copied!</span>}
          </div>
        </div>
        {error && <div className="mt-2 rounded-lg p-2 text-sm" style={{ backgroundColor: colors.adpNegative + "20", color: colors.adpNegative }}>{error}</div>}
      </div>

      <div className="rounded-2xl border p-3" style={{ backgroundColor: colors.card, borderColor: colors.lightBorder }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide" style={{ color: colors.headingGreen }}>Analyst board quick switch</h2>
            <p className="text-xs" style={{ color: colors.textSecondary }}>Horizontal, always-visible ranking toggles keep the draft board above the fold.</p>
          </div>
          <div className="hidden gap-2 text-[11px] font-semibold lg:flex" style={{ color: colors.textSecondary }}>
            <span>Resize columns with the handles below.</span>
            <span>Drag/reorder skipped to preserve draft-night muscle memory.</span>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {RANKING_PRESET_GROUPS.map((group) => (
            <section key={group.id} className="rounded-xl border p-2" style={{ borderColor: colors.cardBorder, backgroundColor: colors.darkBlue }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: colors.gold }}>{group.label}</h3>
                  <p className="text-[11px]" style={{ color: colors.textSecondary }}>{group.description}</p>
                </div>
                <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ backgroundColor: `${colors.headingGreen}1f`, color: colors.headingGreen }}>
                  {group.presets.length} boards
                </span>
              </div>
              <div className="grid gap-2 xl:grid-cols-3">
                {group.presets.map((preset) => {
                  const isActive = rankings[activeRankingIndex]?.presetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => loadPreset(preset.id, activeRankingIndex)}
                      className="rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:opacity-95"
                      style={{ borderColor: isActive ? colors.headingGreen : colors.cardBorder, backgroundColor: isActive ? `${colors.headingGreen}1f` : colors.card }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold" style={{ color: colors.textPrimary }}>
                            {preset.analyst} <span className="font-semibold" style={{ color: colors.textSecondary }}>· Updated {preset.updated}</span>
                          </div>
                          <div className="truncate text-[11px]" style={{ color: colors.textSecondary }}>{preset.source}</div>
                          <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.gold }}>
                            {getAccuracyAwardLabel(preset)}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold" style={getAccuracyTypeStyle(preset.accuracyType, colors)}>
                          #{preset.accuracyRank}
                        </span>
                      </div>
                      {preset.accuracyRanks && (
                        <div className="mt-2 grid grid-cols-4 gap-1 text-[10px]">
                          {POSITION_RANKS.map((position) => (
                            <span key={position} className="rounded-md px-1.5 py-1 text-center font-bold" style={{ backgroundColor: colors.darkBlue, color: colors.gold }}>
                              {position} {preset.accuracyRanks?.[position] ?? "—"}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {showFileManager && (
        <div className="rounded-2xl border p-3" style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}>
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
    </header>
  )}
