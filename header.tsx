"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Moon, Sun, Copy, CheckCircle, AlertCircle, Check, ArrowDown, Sparkles, FileUp } from "lucide-react"
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
const QUICK_SWITCH_GROUP_ORDER = ["full-ppr", "best-ball", "half-ppr"]

const getPositionAccuracyStyle = (colors: any) => ({
  backgroundColor: `${colors.headingGreen}18`,
  borderColor: `${colors.headingGreen}88`,
  color: colors.headingGreen,
})

const DEFAULT_PRESET_BY_GROUP: Record<string, string> = {
  "half-ppr": "del-don-half-ppr",
  "best-ball": "underdog-best-ball-june-24",
  "full-ppr": "del-don-full-ppr",
}

const detectScoringGroupFromDraft = (draft: any) => {
  const scoringText = [draft?.metadata?.scoring_type, draft?.settings?.scoring_type, draft?.metadata?.name, draft?.metadata?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const receptionValue = Number(draft?.settings?.rec ?? draft?.settings?.receptions ?? draft?.settings?.rec_yd)

  if (scoringText.includes("half") || scoringText.includes("0.5") || receptionValue === 0.5) return "half-ppr"
  if (scoringText.includes("ppr") || receptionValue >= 1) return "full-ppr"
  return null
}

const extractSleeperDraftId = (url: string) => url.match(/\/draft\/nfl\/(\d+)/)?.[1] || url.match(/sleeper\.com\/draft\/(\d+)/)?.[1] || null

const getAccuracyYear = (preset: any) => preset.accuracyNote?.match(/20\d{2}/)?.[0] || ""

const getAccuracyAwardLabel = (preset: any) => {
  const year = getAccuracyYear(preset)
  const type = preset.accuracyType === "Hybrid" ? "Hybrid accuracy" : `${preset.accuracyType || "Accuracy"} accuracy`
  return year ? `${year} ${type}` : type
}

export function Header({
  theme,
  toggleTheme,
  modernUiEnabled,
  toggleModernUi,
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
  const [selectedScoringGroupId, setSelectedScoringGroupId] = useState("full-ppr")
  const [detectedScoringLabel, setDetectedScoringLabel] = useState("Ready to load a board")
  const activePresetRef = useRef<HTMLButtonElement | null>(null)

  const quickSwitchGroups = useMemo(() => {
    const groupsById = new Map(RANKING_PRESET_GROUPS.map((group) => [group.id, group]))

    return QUICK_SWITCH_GROUP_ORDER.map((groupId) => {
      const group = groupsById.get(groupId)
      if (!group) return null
      return groupId === "best-ball" ? { ...group, label: "Underdog" } : group
    }).filter(Boolean)
  }, [])

  useEffect(() => {
    activePresetRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [rankings, activeRankingIndex, selectedScoringGroupId])

  useEffect(() => {
    const draftId = extractSleeperDraftId(sleeperUrl.trim())
    if (!draftId) {
      setDetectedScoringLabel("Ready to load a board")
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(`https://api.sleeper.com/v1/draft/${draftId}`, { signal: controller.signal })
        if (!res.ok) return
        const draft = await res.json()
        const detectedGroupId = detectScoringGroupFromDraft(draft)
        if (!detectedGroupId) {
          setDetectedScoringLabel("Sleeper format not labeled; keeping current board")
          return
        }

        setSelectedScoringGroupId(detectedGroupId)
        setDetectedScoringLabel(`Sleeper detected ${RANKING_PRESET_GROUPS.find((group) => group.id === detectedGroupId)?.label || "format"}`)
        const activePresetId = rankings[activeRankingIndex]?.presetId
        const activePresetMatchesFormat = RANKING_PRESET_GROUPS.find((group) => group.id === detectedGroupId)?.presets.some((preset) => preset.id === activePresetId)
        const activePresetIsUnderdog = RANKING_PRESET_GROUPS.find((group) => group.id === "best-ball")?.presets.some((preset) => preset.id === activePresetId)
        if (!activePresetMatchesFormat && !activePresetIsUnderdog) loadPreset(DEFAULT_PRESET_BY_GROUP[detectedGroupId], activeRankingIndex)
      } catch (err) {
        if (!controller.signal.aborted) setDetectedScoringLabel("Could not auto-detect yet; keeping current board")
      }
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [activeRankingIndex, loadPreset, rankings, sleeperUrl])


  // Only show connected if we have draft data with actual content and no error
  const isConnected = draftData && draftData.teams && draftData.teams.length > 0 && !error && sleeperUrl.trim()

  return (
    <header className="mb-3 space-y-3">
      <div
        className="modern-surface modern-panel rounded-2xl border p-3 shadow-sm"
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
                Live Sleeper sync, analyst boards, best values, roster build, and draft room context in one scroll-friendly workflow.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border p-2" style={{ backgroundColor: `${colors.headingGreen}14`, borderColor: colors.headingGreen }}>
            <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: `${colors.headingGreen}24`, color: colors.textPrimary }}>
              <ArrowDown size={16} className="shrink-0 animate-bounce" style={{ color: colors.headingGreen }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: colors.headingGreen }}>Start here</p>
                <p className="text-sm font-extrabold leading-tight">Paste your Sleeper draft URL below, then sync.</p>
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
                  id="sleeper-draft-url"
                  aria-label="Sleeper draft URL"
                  placeholder="https://sleeper.com/draft/nfl/1234567890"
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
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border p-2" style={{ backgroundColor: colors.darkBlue, borderColor: colors.cardBorder }}>
            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
              <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: colors.card, color: isConnected ? colors.headingGreen : colors.textSecondary }}>
                {isConnected ? "● Connected" : "○ Ready to connect"}
              </span>
              <Button
                onClick={() => setShowFileManager(!showFileManager)}
                className="h-10 gap-2 px-4 text-sm font-bold hover:opacity-90"
                style={{ backgroundColor: colors.headingGreen, color: "#000000" }}
                aria-expanded={showFileManager}
              >
                <FileUp size={16} /> {showFileManager ? "Hide CSV Upload" : "Upload FantasyPros CSV"}
              </Button>
              <Button onClick={handleCopyLink} size="sm" className="h-10 px-3 text-xs font-bold hover:opacity-90" style={{ backgroundColor: colors.card, color: colors.textPrimary }}>
                <Copy size={14} className="mr-1.5" /> Share
              </Button>
              <Button onClick={toggleModernUi} size="sm" className="h-10 gap-1.5 px-3 text-xs font-bold border" style={{ backgroundColor: modernUiEnabled ? `${colors.purple}30` : colors.card, borderColor: modernUiEnabled ? colors.purple : colors.cardBorder, color: colors.textPrimary }} aria-pressed={modernUiEnabled}>
                <Sparkles size={14} /> {modernUiEnabled ? "Modern On" : "Modern"}
              </Button>
              <Button onClick={toggleTheme} size="sm" className="h-10 px-3 text-xs border" style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.textPrimary }} aria-label="Toggle light or dark theme">
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </Button>
              {showCopiedMessage && <span className="text-xs font-semibold" style={{ color: colors.gold }}>Copied!</span>}
            </div>
            <p className="text-[11px] font-semibold leading-snug xl:text-right" style={{ color: colors.textSecondary }}>
              Custom rankings: download a FantasyPros CSV after choosing specific analysts, then upload it here.
            </p>
          </div>
        </div>
        {error && <div className="mt-2 rounded-lg p-2 text-sm" style={{ backgroundColor: colors.adpNegative + "20", color: colors.adpNegative }}>{error}</div>}
      </div>

      <div className="modern-surface modern-panel rounded-2xl border p-3" style={{ backgroundColor: colors.card, borderColor: colors.lightBorder }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide" style={{ color: colors.headingGreen }}>Analyst board quick switch</h2>
            <p className="text-xs" style={{ color: colors.textSecondary }}>{detectedScoringLabel}; all ranking boards are grouped by format for quick one-screen selection.</p>
          </div>
        </div>
        <div
          className="grid w-full grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)_minmax(0,1fr)]"
          aria-label="Analyst ranking boards grouped by format"
        >
          {quickSwitchGroups.map((group: any) => (
            <section
              key={group.id}
              className="flex min-w-0 flex-col gap-2 rounded-xl border p-2"
              style={{ borderColor: colors.cardBorder, backgroundColor: colors.darkBlue }}
            >
              <div className="flex items-center justify-center rounded-lg px-2 py-1 text-center text-xs font-black uppercase tracking-wide" style={{ backgroundColor: colors.card, color: colors.headingGreen }}>
                {group.label}
              </div>
              <div className={`grid min-w-0 flex-1 grid-cols-1 gap-2 ${group.id === "best-ball" ? "" : "sm:grid-cols-3"}`}>
                {group.presets.map((preset) => {
                  const isActive = rankings[activeRankingIndex]?.presetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      ref={isActive ? activePresetRef : null}
                      onClick={() => {
                        setSelectedScoringGroupId(group.id)
                        setDetectedScoringLabel("Manual board selected")
                        loadPreset(preset.id, activeRankingIndex)
                      }}
                      className="modern-ranking-button flex min-h-[4.4rem] min-w-0 flex-col rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:opacity-95"
                      style={{ borderColor: isActive ? colors.headingGreen : colors.cardBorder, backgroundColor: isActive ? `${colors.headingGreen}20` : colors.card }}
                      aria-pressed={isActive}
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-black uppercase tracking-wide" style={{ color: colors.headingGreen }}>
                          {preset.accuracyType}
                        </span>
                        {isActive && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${colors.headingGreen}30`, color: colors.headingGreen }}>
                            <Check size={14} /> Loaded
                          </span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold sm:text-[15px]" style={{ color: colors.textPrimary }}>
                            {preset.analyst}
                          </div>
                          <div className="truncate text-xs" style={{ color: colors.textSecondary }}>{preset.source} · {preset.updated}</div>
                        </div>
                        <span className="shrink-0 rounded-lg border px-2 py-1 text-xs font-black" style={getAccuracyTypeStyle(preset.accuracyType, colors)}>
                          #{preset.accuracyRank}
                        </span>
                      </div>
                      {preset.accuracyRanks && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          {POSITION_RANKS.map((position) => (
                            <span
                              key={position}
                              className="inline-flex h-6 min-w-8 items-center justify-center rounded-md border px-1.5 text-center font-black leading-none"
                              style={getPositionAccuracyStyle(colors)}
                              title={`${position} accuracy rank`}
                            >
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
        <div className="modern-surface rounded-2xl border p-3" style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}>
          <FileManager
            colors={colors}
            rankings={rankings}
            setRankings={setRankings}
            activeRankingIndex={activeRankingIndex}
            setActiveRankingIndex={setActiveRankingIndex}
            handleFileUpload={handleFileUpload}
            isPapaParseLoaded={isPapaParseLoaded}
          />
        </div>
      )}
    </header>
  )}
