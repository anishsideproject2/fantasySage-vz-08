"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Moon, Sun, Copy, CheckCircle, AlertCircle, Check, ArrowDown, FileUp } from "lucide-react"
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
  handleRankingsPaste,
  loadPreset,
  customRankingSets,
  saveLoadedRankingSet,
  loadCustomRankingSet,
  removeCustomRankingSet,
  isPapaParseLoaded,
  platform,
  setPlatform,
  sleeperUrl,
  sleeperUrls = [],
  setSleeperUrl,
  activeSleeperUrlIndex = 0,
  setActiveSleeperUrlIndex,
  autoSwitchSleeperDrafts = true,
  setAutoSwitchSleeperDrafts,
  sleeperUsername = "",
  setSleeperUsername,
  handleSync,
  isManualSyncing,
  isSyncDisabled,
  error,
  handleCopyLink,
  showCopiedMessage,
  draftData,
}) {
  const [showFileManager, setShowFileManager] = useState(false)
  const [detectedScoringGroupId, setDetectedScoringGroupId] = useState<string | null>(null)
  const [detectedScoringLabel, setDetectedScoringLabel] = useState("Ready to load a board")
  const activePresetRef = useRef<HTMLButtonElement | null>(null)

  const updateSleeperUrlAtIndex = (index: number, value: string) => {
    const nextUrls = [sleeperUrls[0] || "", sleeperUrls[1] || ""]
    nextUrls[index] = value
    setSleeperUrl(nextUrls.join("\n"))
  }

  const quickSwitchGroups = useMemo(() => {
    const groupsById = new Map(RANKING_PRESET_GROUPS.map((group) => [group.id, group]))
    const getCustomGroupId = (format = "") => {
      const normalizedFormat = String(format).toLowerCase()
      if (normalizedFormat.includes("best ball") || normalizedFormat.includes("underdog")) return "best-ball"
      if (normalizedFormat.includes("half") || normalizedFormat.includes("0.5")) return "half-ppr"
      return "full-ppr"
    }

    return QUICK_SWITCH_GROUP_ORDER.map((groupId) => {
      const group = groupsById.get(groupId)
      if (!group) return null
      const customPresets = customRankingSets
        .filter((set: any) => getCustomGroupId(set.format) === groupId)
        .map((set: any) => ({ ...set, isCustom: true }))

      return {
        ...group,
        label: groupId === "best-ball" ? "Underdog" : group.label,
        presets: [...group.presets, ...customPresets],
      }
    }).filter(Boolean)
  }, [customRankingSets])

  useEffect(() => {
    activePresetRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [rankings, activeRankingIndex])

  useEffect(() => {
    const draftId = extractSleeperDraftId(sleeperUrl.trim())
    if (!draftId) {
      setDetectedScoringGroupId(null)
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
          setDetectedScoringGroupId(null)
          setDetectedScoringLabel("Sleeper format not labeled; choose any board")
          return
        }

        setDetectedScoringGroupId(detectedGroupId)
        setDetectedScoringLabel(`Sleeper detected ${RANKING_PRESET_GROUPS.find((group) => group.id === detectedGroupId)?.label || "format"}; choose any board`)
      } catch (err) {
        if (!controller.signal.aborted) {
          setDetectedScoringGroupId(null)
          setDetectedScoringLabel("Could not auto-detect yet; choose any board")
        }
      }
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [sleeperUrl])


  // Only show connected if we have draft data with actual content and no error
  const isConnected = draftData && draftData.teams && draftData.teams.length > 0 && !error && sleeperUrl.trim()

  return (
    <header className="mb-3 space-y-3">
      <div
        className="rounded-2xl border p-3 shadow-sm"
        style={{ backgroundColor: colors.card, borderColor: colors.lightBorder, boxShadow: colors.shadow }}
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,0.75fr)_minmax(460px,1.35fr)_minmax(380px,1fr)] xl:items-stretch">
          <div className="flex min-w-0 items-center gap-3">
            <img src="https://imgur.com/TKUdYzv.png" alt="FantasySage Logo" className="h-16 w-14 shrink-0 sm:h-20 sm:w-16" />
            <div className="min-w-0">
              <h1 className="text-xl font-black uppercase leading-none tracking-wide sm:text-2xl" style={{ color: colors.headingGreen }}>
                FantasySage Draft Command Center
              </h1>
              <p className="mt-1 text-xs font-medium leading-snug sm:text-sm" style={{ color: colors.purple }}>
                Live Sleeper sync, analyst boards, best values, roster build, and draft room context in one scroll-friendly workflow.
              </p>
            </div>
          </div>

          <div className="flex h-full flex-col rounded-2xl border p-2" style={{ backgroundColor: `${colors.headingGreen}14`, borderColor: colors.headingGreen }}>
            <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: `${colors.headingGreen}24`, color: colors.textPrimary }}>
              <ArrowDown size={16} className="shrink-0 animate-bounce" style={{ color: colors.headingGreen }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: colors.headingGreen }}>Start here</p>
                <p className="text-sm font-extrabold leading-tight">Paste your Sleeper draft URL, sync, then pick your team from the roster selector.</p>
              </div>
            </div>
            <div className="grid flex-1 gap-2 md:grid-cols-[8rem_minmax(0,1fr)_7rem]">
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
                  id="sleeper-draft-url"
                  aria-label="Sleeper draft URL"
                  placeholder="Sleeper draft URL"
                  value={sleeperUrls[0] || ""}
                  onChange={(e) => updateSleeperUrlAtIndex(0, e.target.value)}
                  className="h-10 w-full pr-10 text-xs"
                  style={{ backgroundColor: colors.darkBlue, borderColor: isConnected ? colors.headingGreen : colors.cardBorder, color: colors.textPrimary }}
                />
                {isConnected && <CheckCircle size={16} className="absolute right-3 top-3" style={{ color: colors.headingGreen }} />}
                {error && <AlertCircle size={16} className="absolute right-3 top-3" style={{ color: colors.adpNegative }} />}
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

          <div className="flex h-full min-w-0 flex-col gap-1.5 rounded-2xl border p-2" style={{ backgroundColor: colors.darkBlue, borderColor: colors.cardBorder }}>
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ backgroundColor: `${colors.purple}20`, color: colors.textPrimary }}>
              <ArrowDown size={16} className="shrink-0 animate-bounce" style={{ color: colors.purple }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: colors.purple }}>Optional</p>
                <p className="text-sm font-extrabold leading-tight">Upload rankings CSV.</p>
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-start gap-2 xl:justify-end">
              <Button
                onClick={() => setShowFileManager(!showFileManager)}
                className="h-10 gap-2 px-4 text-sm font-bold hover:opacity-90"
                style={{ backgroundColor: colors.headingGreen, color: "#000000" }}
                aria-expanded={showFileManager}
              >
                <FileUp size={16} /> {showFileManager ? "Hide CSV upload" : "Upload rankings CSV"}
              </Button>
              <Button onClick={handleCopyLink} size="sm" className="h-10 px-3 text-xs font-bold hover:opacity-90" style={{ backgroundColor: colors.card, color: colors.textPrimary }}>
                <Copy size={14} className="mr-1.5" /> Share
              </Button>
              <Button onClick={toggleTheme} size="sm" className="h-10 px-3 text-xs border" style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.textPrimary }} aria-label="Toggle light or dark theme">
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </Button>
              {showCopiedMessage && <span className="text-xs font-semibold" style={{ color: colors.gold }}>Copied!</span>}
            </div>
            <p className="text-[10px] font-semibold leading-tight xl:text-right" style={{ color: colors.textSecondary }}>
              Custom CSVs welcome. Username optional for auto roster lock.
            </p>
          </div>
        </div>
        {error && <div className="mt-2 rounded-lg p-2 text-sm" style={{ backgroundColor: colors.adpNegative + "20", color: colors.adpNegative }}>{error}</div>}
      </div>

      <div className="rounded-2xl border p-3" style={{ backgroundColor: colors.card, borderColor: colors.lightBorder }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide" style={{ color: colors.headingGreen }}>Analyst board quick switch</h2>
            <p className="text-xs" style={{ color: colors.textSecondary }}>{detectedScoringLabel}; all ranking boards are grouped by format for quick one-screen selection.</p>
          </div>
        </div>
        <div
          className="grid w-full grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)_minmax(0,1fr)]"
          aria-label="Analyst ranking boards grouped by format"
        >
          {quickSwitchGroups.map((group: any) => (
            <section
              key={group.id}
              className="flex h-full min-w-0 flex-col gap-2 rounded-xl border p-2.5"
              style={{ borderColor: colors.cardBorder, backgroundColor: colors.darkBlue }}
            >
              <div
                className="flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-black uppercase tracking-wide"
                style={{
                  backgroundColor: detectedScoringGroupId === group.id ? `${colors.headingGreen}24` : colors.card,
                  border: `1px solid ${detectedScoringGroupId === group.id ? colors.headingGreen : "transparent"}`,
                  color: detectedScoringGroupId === group.id ? colors.headingGreen : colors.textPrimary,
                }}
              >
                <span>{group.label}</span>
                {detectedScoringGroupId === group.id && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: colors.headingGreen, color: "#000000" }}>
                    Detected
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-x-auto pb-1">
                <div className={`grid h-full gap-2 ${group.id === "best-ball" ? "min-w-0 grid-cols-1" : "min-w-max grid-flow-col auto-cols-[minmax(13rem,1fr)] sm:auto-cols-[minmax(13rem,31%)]"}`}>
                  {group.presets.map((preset) => {
                    const isActive = preset.isCustom
                      ? rankings[activeRankingIndex]?.customSetId === preset.id
                      : rankings[activeRankingIndex]?.presetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        ref={isActive ? activePresetRef : null}
                        onClick={() => {
                          setDetectedScoringLabel(detectedScoringGroupId ? `${RANKING_PRESET_GROUPS.find((detectedGroup) => detectedGroup.id === detectedScoringGroupId)?.label || "Format"} detected; manual board selected` : "Manual board selected")
                          if (preset.isCustom) {
                            loadCustomRankingSet(preset.id, activeRankingIndex)
                          } else {
                            loadPreset(preset.id, activeRankingIndex)
                          }
                        }}
                        className={`flex min-w-0 flex-col overflow-hidden rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:opacity-95 ${group.id === "best-ball" ? "h-full min-h-24 w-full justify-between" : "h-[5.75rem]"}`}
                        style={{ borderColor: isActive ? colors.headingGreen : colors.cardBorder, backgroundColor: isActive ? `${colors.headingGreen}20` : colors.card }}
                        aria-pressed={isActive}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-black uppercase tracking-wide" style={{ color: colors.headingGreen }}>
                            {preset.isCustom ? "Custom" : preset.accuracyType}
                          </span>
                          {isActive && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${colors.headingGreen}30`, color: colors.headingGreen }}>
                              <Check size={12} /> Loaded
                            </span>
                          )}
                        </div>
                        <div className="flex min-h-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold leading-snug" style={{ color: colors.textPrimary }}>
                              {preset.analyst}
                            </div>
                            <div className="truncate text-[11px] leading-snug" style={{ color: colors.textSecondary }}>{preset.isCustom ? `${preset.format} · Updated ${preset.updated} · ${preset.playerCount} players` : `${preset.source} · ${preset.updated}`}</div>
                          </div>
                          <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-black" style={getAccuracyTypeStyle(preset.isCustom ? "Draft" : preset.accuracyType, colors)}>
                            {preset.isCustom ? "Mine" : `#${preset.accuracyRank}`}
                          </span>
                        </div>
                        {preset.accuracyRanks && (
                          <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-[9px]">
                            {POSITION_RANKS.map((position) => (
                              <span
                                key={position}
                                className="inline-flex h-5 min-w-0 items-center justify-center rounded border px-1 text-center font-black leading-none"
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
            handleRankingsPaste={handleRankingsPaste}
            customRankingSets={customRankingSets}
            saveLoadedRankingSet={saveLoadedRankingSet}
            loadCustomRankingSet={loadCustomRankingSet}
            removeCustomRankingSet={removeCustomRankingSet}
            isPapaParseLoaded={isPapaParseLoaded}
            draftData={draftData}
          />
        </div>
      )}
    </header>
  )}
