"use client"
import { type WheelEvent, useEffect, useMemo, useRef, useState } from "react"
import { Moon, Sun, Copy, CheckCircle, AlertCircle, Check } from "lucide-react"
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
const QUICK_SWITCH_GROUP_ORDER = ["full-ppr", "half-ppr"]
const UNDERDOG_PASTEL_YELLOW = "#FDE68A"

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
  const presetScrollerRef = useRef<HTMLDivElement | null>(null)
  const activePresetRef = useRef<HTMLButtonElement | null>(null)

  const quickSwitchGroups = useMemo(() => {
    const groupsById = new Map(RANKING_PRESET_GROUPS.map((group) => [group.id, group]))
    const halfPpr = groupsById.get("half-ppr")
    const bestBall = groupsById.get("best-ball")

    return QUICK_SWITCH_GROUP_ORDER.map((groupId) => {
      const group = groupsById.get(groupId)
      if (!group) return null
      if (groupId !== "half-ppr" || !halfPpr || !bestBall) return group

      return {
        ...halfPpr,
        presets: [
          ...halfPpr.presets,
          ...bestBall.presets.map((preset) => ({ ...preset, quickSwitchSubformat: "Best Ball · Underdog" })),
        ],
      }
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
        if (!activePresetMatchesFormat) loadPreset(DEFAULT_PRESET_BY_GROUP[detectedGroupId], activeRankingIndex)
      } catch (err) {
        if (!controller.signal.aborted) setDetectedScoringLabel("Could not auto-detect yet; keeping current board")
      }
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [activeRankingIndex, loadPreset, rankings, sleeperUrl])


  const handlePresetWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!presetScrollerRef.current || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    event.preventDefault()
    presetScrollerRef.current.scrollBy({ left: event.deltaY, behavior: "smooth" })
  }

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
                Live Sleeper sync, analyst boards, best values, roster build, and draft room context in one scroll-friendly workflow.
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide" style={{ color: colors.headingGreen }}>Analyst board quick switch</h2>
            <p className="text-xs" style={{ color: colors.textSecondary }}>{detectedScoringLabel}; swipe horizontally to load compact analyst boards by format.</p>
          </div>
        </div>
        <div
          ref={presetScrollerRef}
          onWheel={handlePresetWheel}
          className="flex flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-2"
          aria-label="Horizontally scrollable analyst ranking boards grouped by format"
        >
          {quickSwitchGroups.map((group: any) => (
            <section
              key={group.id}
              className="flex shrink-0 items-stretch gap-2 rounded-2xl border p-2"
              style={{ borderColor: colors.cardBorder, backgroundColor: colors.darkBlue }}
            >
              <div className="flex min-w-16 items-center justify-center rounded-xl px-2 text-center text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: colors.card, color: colors.headingGreen }}>
                {group.label}
              </div>
              <div className="flex flex-nowrap gap-2">
                {group.presets.map((preset) => {
                  const isActive = rankings[activeRankingIndex]?.presetId === preset.id
                  const isUnderdog = Boolean(preset.quickSwitchSubformat)
                  return (
                    <button
                      key={preset.id}
                      ref={isActive ? activePresetRef : null}
                      onClick={() => {
                        setSelectedScoringGroupId(isUnderdog ? "best-ball" : group.id)
                        setDetectedScoringLabel("Manual board selected")
                        loadPreset(preset.id, activeRankingIndex)
                      }}
                      className="min-h-[4.25rem] w-48 shrink-0 rounded-xl border px-2.5 py-2 text-left transition hover:-translate-y-0.5 hover:opacity-95"
                      style={{ borderColor: isActive ? (isUnderdog ? UNDERDOG_PASTEL_YELLOW : colors.headingGreen) : colors.cardBorder, backgroundColor: isActive ? `${isUnderdog ? UNDERDOG_PASTEL_YELLOW : colors.headingGreen}2b` : colors.card }}
                      aria-pressed={isActive}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-black uppercase tracking-wide" style={{ color: isUnderdog ? "#8A5A00" : colors.headingGreen }}>
                          {isUnderdog ? "Best Ball · Underdog" : preset.accuracyType}
                        </span>
                        {isActive && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${isUnderdog ? UNDERDOG_PASTEL_YELLOW : colors.headingGreen}40`, color: isUnderdog ? "#8A5A00" : colors.headingGreen }}>
                            <Check size={10} /> Loaded
                          </span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold" style={{ color: colors.textPrimary }}>
                            {preset.analyst}
                          </div>
                          <div className="truncate text-[10px]" style={{ color: colors.textSecondary }}>{preset.source} · {preset.updated}</div>
                        </div>
                        <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold" style={getAccuracyTypeStyle(preset.accuracyType, colors)}>
                          #{preset.accuracyRank}
                        </span>
                      </div>
                      {preset.accuracyRanks && (
                        <div className="mt-1.5 flex gap-1 text-[9px]">
                          {POSITION_RANKS.map((position) => (
                            <span key={position} className="rounded-md px-1 py-0.5 text-center font-bold" style={{ backgroundColor: colors.darkBlue, color: colors.textSecondary }}>
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
            isPapaParseLoaded={isPapaParseLoaded}
          />
        </div>
      )}
    </header>
  )}
