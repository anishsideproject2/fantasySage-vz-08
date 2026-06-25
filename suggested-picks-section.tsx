"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BubbleSymbol } from "./bubble-symbol"
import { getOcTendencyImpact, getOcTendencySummary, getPlayerNote, getTeamOcVariance, normalizeTeamAbbr } from "./draft-strategy"
import { PLAYER_NOTES, getPlayerNoteId, buildWhyNote, FORMAT_TAG_BOOSTS } from "./src/data/playerNotes"


const getPlayerNameParts = (player) => {
  const firstName = player.first_name || player.firstName || String(player.name || "").trim().split(/\s+/)[0] || ""
  const lastName = player.last_name || player.lastName || String(player.name || "").trim().split(/\s+/).slice(1).join(" ") || ""
  return { firstName, lastName }
}

const getPlayerIntelligenceNote = (player) => {
  const { firstName, lastName } = getPlayerNameParts(player)
  const noteId = getPlayerNoteId(firstName, lastName, player.team)
  return (PLAYER_NOTES as Record<string, any>)[noteId] ?? null
}

const getLeagueFormatKey = (scoringFormat) => {
  if (scoringFormat === "Half PPR") return "half_ppr"
  if (scoringFormat === "Standard") return "standard"
  return "ppr"
}

const computeResearchScore = ({ note, existingBaseResearch, playerValueVsAdp, leagueFormat }) => {
  let score = existingBaseResearch ?? 50
  if (!note) return score

  score += (Number(note.opportunity || 0) / 100) * 8
  let confidenceMultiplier = Number(note.confidence || 100) / 100
  if (note.risk_flag) confidenceMultiplier *= 0.7
  score *= confidenceMultiplier

  if (note.sleeper && playerValueVsAdp > 10) score += 6

  const formatBoost = FORMAT_TAG_BOOSTS[leagueFormat]
  if (formatBoost && Array.isArray(note.tags) && note.tags.some((tag) => formatBoost.tags.includes(tag))) {
    score += formatBoost.boost
  }

  return Math.min(Math.round(score), 100)
}

const FLEX_POSITIONS = ["RB", "WR", "TE"]
const BENCH_TARGET_POSITIONS = ["RB", "WR"]
const CORE_STARTER_POSITIONS = ["RB", "WR", "TE"]

const getScoringFormatFromSettings = (draftData, settings = {}) => {
  const rawFormat = String(
    draftData?.scoringFormat || settings.scoring_type || settings.type || settings.reception_type || settings.ppr || settings.rec || "",
  ).toLowerCase()
  const rec = Number(settings.rec ?? settings.receptions ?? settings.points_per_reception)

  if (rawFormat.includes("half") || rawFormat === "0.5" || rec === 0.5) return "Half PPR"
  if (rawFormat.includes("ppr") || rawFormat === "1" || rec >= 1) return "Full PPR"
  if (rawFormat.includes("standard") || rawFormat === "0" || rec === 0) return "Standard"
  return "Format unknown"
}

const getFormatAwareRank = (player, scoringFormat) => {
  if (scoringFormat === "Full PPR") return Number.parseFloat(player.pprRank ?? player.pprAdp ?? player.expertRank ?? player.adp)
  if (scoringFormat === "Half PPR") return Number.parseFloat(player.halfPprRank ?? player.halfPprAdp ?? player.expertRank ?? player.adp)
  if (scoringFormat === "Standard") return Number.parseFloat(player.standardRank ?? player.standardAdp ?? player.expertRank ?? player.adp)
  return Number.parseFloat(player.expertRank ?? player.adp)
}

const getTierCliff = (player, available, scoringFormat) => {
  const samePosition = available
    .filter((candidate) => candidate.position === player.position)
    .sort((a, b) => getFormatAwareRank(a, scoringFormat) - getFormatAwareRank(b, scoringFormat))
  const index = samePosition.findIndex((candidate) => candidate.id === player.id)
  const nextPlayers = samePosition.slice(index + 1, index + 4)
  if (index < 0 || nextPlayers.length === 0) return { bonus: 0, gap: 0, nextName: null }

  const rank = getFormatAwareRank(player, scoringFormat)
  const next = nextPlayers[0]
  const nextRank = getFormatAwareRank(next, scoringFormat)
  const immediateGap = Number.isNaN(rank) || Number.isNaN(nextRank) ? 0 : nextRank - rank
  const averageGap = nextPlayers.reduce((sum, candidate) => {
    const candidateRank = getFormatAwareRank(candidate, scoringFormat)
    return Number.isNaN(candidateRank) || Number.isNaN(rank) ? sum : sum + (candidateRank - rank)
  }, 0) / nextPlayers.length
  const formatMultiplier = scoringFormat === "Standard" && player.position === "RB" ? 1.2 : scoringFormat === "Full PPR" && ["WR", "TE"].includes(player.position) ? 1.15 : 1
  const weightedGap = Math.max(immediateGap, averageGap * 0.7) * formatMultiplier

  return {
    bonus: weightedGap >= 10 ? 5 : weightedGap >= 7 ? 3 : weightedGap >= 4.5 ? 1.5 : 0,
    gap: Number(weightedGap.toFixed(1)),
    nextName: next?.name || null,
  }
}




const getReplacementBaselines = (numTeams = 12) => {
  const teams = Number(numTeams) || 12
  if (teams <= 10) return { QB: 11, RB: 21, WR: 31, TE: 11 }
  if (teams >= 14) return { QB: 15, RB: 29, WR: 43, TE: 15 }
  return { QB: 13, RB: 25, WR: 37, TE: 13 }
}

const getProjectedPoints = (player, scoringFormat) => {
  const explicit = Number.parseFloat(player.projectedPoints ?? player.projection ?? player.points ?? player.fpts)
  if (!Number.isNaN(explicit)) return explicit
  const rank = getFormatAwareRank(player, scoringFormat)
  const safeRank = Number.isNaN(rank) ? Number.parseFloat(player.adp) || 200 : rank
  const position = String(player.position || "").toUpperCase()
  const base = position === "QB" ? 330 : position === "TE" ? 190 : position === "RB" ? 260 : 250
  const slope = position === "QB" ? 3.1 : position === "TE" ? 1.25 : 1.55
  return Math.max(base - safeRank * slope, 20)
}

const getReplacementSnapshot = ({ playerPool, scoringFormat, numTeams }) => {
  const baselines = getReplacementBaselines(numTeams)
  return Object.fromEntries(Object.entries(baselines).map(([position, baselineRank]) => {
    const sorted = playerPool
      .filter((player) => player.position === position)
      .map((player) => ({ ...player, projected: getProjectedPoints(player, scoringFormat) }))
      .sort((a, b) => b.projected - a.projected)
    const replacement = sorted[Math.min(Math.max(baselineRank - 1, 0), Math.max(sorted.length - 1, 0))]
    return [position, { projected: replacement?.projected || 0, baselineRank, playerName: replacement?.name || "replacement" }]
  }))
}

const getPicksUntilNextTurn = ({ currentPick, selectedTeamRosterId, numTeams = 12 }) => {
  const pick = Number(currentPick) || 1
  const teams = Number(numTeams) || 12
  const slot = Number(selectedTeamRosterId)
  if (!slot || slot < 1 || slot > teams) return teams
  for (let offset = 1; offset <= teams * 2; offset += 1) {
    const nextPick = pick + offset
    const round = Math.ceil(nextPick / teams)
    const pickInRound = ((nextPick - 1) % teams) + 1
    const rosterIdOnClock = round % 2 === 1 ? pickInRound : teams - pickInRound + 1
    if (rosterIdOnClock === slot) return offset
  }
  return teams
}

const getVbdProfile = ({ player, availablePlayers, scoringFormat, replacementSnapshot, picksUntilNextTurn, starterTargets, flexSlots }) => {
  const position = player.position
  const projected = getProjectedPoints(player, scoringFormat)
  const replacement = replacementSnapshot[position] || { projected: 0, playerName: "replacement" }
  const vorp = projected - replacement.projected
  const samePosition = availablePlayers
    .filter((candidate) => candidate.position === position)
    .map((candidate) => ({ ...candidate, projected: getProjectedPoints(candidate, scoringFormat) }))
    .sort((a, b) => b.projected - a.projected)
  const nextAvailable = samePosition[Math.min(Math.max(picksUntilNextTurn, 1), Math.max(samePosition.length - 1, 0))]
  const nextVorp = nextAvailable ? nextAvailable.projected - replacement.projected : 0
  const vona = vorp - nextVorp
  const starterRank = position === "QB"
    ? starterTargets.QB
    : position === "TE"
      ? starterTargets.TE
      : position === "RB"
        ? starterTargets.RB + Math.ceil(flexSlots / 2)
        : starterTargets.WR + Math.floor(flexSlots / 2)
  const lastStarter = samePosition[Math.min(Math.max(starterRank - 1, 0), Math.max(samePosition.length - 1, 0))]
  const vols = projected - (lastStarter?.projected || replacement.projected)
  return {
    projected: Number(projected.toFixed(1)),
    replacementPoints: Number(replacement.projected.toFixed(1)),
    replacementPlayer: replacement.playerName,
    vorp: Number(vorp.toFixed(1)),
    vona: Number(vona.toFixed(1)),
    vols: Number(vols.toFixed(1)),
    nextAvailableName: nextAvailable?.name || "none",
  }
}

const getLiveScarcityProfile = ({ position, availablePlayers, draftedPlayers, replacementSnapshot, draftData, scoringFormat }) => {
  const replacementPoints = replacementSnapshot[position]?.projected || 0
  const aboveReplacement = availablePlayers.filter((player) => player.position === position && getProjectedPoints(player, scoringFormat) >= replacementPoints).length
  const teams = Number(draftData?.numTeams) || 12
  const positionNeedTarget = position === "QB" || position === "TE" ? 1 : position === "RB" ? 2 : 2
  const rosterCounts = draftedPlayers.reduce((acc, pick) => {
    const rosterId = String(pick.roster_id || "")
    if (!rosterId) return acc
    if (!acc[rosterId]) acc[rosterId] = { QB: 0, RB: 0, WR: 0, TE: 0 }
    if (acc[rosterId][pick.position] !== undefined) acc[rosterId][pick.position] += 1
    return acc
  }, {})
  const teamsStillNeeding = Array.from({ length: teams }, (_, index) => String(index + 1)).filter((rosterId) => (rosterCounts[rosterId]?.[position] || 0) < positionNeedTarget).length
  const score = aboveReplacement > 0 ? teamsStillNeeding / aboveReplacement : teamsStillNeeding
  return {
    aboveReplacement,
    teamsStillNeeding,
    score: Number(score.toFixed(2)),
    high: score >= 1,
    message: `${teamsStillNeeding} teams still need ${position}; ${aboveReplacement} above-replacement options remain.`,
  }
}

const getRosterHealth = ({ rosterCounts, starterTargets, flexSlots, scoringFormat, strategyKey }) => {
  const starterPositions = ["QB", "RB", "WR", "TE"]
  const positionCoverage = starterPositions.reduce((sum, position) => sum + Math.min(rosterCounts[position] || 0, starterTargets[position] || 0) * 10, 0)
  const flexEligibleCount = FLEX_POSITIONS.reduce((sum, position) => sum + (rosterCounts[position] || 0), 0)
  const flexTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
  const flexCoverage = flexEligibleCount > starterTargets.RB + starterTargets.WR + starterTargets.TE ? 5 : 0
  const formatFit = scoringFormat === "Standard"
    ? Math.min((rosterCounts.RB || 0) * 8, 30)
    : Math.min(((rosterCounts.WR || 0) + (rosterCounts.TE || 0)) * 7 + (rosterCounts.RB || 0) * 3, 30)
  const strategyAdherence = strategyKey === "zero-rb" && (rosterCounts.RB || 0) === 0 ? 18 : strategyKey?.includes("hero") && (rosterCounts.RB || 0) >= 1 ? 18 : 14
  const depth = flexEligibleCount >= flexTarget ? 5 : 0
  const score = Math.round(Math.min(positionCoverage + flexCoverage + formatFit + strategyAdherence + depth, 100))
  const weakest = starterPositions
    .map((position) => ({ position, missing: Math.max((starterTargets[position] || 0) - (rosterCounts[position] || 0), 0) }))
    .sort((a, b) => b.missing - a.missing)[0]
  return { score, message: weakest?.missing > 0 ? `${weakest.position} needs starter depth` : "Starters stable; shift toward bench value", formatFit, strategyAdherence }
}

const ANALYST_CONTEXT = {
  default: {
    analyst: "FantasyPros consensus",
    fact: "Player-specific note not curated yet; use the value, roster-fit, ADP, and tier signals above as the primary recommendation.",
    whyHigh: "The analyst case should come from role, efficiency, team environment, and price—not from a generic ranking bucket.",
    source: "FantasyPros consensus rankings",
    url: "https://www.fantasypros.com/nfl/rankings/",
  },
  RB: {
    analyst: "FantasyPros consensus",
    fact: "Running backs move up when they combine projected touches, receiving work, and paths to goal-line usage.",
    whyHigh: "Analysts are usually buying volume fragility at the position: one clearer workload can separate quickly from committee backs.",
    source: "FantasyPros RB rankings",
    url: "https://www.fantasypros.com/nfl/rankings/rb-cheatsheets.php",
  },
  WR: {
    analyst: "FantasyPros consensus",
    fact: "Receivers move up when target share, route participation, and quarterback environment point to repeatable volume.",
    whyHigh: "Analysts are usually betting on target earning and weekly ceiling rather than simply saying the player is highly ranked.",
    source: "FantasyPros WR rankings",
    url: "https://www.fantasypros.com/nfl/rankings/wr-cheatsheets.php",
  },
  TE: {
    analyst: "FantasyPros consensus",
    fact: "Tight ends move up when they project as real pass-game options instead of touchdown-only streamers.",
    whyHigh: "Analysts are buying positional leverage when a TE can command WR-like targets at a thinner position.",
    source: "FantasyPros TE rankings",
    url: "https://www.fantasypros.com/nfl/rankings/te-cheatsheets.php",
  },
  QB: {
    analyst: "FantasyPros consensus",
    fact: "Quarterbacks move up when rushing, elite efficiency, or stacked offensive context creates a weekly edge over the deep QB pool.",
    whyHigh: "Analysts are paying for separator traits only when they are likely to beat replacement-level quarterback production.",
    source: "FantasyPros QB rankings",
    url: "https://www.fantasypros.com/nfl/rankings/qb-cheatsheets.php",
  },
}


const PLAYER_TAGS = {
  RB: ["WORKHORSE"],
  WR: ["TARGET_HOG"],
  TE: ["RECEIVING_TE"],
  QB: ["POCKET_PASSER"],
}

const TAG_ADJUSTMENTS = {
  Standard: { PASS_CATCHER: 0, WORKHORSE: 10, COMMITTEE: -5, GOAL_LINE: 10, SLOT: 0, TARGET_HOG: 2, OUTSIDE_X: 5, ELITE_TE: 5, DUAL_THREAT: 10 },
  "Half PPR": { PASS_CATCHER: 8, WORKHORSE: 8, COMMITTEE: -3, GOAL_LINE: -5, SLOT: 5, TARGET_HOG: 7, OUTSIDE_X: 2, ELITE_TE: 8, DUAL_THREAT: 8 },
  "Full PPR": { PASS_CATCHER: 16, WORKHORSE: 5, COMMITTEE: -2, GOAL_LINE: -15, SLOT: 12, TARGET_HOG: 14, OUTSIDE_X: 0, ELITE_TE: 12, DUAL_THREAT: 5 },
}

const getPlayerTags = (player) => {
  const tags = new Set(PLAYER_TAGS[player.position] || [])
  const text = `${player.tags || ""} ${player.notes || ""} ${player.playerNote || ""}`.toUpperCase()
  if (player.position === "RB") {
    if (/PASS|CATCH|RECEIV|TARGET|3-?DOWN/.test(text)) tags.add("PASS_CATCHER")
    if (/COMMITTEE|SPLIT/.test(text)) tags.add("COMMITTEE")
    if (/HANDCUFF|BACKUP/.test(text)) tags.add("HANDCUFF")
    if (/GOAL|TD|TOUCHDOWN/.test(text)) tags.add("GOAL_LINE")
    if (/LOTTERY|UPSIDE|CONTINGENT/.test(text)) tags.add("LOTTERY")
  }
  if (player.position === "WR") {
    if (/SLOT/.test(text)) tags.add("SLOT")
    if (/X|OUTSIDE|DEEP|YPR/.test(text)) tags.add("OUTSIDE_X")
    if (/RED.?ZONE|TD|TOUCHDOWN/.test(text)) tags.add("RED_ZONE_WR")
    if (/SPEED|DEEP/.test(text)) tags.add("SPEEDSTER")
  }
  if (player.position === "QB" && /RUSH|DUAL|MOBILE/.test(text)) tags.add("DUAL_THREAT")
  if (player.position === "TE" && Number.parseFloat(player.adp) <= 60) tags.add("ELITE_TE")
  return Array.from(tags)
}

const getTagFormatAdjustment = (tags, scoringFormat) => {
  const matrix = TAG_ADJUSTMENTS[scoringFormat] || TAG_ADJUSTMENTS["Half PPR"]
  return tags.reduce((sum, tag) => sum + (matrix[tag] || 0), 0)
}

const getValueLabel = (valueGap) => {
  if (valueGap >= 20) return "Elite Value"
  if (valueGap >= 10) return "Strong Value"
  if (valueGap >= 1) return "Slight Value"
  if (valueGap === 0) return "On ADP"
  if (valueGap >= -9) return "Slight Reach"
  if (valueGap >= -19) return "Reach"
  return "Hard Reach"
}

const getRunAlert = (draftedPlayers = []) => {
  const recent = [...draftedPlayers].sort((a, b) => Number(b.pick_no || 0) - Number(a.pick_no || 0)).slice(0, 5)
  const counts = recent.reduce((acc, pick) => {
    const pos = String(pick.position || "").toUpperCase()
    if (pos) acc[pos] = (acc[pos] || 0) + 1
    return acc
  }, {})
  const [position] = Object.entries(counts).find(([, count]) => count >= 3) || []
  return position ? { position, message: `${position} run in progress — consider joining or identifying next value.` } : null
}


const normalizeNameKey = (name) => String(name || "").replace(/\bKenny\s+Gainwell\b/i, "Kenneth Gainwell").toLowerCase().replace(/(\s|,)+(jr\.?|sr\.?|ii|iii|iv|v)\b/g, "").replace(/[^a-z]/g, "")

const PLAYER_TIERS_2026 = {
  jahmyrgibbs: { tier: "RB Tier 1", bonus: 8 }, bijanrobinson: { tier: "RB Tier 1", bonus: 8 },
  saquonbarkley: { tier: "RB Tier 2", bonus: 6 }, christianmccaffrey: { tier: "RB Tier 2", bonus: 6 }, jonathantaylor: { tier: "RB Tier 2", bonus: 6 }, devonachane: { tier: "RB Tier 2", bonus: 6 },
  jamescook: { tier: "RB Tier 3", bonus: 4 }, chasebrown: { tier: "RB Tier 3", bonus: 4 }, omarionhampton: { tier: "RB Tier 3", bonus: 4 }, ashtonjeanty: { tier: "RB Tier 3", bonus: 4 }, kennethwalker: { tier: "RB Tier 3", bonus: 4 },
  derrickhenry: { tier: "RB Tier 4", bonus: 1 }, dandreswift: { tier: "RB Tier 4", bonus: 1 }, treveyonhenderson: { tier: "RB Tier 4", bonus: 1 }, buckyirving: { tier: "RB Tier 4", bonus: 1 },
  javontewilliams: { tier: "RB Tier 5", bonus: -1 }, quinshonjudkins: { tier: "RB Tier 5", bonus: -1 }, bhayshultuten: { tier: "RB Tier 5", bonus: 3 }, jaydonblue: { tier: "RB Tier 5", bonus: -1 },
  pukanacua: { tier: "WR Tier 1", bonus: 8 }, jaxonsmithnjigba: { tier: "WR Tier 1", bonus: 8 }, amonrastbrown: { tier: "WR Tier 1", bonus: 8 }, jamarrchase: { tier: "WR Tier 1", bonus: 8 },
  justinjefferson: { tier: "WR Tier 2", bonus: 6 }, drakelondon: { tier: "WR Tier 2", bonus: 6 }, ceedeelamb: { tier: "WR Tier 2", bonus: 6 }, ajbrown: { tier: "WR Tier 2", bonus: 6 },
  maliknabers: { tier: "WR Tier 3", bonus: 4 }, zayflowers: { tier: "WR Tier 3", bonus: 4 }, teehiggins: { tier: "WR Tier 3", bonus: 4 }, nicocollins: { tier: "WR Tier 3", bonus: 4 }, georgepickens: { tier: "WR Tier 3", bonus: 4 },
  rasheerice: { tier: "WR Tier 4", bonus: 1 }, garrettwilson: { tier: "WR Tier 4", bonus: 1 }, chrisolave: { tier: "WR Tier 4", bonus: 1 }, devontasmith: { tier: "WR Tier 4", bonus: 1 },
  jaylenwaddle: { tier: "WR Tier 5", bonus: 4 }, mikeevans: { tier: "WR Tier 5", bonus: 4 }, christianwatson: { tier: "WR Tier 5", bonus: 4 }, carnelltate: { tier: "WR Tier 5", bonus: 4 }, jordyntyson: { tier: "WR Tier 5", bonus: 4 },
  joshallen: { tier: "QB Tier 1", bonus: 6 }, lamarjackson: { tier: "QB Tier 2", bonus: 3 }, drakemaye: { tier: "QB Tier 2", bonus: 4 }, jaydendaniels: { tier: "QB Tier 2", bonus: 3 }, jalenhurts: { tier: "QB Tier 2", bonus: 3 },
  brockbowers: { tier: "TE Tier 1", bonus: 7 }, samlaporta: { tier: "TE Tier 2", bonus: 3 }, colstonloveland: { tier: "TE Tier 2", bonus: 4 }, tylerwarren: { tier: "TE Tier 2", bonus: 4 },
}

const METRIC_OVERRIDES_2026 = {
  rickypearsall: { targetShare: 18, airYardShare: 32, snapShare: 72, tprr: 0.19, firstReadShare: 15, redZoneShare: 12 },
  adonaimitchell: { targetShare: 16, airYardShare: 28, snapShare: 63, tprr: 0.18, firstReadShare: 13, redZoneShare: 11 },
  parkerwashington: { targetShare: 19, airYardShare: 28, snapShare: 68, tprr: 0.20, firstReadShare: 16, redZoneShare: 14 },
  xavierworthy: { targetShare: 18, airYardShare: 27, snapShare: 70, tprr: 0.19, firstReadShare: 15, redZoneShare: 16 },
  jaydenhiggins: { targetShare: 19, airYardShare: 20, snapShare: 74, tprr: 0.21, firstReadShare: 17, redZoneShare: 22 },
  joshdowns: { targetShare: 24, airYardShare: 16, snapShare: 80, tprr: 0.24, firstReadShare: 19, redZoneShare: 12 },
  kennethgainwell: { targetShare: 15, airYardShare: 4, snapShare: 48, tprr: 0.22, firstReadShare: 12, redZoneShare: 10 },
  bhayshultuten: { targetShare: 9, airYardShare: 3, snapShare: 62, tprr: 0.12, ypc: 4.2, redZoneShare: 17, rushShare: 48 },
  camward: { targetShare: 0, airYardShare: 0, snapShare: 100, tprr: 0, redZoneShare: 0 },
  tylershough: { targetShare: 0, airYardShare: 0, snapShare: 100, tprr: 0, redZoneShare: 0 },
  colstonloveland: { targetShare: 18, airYardShare: 17, snapShare: 76, tprr: 0.23, firstReadShare: 26, redZoneShare: 26 },
}

const CATEGORY_FLAGS_2026 = {
  bhayshultuten: { type: "SLEEPER", bonus: 8, detail: "Etienne departure/role-cleared Year 2 RB profile." },
  tylershough: { type: "SLEEPER", bonus: 8, detail: "Kellen Moore pace offense and Year 2 continuity." },
  kennethgainwell: { type: "SLEEPER", bonus: 8, detail: "73-catch receiving-back profile in an RB-target-friendly offense." },
  jonathanbrooks: { type: "SLEEPER", bonus: 8, detail: "Late-round contingent RB with pedigree and role upside." },
  jonathonbrooks: { type: "SLEEPER", bonus: 8, detail: "Late-round contingent RB with pedigree and role upside." },
  jaydenhiggins: { type: "BREAKOUT WATCH", bonus: 6, detail: "Year 2 WR with red-zone usage and a clear WR2 path." },
  joshdowns: { type: "BREAKOUT WATCH", bonus: 6, detail: "24% target rate and rising snap share signal target-earning upside." },
  camward: { type: "BREAKOUT WATCH", bonus: 6, detail: "Year 2 QB with Daboll scheme-upgrade upside." },
  tetairoamcmillan: { type: "BREAKOUT WATCH", bonus: 6, detail: "Year 2 WR rebound profile after injury-disrupted rookie season." },
  carnelltate: { type: "BREAKOUT WATCH", bonus: 6, detail: "Rookie/young WR archetype with a path to early targets." },
  colstonloveland: { type: "BREAKOUT WATCH", bonus: 6, detail: "Year 2 TE with red-zone first-read usage." },
  samdarnold: { type: "BUST RISK", bonus: -20, detail: "Run-first environment, turnover risk, and limited rushing floor." },
  bakermayfield: { type: "BUST RISK", bonus: -20, detail: "Fourth OC in four years and receiver-room regression risk." },
  derrickhenry: { type: "MILD BUST", bonus: -10, detail: "Age-32 RB with efficiency and rushing-environment concerns." },
  joshjacobs: { type: "MILD BUST", bonus: -10, detail: "Off-field uncertainty and value fragility." },
  lamarjackson: { type: "MILD BUST", bonus: -10, detail: "Rushing-use trend lowers the old QB1 rushing floor." },
  rasheerice: { type: "HIGH RISK/HIGH REWARD", bonus: -8, detail: "Legal/suspension range creates a wide outcome band." },
}

const AIR_YARDS_LOTTERY = new Set(["rickypearsall", "adonaimitchell", "parkerwashington", "xavierworthy", "jaydenhiggins", "keoncoleman", "darnellmooney", "quentinjohnston", "jalencoker"])
const REAL_LIFE_WR2_DISCOUNTS = new Set(["jamesonwilliams", "romeodunze", "marvinharrison", "jordyntyson", "parkerwashington", "courtlandsutton", "makailemon", "chrisgodwin", "jaydenreed", "michaelpittman", "jordanaddison", "jakobimeyers", "quentinjohnston", "rickypearsall", "joshdowns", "wandalerobinson", "xavierworthy", "romeodoubs", "jaydenhiggins", "khalilshakir"])

const SCHEME_INTEL_2026 = {
  DAL: { pace: 66, paRate: 16, motionRate: 45, rzProe: 0, olGrade: 70, badges: ["Fast Pace"] },
  NO: { pace: 66, paRate: 17, motionRate: 48, rzProe: -9, olGrade: 57, badges: ["Fast Pace", "Kellen Moore"] },
  DET: { pace: 62, paRate: 17, motionRate: 50, rzProe: 6, olGrade: 78, badges: ["Above Avg Pace", "Strong OL"] },
  BUF: { pace: 62, paRate: 16, motionRate: 46, rzProe: 2, olGrade: 70, badges: ["Above Avg Pace"] },
  HOU: { pace: 61, paRate: 16, motionRate: 44, rzProe: 1, olGrade: 66, badges: ["Above Avg Pace"] },
  SEA: { pace: 50, paRate: 15, motionRate: 58, rzProe: -9, olGrade: 62, badges: ["Run Heavy", "High Motion"] },
  WAS: { pace: 50, paRate: 14, motionRate: 44, rzProe: -13, olGrade: 64, badges: ["Run Heavy Red Zone"] },
  LAR: { pace: 59, paRate: 21.3, motionRate: 65, rzProe: 2, olGrade: 69, badges: ["Play Action Offense", "High Motion"] },
  ARI: { pace: 58, paRate: 20, motionRate: 52, rzProe: 1, olGrade: 64, badges: ["Play Action Offense"] },
  KC: { pace: 59, paRate: 20, motionRate: 50, rzProe: 6, olGrade: 71, badges: ["Play Action Offense", "Pass Heavy RZ"] },
  GB: { pace: 58, paRate: 18, motionRate: 62, rzProe: 1, olGrade: 70, badges: ["High Motion"] },
  BAL: { pace: 57, paRate: 18, motionRate: 48, rzProe: -12.5, olGrade: 72, badges: ["Run Heavy Red Zone"] },
  CIN: { pace: 59, paRate: 16, motionRate: 43, rzProe: 6, olGrade: 65, badges: ["Pass Heavy RZ"] },
  MIA: { pace: 58, paRate: 18, motionRate: 54, rzProe: 6, olGrade: 63, badges: ["Pass Heavy RZ", "New Scheme"] },
  PHI: { pace: 57, paRate: 17, motionRate: 55, rzProe: -1, olGrade: 82, badges: ["High Motion", "Strong OL"] },
  SF: { pace: 58, paRate: 18, motionRate: 54, rzProe: 1, olGrade: 77, badges: ["Strong OL"] },
  CLE: { pace: 57, paRate: 18, motionRate: 46, rzProe: 1, olGrade: 54, badges: ["New Scheme", "Weak OL"] },
  TEN: { pace: 58, paRate: 17, motionRate: 47, rzProe: 0, olGrade: 60, badges: ["Scheme Upgrade"] },
  LV: { pace: 58, paRate: 17, motionRate: 56, rzProe: 1, olGrade: 64, badges: ["New Scheme", "High Motion"] },
}

const toMetric = (player, keys, fallback = 0) => {
  for (const key of keys) {
    const raw = player[key]
    const parsed = Number.parseFloat(raw)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

const getPlayerMetrics = (player) => {
  const key = normalizeNameKey(player.name)
  const override = METRIC_OVERRIDES_2026[key] || {}
  return {
    targetShare: toMetric(player, ["targetShare", "target_share", "targetSharePct"], override.targetShare ?? 12),
    airYardShare: toMetric(player, ["airYardShare", "air_yard_share", "airYardsShare"], override.airYardShare ?? 12),
    snapShare: toMetric(player, ["snapShare", "snap_share", "snapSharePct"], override.snapShare ?? (player.position === "RB" ? 45 : 65)),
    tprr: toMetric(player, ["tprr", "targetsPerRouteRun"], override.tprr ?? 0.15),
    firstReadShare: toMetric(player, ["firstReadShare", "first_read_share"], override.firstReadShare ?? 10),
    redZoneShare: toMetric(player, ["redZoneShare", "red_zone_share", "rzShare"], override.redZoneShare ?? 10),
    rushShare: toMetric(player, ["rushShare", "rush_share"], override.rushShare ?? 35),
    ypc: toMetric(player, ["ypc", "yardsPerCarry"], override.ypc ?? 4.0),
  }
}

const scalePct = (value, elite) => clamp((Number(value) / elite) * 100, 0, 100)

const getOpportunityProfile = (player, scoringFormat) => {
  const metrics = getPlayerMetrics(player)
  const isRb = player.position === "RB"
  const volume = isRb ? scalePct(metrics.rushShare, 65) : scalePct(metrics.targetShare, 28)
  const field = isRb ? scalePct(metrics.snapShare, 70) : scalePct(metrics.airYardShare, 30)
  const efficiency = isRb ? scalePct(metrics.ypc, 5.2) : scalePct(metrics.tprr, 0.28)
  const redZone = scalePct(metrics.redZoneShare, 24)
  const firstRead = isRb ? 50 : scalePct(metrics.firstReadShare, 22)
  const score = Math.round(clamp(volume * 0.35 + field * 0.20 + efficiency * 0.20 + redZone * 0.15 + firstRead * 0.10, 0, 100))
  const bonus = score >= 80 ? 12 : score >= 60 ? 8 : score >= 40 ? 2 : score >= 20 ? -4 : -8
  const wopr = Number((1.5 * metrics.targetShare + 0.7 * metrics.airYardShare).toFixed(1))
  const badges = []
  if (metrics.targetShare >= 25) badges.push("Elite Target Share")
  else if (metrics.targetShare >= 20) badges.push("Strong Target Share")
  if (metrics.airYardShare >= 28) badges.push("Elite Air Yards")
  else if (metrics.airYardShare >= 20) badges.push("High Air Yards")
  if (metrics.tprr >= 0.25) badges.push("Efficient Target Hog")
  else if (metrics.tprr >= 0.18 && metrics.targetShare >= 18) badges.push("Target Earner")
  if (metrics.firstReadShare >= 18) badges.push("Primary Read")
  if (metrics.redZoneShare >= 20) badges.push("Red Zone Threat")
  if (isRb && metrics.snapShare >= 60) badges.push("Workhorse Snap Share")
  if (isRb && metrics.snapShare < 35) badges.push("Bench Role Only")
  if (scoringFormat === "Full PPR" && metrics.targetShare < 10 && !isRb) badges.push("Low PPR Volume")
  return { score, bonus, wopr, metrics, badges, tier: score >= 80 ? "Elite Opportunity" : score >= 60 ? "Strong Opportunity" : score >= 40 ? "Average Opportunity" : score >= 20 ? "Limited Opportunity" : "Role Player" }
}

const getSchemeProfile = (player, tags) => {
  const team = normalizeTeamAbbr(player.team)
  const scheme = SCHEME_INTEL_2026[team] || { pace: 57, paRate: 16, motionRate: 45, rzProe: 0, olGrade: 65, badges: ["Scheme Continuity"] }
  const position = player.position
  let bonus = 0
  if (scheme.pace >= 65 && ["QB", "RB", "WR", "TE"].includes(position)) bonus += 5
  else if (scheme.pace >= 60 && ["QB", "RB", "WR", "TE"].includes(position)) bonus += 2
  else if (scheme.pace <= 50) bonus += position === "RB" ? 3 : ["QB", "WR"].includes(position) ? -3 : 0
  if (scheme.paRate >= 20 && ["WR", "TE"].includes(position)) bonus += 4
  else if (scheme.paRate < 12 && ["WR", "TE"].includes(position)) bonus -= 3
  if (scheme.motionRate >= 55 && (tags.includes("SLOT") || position === "TE")) bonus += 3
  if (scheme.rzProe <= -10) bonus += position === "RB" ? 4 : position === "WR" ? -4 : 0
  if (scheme.rzProe >= 5) bonus += ["WR", "TE"].includes(position) ? 4 : 0
  if (scheme.olGrade >= 75 && position === "RB") bonus += 3
  if (scheme.olGrade <= 55) bonus += position === "RB" ? -4 : position === "QB" ? -3 : 0
  const ocChange = getTeamOcVariance(team)
  const badges = [...scheme.badges]
  if (ocChange) badges.push(ocChange.actualChange === false ? "Scheme Continuity" : "Scheme Change")
  if (scheme.rzProe <= -10 && position === "WR") badges.push("TD Vacuum Risk")
  return { ...scheme, team, bonus, badges: [...new Set(badges)] }
}

const getQbMode = ({ starterTargets, superFlexSlots }) => {
  if ((starterTargets.QB || 0) >= 2) return "2QB"
  if (superFlexSlots > 0) return "SUPERFLEX"
  return "1QB"
}

const getRoundGate = ({ player, round, currentPick, rosterCounts, starterTargets, superFlexSlots, valueGap, tags }) => {
  const qbMode = getQbMode({ starterTargets, superFlexSlots })
  const pos = player.position
  const nameKey = normalizeNameKey(player.name)
  const alerts = []
  let bonus = 0
  let suppress = false
  if (round <= 2 && !["SUPERFLEX", "2QB"].includes(qbMode) && ["QB", "DST", "DEF", "K"].includes(pos)) {
    suppress = true
    alerts.push("Anchor rounds: suppress QB/DST/K in 1QB builds.")
  }
  if (round <= 2 && pos === "RB" && !tags.includes("WORKHORSE")) bonus -= 12
  if (round === 2 && (rosterCounts.RB || 0) === 0 && pos === "RB") bonus += 8
  if (round === 2 && (rosterCounts.WR || 0) === 0 && pos === "WR") bonus += 8
  if (round >= 3 && round <= 4) {
    if ((rosterCounts.RB || 0) === 0 && pos === "RB") { bonus += 15; alerts.push("RB Drought Warning") }
    if ((rosterCounts.WR || 0) === 0 && pos === "WR") { bonus += 15; alerts.push("WR Drought Warning") }
    if (pos === "QB" && qbMode === "1QB" && nameKey !== "joshallen") { suppress = true; alerts.push("Wait on QB") }
    if (pos === "TE" && nameKey === "brockbowers" && valueGap >= 0) { bonus += 8; alerts.push("Elite TE Gap") }
  }
  if (round >= 5 && round <= 7) {
    if (pos === "QB" && (rosterCounts.QB || 0) === 0 && qbMode === "1QB") bonus += 5
    if (pos === "WR" && REAL_LIFE_WR2_DISCOUNTS.has(nameKey)) { bonus += 6; alerts.push("Real-Life WR2 Discount") }
  }
  if (round >= 8 && round <= 10) {
    if (pos === "QB" && qbMode === "SUPERFLEX" && (rosterCounts.QB || 0) < 2) { bonus += 18; alerts.push("Superflex QB2 deadline") }
    if (pos === "QB" && qbMode === "2QB" && (rosterCounts.QB || 0) < 3) { bonus += 18; alerts.push("2QB QB3 depth deadline") }
    if (pos === "RB" && (tags.includes("HANDCUFF") || tags.includes("LOTTERY"))) bonus += 7
    if (pos === "WR" && AIR_YARDS_LOTTERY.has(nameKey)) { bonus += 7; alerts.push("Air Yards Lottery") }
  }
  if (round >= 11) {
    if (["DST", "DEF"].includes(pos) && round < 12) suppress = true
    if (pos === "K" && round < 14) suppress = true
    if (/rookie|year 1|year1/i.test(`${player.notes || ""}`) || ["carnelltate", "jaydenhiggins"].includes(nameKey)) bonus += 5
    if (pos === "QB" && ["SUPERFLEX", "2QB"].includes(qbMode)) bonus += 6
  }
  if (qbMode === "SUPERFLEX" && pos === "QB" && round <= 5) bonus += 25
  if (qbMode === "2QB" && pos === "QB") bonus += round <= 3 ? 30 : round <= 7 ? 22 : 10
  return { bonus, suppress, alerts, qbMode }
}

const getConfidenceStars = (score) => {
  if (score >= 90) return { stars: "★★★★★", label: "High Confidence Pick" }
  if (score >= 70) return { stars: "★★★★", label: "Solid Pick" }
  if (score >= 50) return { stars: "★★★", label: "Moderate Confidence" }
  if (score >= 30) return { stars: "★★", label: "Speculative" }
  return { stars: "★", label: "High Risk — Proceed with Caution" }
}

const FEATURED_ANALYST_CONTEXT = {
  "bijan robinson": { analyst: "Justin Boone / FantasyPros consensus", fact: "FantasyPros' 2026 half-PPR consensus lists Robinson at No. 1 overall, with expert ranks tightly clustered near the top.", whyHigh: "The bullish case is elite touch volume plus receiving usage; Boone's early 2026 ranks also placed him first overall.", source: "FantasyPros 2026 rankings; Yahoo/Boone early 2026 ranks", url: "https://www.fantasypros.com/nfl/rankings/" },
  "jahmyr gibbs": { analyst: "FantasyPros consensus / Fantasy Life", fact: "Fantasy Life noted Gibbs started all 17 games and posted 1,223 rushing yards with 13 rushing TDs on 243 carries in its 2026 top-50 outlook.", whyHigh: "Analysts are high because an expanding workload paired with receiving explosiveness gives him overall RB1 upside.", source: "Fantasy Life 2026 top-50 outlook", url: "https://www.fantasylife.com/articles/fantasy/fantasy-football-2026-top-50-rankings-bijan-robinson-or-jahmyr-gibbs-at-101" },
  "ja'marr chase": { analyst: "FantasyPros consensus", fact: "FantasyPros' 2026 consensus keeps Chase inside the elite first-round tier with a best expert rank near the top of drafts.", whyHigh: "The case is bankable alpha target share plus touchdown ceiling in a high-value passing game.", source: "FantasyPros 2026 rankings", url: "https://www.fantasypros.com/nfl/rankings/" },
  "puka nacua": { analyst: "Justin Boone / FantasyPros consensus", fact: "Boone's early 2026 top 50 put Nacua in the top three, while FantasyPros consensus keeps him in the opening-round WR tier.", whyHigh: "The bullish case is target earning and weekly reception volume strong enough to anchor PPR builds.", source: "Yahoo/Boone early 2026 ranks; FantasyPros 2026 rankings", url: "https://sports.yahoo.com/fantasy/article/justin-boones-early-top-50-fantasy-football-rankings-for-2026-165115671.html" },
  "jaxon smith-njigba": { analyst: "FantasyPros consensus", fact: "FantasyPros' 2026 consensus places Smith-Njigba in the early first-round conversation, with a narrow expert range around the top WR tier.", whyHigh: "Analysts are buying target growth and the profile of a receiver who can win through volume rather than one-off splash plays.", source: "FantasyPros 2026 rankings", url: "https://www.fantasypros.com/nfl/rankings/" },
  "brock bowers": { analyst: "FantasyPros / PFF market context", fact: "Coverage around 2025 TE rankings highlighted Bowers' exceptional rookie target rate and low-risk elite TE profile.", whyHigh: "The case is that he functions like a featured receiver at TE, creating a positional edge most teams cannot match.", source: "FantasyPros/PFF TE market coverage", url: "https://www.fantasypros.com/nfl/rankings/te-cheatsheets.php" },
  "devonta smith": { analyst: "FantasyPros consensus + default board", fact: "Smith's appeal is proven target earning and efficiency despite sharing an offense with another high-end receiver.", whyHigh: "Analysts like him when the draft price bakes in the target competition but not the weekly WR2/WR1 spike potential.", source: "FantasyPros WR rankings", url: "https://www.fantasypros.com/nfl/rankings/wr-cheatsheets.php" },
  "jaylen waddle": { analyst: "FantasyPros consensus + default board", fact: "Waddle's fantasy profile is built on speed, yards after the catch, and the ability to turn moderate volume into explosive weeks.", whyHigh: "The bullish analyst case is that any role or offensive-context bump can make his ceiling beat a discounted ADP.", source: "FantasyPros WR rankings", url: "https://www.fantasypros.com/nfl/rankings/wr-cheatsheets.php" },
  "colston loveland": { analyst: "FantasyPros consensus + default board", fact: "Loveland is a receiving-first TE archetype, the kind fantasy analysts chase when looking for a non-touchdown-dependent breakout.", whyHigh: "Analysts get aggressive when the board is about to run out of TEs with plausible route and target upside.", source: "FantasyPros TE rankings", url: "https://www.fantasypros.com/nfl/rankings/te-cheatsheets.php" },
  "tyler warren": { analyst: "FantasyPros consensus + default board", fact: "Warren's appeal is versatility and receiving usage upside, which matters at a position where many options are touchdown-dependent.", whyHigh: "The high-on-him case is that a meaningful route role can create a weekly TE edge at a cheaper draft cost.", source: "FantasyPros TE rankings", url: "https://www.fantasypros.com/nfl/rankings/te-cheatsheets.php" },
}

const getAnalystContext = (player) => {
  const key = String(player.name || "").toLowerCase()
  return FEATURED_ANALYST_CONTEXT[key] || ANALYST_CONTEXT[player.position] || ANALYST_CONTEXT.default
}

const getPlayerAdp = (player) => {
  const adp = Number.parseFloat(player.marketAdp ?? player.adp_ppr ?? player.pprAdp ?? player.adp)
  return Number.isNaN(adp) ? 999 : adp
}

const getAnalystCompositeRank = (player, scoringFormat) => {
  const ranks = [
    getFormatAwareRank(player, scoringFormat),
    Number.parseFloat(player.expertRank),
    Number.parseFloat(player.consensusRank),
  ].filter((rank) => !Number.isNaN(rank) && rank > 0)

  if (ranks.length === 0) return getPlayerAdp(player)
  return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length
}

const isPlayerInsidePickWindow = (player, windowFloor, windowCeil) => {
  const adp = getPlayerAdp(player)
  return adp >= windowFloor && adp <= windowCeil
}

const getSuggestionBuildType = (strategyKey) => {
  if (["hero-rb", "double-hero-rb", "robust-rb"].includes(strategyKey)) return "HERO_RB"
  if (["zero-rb", "wr-heavy", "elite-te"].includes(strategyKey)) return "ZERO_RB"
  if (strategyKey === "early-qb") return "EARLY_QB"
  return "BALANCED_BPA"
}

const getQbTierGap = (scoredWindow) => {
  const qbs = scoredWindow
    .filter((scored) => scored.player.position === "QB")
    .sort((a, b) => a.analystRank - b.analystRank)
  if (qbs.length < 2) return 0
  return qbs[1].analystRank - qbs[0].analystRank
}

const buildSuggestionWhy = ({ player, analystRank, valueDiff }, state) => {
  const { buildType, currentPickOverall } = state
  const lines = []

  if (valueDiff > 0) {
    lines.push(`Selected-board rank (${analystRank.toFixed(1)}) is ${valueDiff.toFixed(1)} picks ahead of the live pick (${currentPickOverall}) — this is a best-value faller.`)
  } else if (valueDiff < -2) {
    lines.push(`Live pick (${currentPickOverall}) is ${Math.abs(valueDiff).toFixed(1)} picks ahead of selected-board rank (${analystRank.toFixed(1)}) — slight reach versus your active rankings.`)
  } else {
    lines.push(`Player is near selected-board fair value (rank ${analystRank.toFixed(1)} vs live pick ${currentPickOverall}).`)
  }

  lines.push(`Surfaced by comparing the active ranking board against pick ${currentPickOverall}.`)

  const buildNotes = {
    HERO_RB: "Hero RB build: prioritizing RB value in early rounds.",
    ZERO_RB: "Zero RB build: targeting WR/TE value; RBs suppressed.",
    EARLY_QB: "Early QB build: QB tier gap justifies spending here.",
    BALANCED_BPA: "Balanced BPA: no positional bias — following analyst value.",
  }
  if (buildNotes[buildType]) lines.push(buildNotes[buildType])

  const note = getPlayerIntelligenceNote(player)
  if (note?.key_note) lines.push(`Research edge: ${note.key_note}`)
  if (note?.risk_flag && note?.risk_alert) lines.push(note.risk_alert)

  return lines.join(" | ")
}

// Sources reflected in this model: FantasyPros Hero RB/Zero RB/QB strategy (May-Jun 2026),
// Footballguys 2026 RB/WR/TE strategy guides, Yahoo prospect target-share research,
// and Washington Post draft-efficiency research on WR/RB/QB/TE payoff curves.
const RESEARCH_PILLARS_2026 = [
  "Hero/Anchor RB is the safest default build in current analyst research: land one early workhorse when value cooperates, then pivot to target-earning WRs and selective onesie values.",
  "Double Hero RB is viable when two real workload backs fall early, but WR/TE starter gaps should still beat fragile RB3 depth.",
  "Zero-RB research still works when the room gives elite WR/TE value; do not patch RB with low-upside dead-zone volume.",
  "QB research is barbell: in 1QB, either take a true rushing/elite edge or wait past the comfort tier; Superflex stays QB-heavy.",
  "TE research is also barbell: elite leverage or late athletic upside beats the middle-round safety trap.",
  "WR evaluation should overweight target earning, especially prospect/young-player target share and clear No. 1 routes.",
]

const ANALYST_MODEL_VERSION = "Strategy lock · 2026 analyst blend"

const POSITION_SPLIT_ORDER = ["RB", "WR", "QB", "TE"]

const getPositionSplitSuggestions = (players, maxPicks = 6) => {
  const selected = []
  const selectedIds = new Set()

  POSITION_SPLIT_ORDER.forEach((position) => {
    const match = players.find((player) => player.position === position && !selectedIds.has(String(player.id || `${player.name}-${player.team}-${player.position}`)))
    if (match && selected.length < maxPicks) {
      selected.push(match)
      selectedIds.add(String(match.id || `${match.name}-${match.team}-${match.position}`))
    }
  })

  players.forEach((player) => {
    if (selected.length >= maxPicks) return
    const playerKey = String(player.id || `${player.name}-${player.team}-${player.position}`)
    if (selectedIds.has(playerKey)) return
    selected.push(player)
    selectedIds.add(playerKey)
  })

  return selected.sort((a, b) => b.valueDiff - a.valueDiff || b.finalScore - a.finalScore || a.analystRank - b.analystRank || b.confidenceScore - a.confidenceScore || b.hybridScore - a.hybridScore)
}

const STRATEGY_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "balanced", label: "Balanced BPA" },
  { value: "hero-rb", label: "Hero RB" },
  { value: "double-hero-rb", label: "Double Hero RB" },
  { value: "zero-rb", label: "Zero RB" },
  { value: "wr-heavy", label: "WR-Heavy" },
  { value: "robust-rb", label: "Robust RB" },
  { value: "elite-te", label: "Elite TE" },
  { value: "early-qb", label: "Elite/Early QB" },
  { value: "late-qb-te", label: "Late QB/TE" },
]

const getSelectedPickRoundsByPosition = ({ draftedPlayers = [], selectedTeamRosterId, numTeams = 12 }) => {
  const teamCount = Number(numTeams) || 12
  return draftedPlayers
    .filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
    .reduce((roundsByPosition, player) => {
      const pickNo = Number(player.pick_no)
      const round = Number(player.round) || (pickNo > 0 ? Math.ceil(pickNo / teamCount) : 99)
      const position = String(player.position || "").toUpperCase()
      if (!roundsByPosition[position]) roundsByPosition[position] = []
      roundsByPosition[position].push(round)
      roundsByPosition[position].sort((a, b) => a - b)
      return roundsByPosition
    }, { QB: [], RB: [], WR: [], TE: [] })
}

const getStrategyGuidance = (value, scoringFormat, isSuperFlex) => {
  const pprNote = scoringFormat === "Standard" ? "Standard scoring keeps touchdown/volume RBs in play." : "PPR scoring rewards target-earning WRs and receiving backs."
  const sfNote = isSuperFlex ? " Superflex still elevates QB scarcity." : " In 1QB, avoid QB unless elite value falls or you intentionally chose an early-QB build."
  const guidance = {
    balanced: "Use Anchor/Hero RB as the default spine: take one early RB when value cooperates, prioritize WR/TE target volume, fill flex, then chase RB/WR upside.",
    "hero-rb": "Protect the single early RB anchor with target-earning WRs, one TE/QB value if it falls, and late RB upside.",
    "double-hero-rb": "Two early RB anchors are already secured; aggressively catch up at WR/TE before adding more fragile RB depth.",
    "zero-rb": "Do not force RB dead-zone volume; build WR/TE/elite QB leverage, then attack late contingent and receiving RBs.",
    "wr-heavy": "Lean into WR target volume while keeping enough RB/TE value awareness to avoid empty starter slots.",
    "robust-rb": "RB volume is the bet; stop before overinvesting, then fill WR starters and avoid redundant bench QB/TE.",
    "elite-te": "Treat TE as a solved leverage slot, then prioritize RB/WR starters and avoid a second TE.",
    "early-qb": "Treat QB as solved; core RB/WR/TE starters and flex depth should beat a backup QB.",
    "late-qb-te": "Use patience at onesie positions; build RB/WR/flex depth and only take QB/TE when value or tiers force it.",
  }
  return `${guidance[value] || guidance.balanced} ${pprNote}${sfNote}`
}

const getManualStrategySignal = ({ strategyOverride, player, round, rosterCounts, starterTargets, flexSlots, scoringFormat, isSuperFlex }) => {
  if (!strategyOverride || strategyOverride === "auto") return { bonus: 0, label: "Auto strategy", detail: "Auto-detected build controls the macro plan." }
  const position = player.position
  const rb = rosterCounts.RB || 0
  const wr = rosterCounts.WR || 0
  const te = rosterCounts.TE || 0
  const qb = rosterCounts.QB || 0
  const flexCoreCount = rb + wr + te
  const flexCoreTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
  const needsFlexCore = flexCoreCount < flexCoreTarget
  const isPpr = scoringFormat !== "Standard"
  const match = (bonus, label, detail) => ({ bonus, label, detail })

  if (strategyOverride === "hero-rb") {
    if (position === "WR" && needsFlexCore) return match(5, "Hero RB pivot", "After one anchor RB, prioritize target-earning WRs and flex starters.")
    if (position === "RB" && rb >= 1 && round <= 8) return match(-4, "Avoid RB pile-up", "Hero RB does not mean forcing dead-zone RB2/RB3 over stronger WR/TE value.")
    if (position === "RB" && round >= 9) return match(4, "Hero RB late upside", "Late contingent RBs are exactly where Hero RB adds depth.")
  }
  if (strategyOverride === "double-hero-rb") {
    if (position === "WR" || (position === "TE" && te === 0)) return match(5, "Double Hero catch-up", "Two early RBs push the next picks toward WR/TE starter value.")
    if (position === "RB" && rb >= 2 && round <= 8) return match(-6, "No triple dead-zone RB", "Double Hero RB is two early anchors, not mid-round RB hoarding.")
  }
  if (strategyOverride === "zero-rb") {
    if (position === "WR" || position === "TE") return match(5, "Zero RB core", "Build receiver/TE leverage while the RB room spends early capital.")
    if (position === "RB" && round <= 8) return match(-5, "Zero RB discipline", "Do not patch the build with dead-zone volume unless the value is extreme.")
    if (position === "RB") return match(6, "Zero RB attack", "Late RB upside is the payoff window for this build.")
  }
  if (strategyOverride === "wr-heavy" && position === "WR") return match(4 + (isPpr ? 1 : 0), "WR-heavy lean", "User override favors target volume and WR/flex pressure.")
  if (strategyOverride === "robust-rb") {
    if (position === "RB" && rb < 3 && round <= 6) return match(5, "Robust RB fit", "Robust RB wants multiple early workload bets before pivoting away.")
    if (position === "WR" && rb >= 2) return match(3, "Robust RB pivot", "With RB volume banked, fill WR starters before depth.")
  }
  if (strategyOverride === "elite-te") return position === "TE" && te > 0 ? match(-8, "No second TE", "Elite TE build should not spend another pick on TE.") : position === "WR" || position === "RB" ? match(3, "TE solved", "TE leverage is handled; attack RB/WR starters and flex.") : match(0, "TE solved", "Keep TE solved and compare value.")
  if (strategyOverride === "early-qb") return position === "QB" && qb > 0 ? match(-8, "No backup QB", "Early-QB build already paid for the position.") : position === "RB" || position === "WR" ? match(3, "QB solved", "QB is handled; refill RB/WR/flex value.") : match(0, "QB solved", "Avoid doubling down at QB.")
  if (strategyOverride === "late-qb-te" && (position === "QB" || position === "TE") && round <= 8 && !isSuperFlex) return match(-4, "Late onesie plan", "User override wants patience at QB/TE unless a tier drop is obvious.")
  return match(0, "Manual strategy", "Manual override noted; no extra positional adjustment for this player.")
}

const getAdpRound = (adp, teams = 12) => {
  const value = Number.parseFloat(adp)
  const teamCount = Number(teams) || 12
  if (Number.isNaN(value) || teamCount <= 0) return 99
  return Math.max(1, Math.ceil(value / teamCount))
}

const getResearchEdge = ({ player, round, adpRound, rosterNeed, rosterCounts, starterTargets, flexSlots, superFlexSlots, scoringFormat }) => {
  const position = player.position
  const isSuperFlex = superFlexSlots > 0
  const hasQbStarter = (rosterCounts.QB || 0) >= (starterTargets.QB || 0)
  const hasTeStarter = (rosterCounts.TE || 0) >= (starterTargets.TE || 0)
  const rbCount = rosterCounts.RB || 0
  const wrCount = rosterCounts.WR || 0
  const flexCoreCount = FLEX_POSITIONS.reduce((sum, pos) => sum + (rosterCounts[pos] || 0), 0)
  const flexCoreTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
  const needsFlexCore = flexCoreCount < flexCoreTarget
  const ppr = scoringFormat !== "Standard"
  const isEarlyPrice = adpRound <= 2
  const isDeadZone = adpRound >= 3 && adpRound <= 8
  const isLate = adpRound >= 9
  const isYoungUpside = /rookie|2nd|second|breakout|target share|ascending/i.test(`${player.notes || ""} ${player.playerNote || ""} ${player.team || ""}`)

  if (isSuperFlex && position === "QB") {
    return { bonus: 8, label: "SF QB premium", detail: "Superflex settings override 1QB patience; starting QB scarcity is the top macro edge." }
  }

  if (position === "RB") {
    if (rbCount === 0 && isEarlyPrice) {
      return { bonus: 7, label: "Anchor RB fit", detail: "Hero-RB research favors one early workhorse before shifting into WR/onesie value." }
    }
    if (isDeadZone && rbCount >= 1) {
      return { bonus: -6, label: "RB dead-zone fade", detail: "After an anchor RB, mid-round backs need real upside; avoid drafting name-value volume just to fill RB2." }
    }
    if (isDeadZone && rbCount === 0 && rosterNeed.bonus > 0) {
      return { bonus: 2, label: "Selective RB patch", detail: "You still need RB, but the dead-zone penalty keeps this behind similarly valued WR/elite onesie options." }
    }
    if (isLate) {
      return { bonus: 5, label: "Late RB upside", detail: "Late RBs with receiving, contingent, or explosive-offense paths can swing leagues if roles change." }
    }
  }

  if (position === "WR") {
    if (round <= 4 && (ppr || wrCount < starterTargets.WR || needsFlexCore)) {
      return { bonus: 6, label: "Target-earner lean", detail: "Current draft research pushes early WR target volume and clear No. 1 roles as league-winning inputs." }
    }
    if (isDeadZone && needsFlexCore) {
      return { bonus: 4, label: "WR over dead-zone RB", detail: "In the middle rounds, strong WR profiles usually beat fragile RB volume unless RB role clarity is exceptional." }
    }
    if (isLate || isYoungUpside) {
      return { bonus: 3, label: "WR spike swing", detail: "Late WR shots should chase target-earning upside, second-year leaps, rookies, or high-octane offenses." }
    }
  }

  if (position === "QB") {
    if (!isSuperFlex && adpRound >= 3 && adpRound <= 4 && !hasQbStarter) {
      return { bonus: 4, label: "Elite QB window", detail: "1QB research supports taking a true elite/rushing QB if the board breaks in rounds 3-4." }
    }
    if (!isSuperFlex && adpRound >= 6 && adpRound <= 8) {
      return { bonus: -5, label: "Mid-QB trap", detail: "The middle QB comfort tier is less attractive than elite-or-late roster construction." }
    }
    if (!isSuperFlex && isLate && !hasQbStarter) {
      return { bonus: 3, label: "Late QB swing", detail: "If you skipped the elite window, wait and take upside rather than paying the middle tax." }
    }
  }

  if (position === "TE") {
    if (!hasTeStarter && adpRound <= 4) {
      return { bonus: 5, label: "Elite TE edge", detail: "TE research favors real positional leverage early if the player is in the elite usage tier." }
    }
    if (adpRound >= 5 && adpRound <= 8) {
      return { bonus: -4, label: "TE middle fade", detail: "Middle-round safe TEs rarely separate; only override for a strong tier/value drop." }
    }
    if (!hasTeStarter && isLate) {
      return { bonus: 3, label: "Late TE upside", detail: "If you miss elite TE, chase athletic/red-zone/ascending usage late instead of paying for safety." }
    }
  }

  return { bonus: 0, label: "Research neutral", detail: "No macro strategy override; value, roster fit, and tier leverage should drive the call." }
}

const getBuildStrategyLock = ({ rosterCounts, starterTargets, flexSlots, round, isSuperFlex, scoringFormat, draftedRoundsByPosition = {}, strategyOverride = "auto" }) => {
  const rb = rosterCounts.RB || 0
  const wr = rosterCounts.WR || 0
  const totalPicks = rosterCounts.total || CORE_STARTER_POSITIONS.reduce((sum, pos) => sum + (rosterCounts[pos] || 0), 0) + (rosterCounts.QB || 0)
  const coreStarterTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
  const coreStarterCount = CORE_STARTER_POSITIONS.reduce((sum, pos) => sum + (rosterCounts[pos] || 0), 0)
  const openCoreSlots = Math.max(coreStarterTarget - coreStarterCount, 0)
  const missing = CORE_STARTER_POSITIONS.filter((pos) => (rosterCounts[pos] || 0) < (starterTargets[pos] || 0))
  const earlyRbCount = (draftedRoundsByPosition.RB || []).filter((pickedRound) => pickedRound <= 5).length
  const earlyWrCount = (draftedRoundsByPosition.WR || []).filter((pickedRound) => pickedRound <= 5).length
  const hasEarlyTe = (draftedRoundsByPosition.TE || []).some((pickedRound) => pickedRound <= 4)
  const hasEarlyQb = (draftedRoundsByPosition.QB || []).some((pickedRound) => pickedRound <= (isSuperFlex ? 3 : 5))
  const detectedKey = totalPicks === 0
    ? "balanced"
    : hasEarlyQb
      ? "early-qb"
      : hasEarlyTe
        ? "elite-te"
        : earlyRbCount >= 3 && round <= 7
          ? "robust-rb"
          : earlyRbCount >= 2
            ? "double-hero-rb"
            : rb === 0 && (round >= 6 || earlyWrCount >= 3)
              ? "zero-rb"
              : wr >= 3 && earlyRbCount <= 1
                ? "wr-heavy"
                : earlyRbCount === 1
                  ? "hero-rb"
                  : "balanced"
  const activeKey = strategyOverride && strategyOverride !== "auto" ? strategyOverride : detectedKey
  const option = STRATEGY_OPTIONS.find((strategy) => strategy.value === activeKey)
  const label = `${option?.label || "Balanced BPA"}${strategyOverride && strategyOverride !== "auto" ? " (manual)" : ""}`
  const next = activeKey === "hero-rb" && rb === 0 && round <= 5
    ? "Default plan: draft an anchor RB if the tier/value is right; otherwise keep taking elite WR/TE value and do not force RB dead-zone volume."
    : missing.length > 0
      ? `Fill ${missing.join("/")} starter${missing.length === 1 ? "" : "s"} before bench depth.`
    : openCoreSlots > 0
      ? "Fill the flex with the best RB/WR/TE value before bench depth."
      : "Starters are set; bench should be RB/WR upside, not duplicate QB/TE."
  const guardrail = isSuperFlex
    ? "Superflex keeps QB scarcity in the conversation, but do not ignore open RB/WR/TE starters."
    : "In 1QB, QB only breaks through when the tier/value gap is obvious after core starters are addressed."
  const format = scoringFormat === "Standard" ? "Standard scoring raises RB touchdown/volume value." : "PPR scoring raises WR target volume and pass-catching RB/TE value."

  return { label, next, guardrail, format, activeKey, detectedKey, guidance: getStrategyGuidance(activeKey, scoringFormat, isSuperFlex) }
}

const getPositionMultiplier = ({ position, round, scoringFormat, isSuperFlex, rosterNeed }) => {
  if (position === "QB") {
    if (isSuperFlex) return round <= 4 ? 1.45 : 1.25
    return round <= 5 ? 0.55 : rosterNeed.bonus > 0 ? 0.9 : 0.65
  }
  if (position === "TE") return round <= 3 ? 1.05 : round <= 8 ? 0.95 : 0.75
  if (position === "RB") return round <= 5 ? 1.18 : round <= 8 ? 0.92 : 1.08
  if (position === "WR") return scoringFormat === "Full PPR" ? 1.16 : round <= 8 ? 1.06 : 1
  return 1
}

const PLAYER_STRATEGY_SIGNALS = {
  "jaylen waddle": { bonus: 5, label: "Change discount", detail: "Monitor trade/team-change discount if market price lags role upgrade." },
  "devonta smith": { bonus: 4, label: "Breakout bet", detail: "User thesis: target around the 3-4 turn if value holds." },
  "colston loveland": { bonus: 6, label: "TE breaker", detail: "One of the last TE upside bets before the tier falls off." },
  "tyler warren": { bonus: 6, label: "TE breaker", detail: "One of the last TE upside bets before the tier falls off." },
}

const getPlayerStrategySignal = (player) => {
  const nameKey = String(player.name || "").toLowerCase()
  const directSignal = PLAYER_STRATEGY_SIGNALS[nameKey]
  if (directSignal) return directSignal
  if (player.position === "RB" && Number.parseFloat(player.adp) <= 60) {
    return { bonus: 5, label: "RB window", detail: "RB market is pricey; try to land a starter in rounds 1-5 before the room locks you out." }
  }
  if (player.position === "WR" && Number.parseFloat(player.adp) >= 24 && Number.parseFloat(player.adp) <= 60) {
    return { bonus: 2, label: "WR pocket", detail: "Strong WR range after hero-RB starts; prioritize if roster fit is open." }
  }
  return { bonus: 0, label: "Clean fit", detail: "No special 2026 draft signal beyond value and roster fit." }
}

// 2026 research themes folded into the suggestion model: stay BPA/balanced early,
// prioritize scarce RB/WR starters over low-impact QB reaches in 1QB, use the
// middle rounds for WR depth and selective QB/TE values, and chase RB/WR upside
// on the bench rather than redundant one-starter positions.
const getDraftTypeLabel = (draftType) => {
  const normalizedType = String(draftType || "snake").toLowerCase()
  if (normalizedType.includes("auction")) return "Auction"
  if (normalizedType.includes("linear")) return "Linear"
  if (normalizedType.includes("keeper")) return "Keeper"
  return "Snake"
}

const getThematicStrategySignal = ({ player, round, rosterNeed, rosterCounts, starterTargets, flexSlots, superFlexSlots, scoringFormat, draftType }) => {
  const position = player.position
  const adp = Number.parseFloat(player.adp)
  const hasStarter = (rosterCounts[position] || 0) >= (starterTargets[position] || 0)
  const isSuperFlex = superFlexSlots > 0
  const isAuction = getDraftTypeLabel(draftType) === "Auction"
  const flexEligibleCount = FLEX_POSITIONS.reduce((sum, pos) => sum + (rosterCounts[pos] || 0), 0)
  const flexEligibleTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
  const needsCoreSkillStarter = flexEligibleCount < flexEligibleTarget
  const isEarly = round <= 3
  const isMiddle = round >= 4 && round <= 8

  if (isAuction) {
    if (position === "QB" && !isSuperFlex) return { bonus: -4, label: "Auction QB discipline", detail: "In 1QB auction rooms, save budget leverage for RB/WR/elite-TE difference-makers." }
    if (position === "QB" && isSuperFlex) return { bonus: 6, label: "Auction QB scarcity", detail: "Superflex auction settings make starting QB scarcity worth paying for." }
    if ((position === "RB" || position === "WR") && needsCoreSkillStarter) return { bonus: 4, label: "Auction core", detail: `Use Sleeper roster settings to build ${position} starters before chasing bench depth.` }
    if (position === "TE" && !hasStarter && adp <= 90) return { bonus: 2, label: "Auction TE tier", detail: "Pay for TE only when the tier/price gap is meaningful." }
    return { bonus: BENCH_TARGET_POSITIONS.includes(position) ? 2 : -1, label: "Auction depth", detail: "Auction depth should emphasize flexible RB/WR upside over redundant starters." }
  }

  if (position === "QB") {
    if (isSuperFlex) return { bonus: 7, label: "Superflex QB", detail: "Superflex scarcity makes starting QB value a priority." }
    if (isEarly) return { bonus: -7, label: "Wait on QB", detail: "1QB depth favors building RB/WR/elite-TE value before chasing quarterback." }
    if (!hasStarter && isMiddle && adp <= 100) return { bonus: 3, label: "QB value", detail: "Middle-round QB value fits the 2026 late-QB build once core starters are forming." }
    return { bonus: -2, label: "QB patience", detail: "Avoid forcing QB unless the value clearly beats RB/WR options." }
  }

  if (position === "TE") {
    if (hasStarter) return { bonus: -6, label: "No bench TE", detail: "Avoid redundant TE unless settings demand it." }
    if (adp <= 30) return { bonus: 3, label: "Elite TE edge", detail: "Elite TE is viable when the board gives you a real tier advantage." }
    if (isMiddle && adp <= 90) return { bonus: needsCoreSkillStarter ? 2 : -2, label: needsCoreSkillStarter ? "TE starter fill" : "TE middle caution", detail: needsCoreSkillStarter ? "TE can fill an open starter/flex slot, but keep the tier gap honest." : "Avoid paying for middle-round TE safety once core starters are covered." }
    return { bonus: -1, label: "TE discipline", detail: "Do not reach at TE without a tier or ADP discount." }
  }

  if (position === "RB") {
    if (isEarly && rosterNeed.bonus >= 8) return { bonus: 4, label: "Anchor RB", detail: "Secure an RB anchor when value and roster fit line up." }
    if (isMiddle && needsCoreSkillStarter) return { bonus: 3, label: "RB window", detail: "Committee risk makes useful RB volume worth grabbing before the cliff." }
    return { bonus: round >= 9 ? 4 : 1, label: "RB upside", detail: "Prioritize contingent RB upside once starters are mostly filled." }
  }

  if (position === "WR") {
    const pprBoost = scoringFormat === "Full PPR" ? 1 : 0
    if (isEarly && rosterNeed.bonus >= 8) return { bonus: 4 + pprBoost, label: "WR core", detail: "Build around high-volume WRs when early-round value is intact." }
    if (isMiddle) return { bonus: 3 + pprBoost, label: "WR depth", detail: "WR remains a strong middle-round depth pocket, especially in PPR." }
    return { bonus: round >= 9 ? 3 + pprBoost : 1 + pprBoost, label: "WR upside", detail: "Favor WR spike-week upside over low-ceiling bench fillers." }
  }

  return { bonus: 0, label: "BPA", detail: "Let value, roster fit, and positional leverage drive the pick." }
}
const DEFAULT_SLOT_SETTINGS = { slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1, slots_flex: 1, slots_bn: 5 }

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getConfidenceLabel = (score) => {
  if (score >= 85) return "Elite"
  if (score >= 72) return "High"
  if (score >= 58) return "Medium"
  if (score >= 44) return "Low"
  return "Fade"
}

const getSignalColor = (score) => {
  if (score >= 75) return "#22c55e"
  if (score >= 60) return "#84cc16"
  if (score >= 45) return "#facc15"
  if (score >= 30) return "#fb923c"
  return "#ef4444"
}

const getValueDiffColor = (valueDiff) => Number(valueDiff) >= 0 ? "#22c55e" : "#ef4444"

const getRosterCompositionInsight = ({ position, rosterCounts, starterTargets, flexSlots, scoringFormat, round }) => {
  const rb = rosterCounts.RB || 0
  const wr = rosterCounts.WR || 0
  const qb = rosterCounts.QB || 0
  const te = rosterCounts.TE || 0
  const flexCoreTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
  const flexCoreCount = rb + wr + te

  if (position === "RB" && rb === 0 && round <= 4) return "Roster build lacks an anchor RB; this pick stabilizes weekly floor and keeps the room from forcing you later."
  if (position === "WR" && wr < starterTargets.WR && scoringFormat !== "Standard") return "PPR build still needs target volume; this adds a weekly reception floor instead of chasing fragile touchdowns."
  if ((position === "RB" || position === "WR") && flexCoreCount < flexCoreTarget) return "Fills the starting RB/WR/TE core before bench-only picks become optimal."
  if (position === "QB" && qb === 0) return "Only viable because your starter spot is open; compare against remaining RB/WR tier quality before clicking."
  if (position === "TE" && te === 0) return "Addresses the last singleton starter, but only worth it if the tier gap is real."
  if (position === "RB") return "Bench RBs carry injury-contingent league-winning upside and protect against early-season depth shocks."
  if (position === "WR") return "Bench WR depth creates matchup flexibility and spike-week options in bye weeks."
  return "Best-player fit is acceptable, but double-check whether RB/WR depth has a higher ceiling."
}

const getActionLabel = (player) => {
  if (player.confidenceScore >= 82 && player.valueDiff >= -2) return "Draft now"
  if (player.valueDiff >= 8) return "Value smash"
  if (player.rosterReason?.includes("open")) return "Need fit"
  if (player.scarcityBonus >= 4) return "Tier break"
  return "Track"
}

export function SuggestedPicksSection({ colors, draftData, currentPick, getAvailablePlayers, draftedPlayers = [], selectedTeamRosterId, layout = "stacked", selectedStrategyOverride = "auto", setSelectedStrategyOverride }) {
  const selectedRosterCounts = draftedPlayers
    .filter((player) => String(player.roster_id) === String(selectedTeamRosterId))
    .reduce((counts, player) => {
      counts[player.position] = (counts[player.position] || 0) + 1
      counts.total += 1
      return counts
    }, { QB: 0, RB: 0, WR: 0, TE: 0, total: 0 })

  const settings = draftData?.slotSettings || DEFAULT_SLOT_SETTINGS
  const starterTargets = {
    QB: Number(settings.slots_qb ?? 1),
    RB: Number(settings.slots_rb ?? 2),
    WR: Number(settings.slots_wr ?? 2),
    TE: Number(settings.slots_te ?? 1),
  }
  const flexSlots = Number(settings.slots_flex ?? settings.slots_wrt ?? 1)
  const superFlexSlots = Number(settings.slots_super_flex ?? 0)
  const benchSlots = Number(settings.slots_bn ?? 5)
  const starterCount = Object.values(starterTargets).reduce((sum, count) => sum + count, 0) + flexSlots + superFlexSlots
  const rosterSize = starterCount + benchSlots

  const scoringFormat = getScoringFormatFromSettings(draftData, settings)
  const draftType = draftData?.draftType || settings.draft_type || "snake"
  const draftTypeLabel = getDraftTypeLabel(draftType)

  const getFormatBonus = (position) => {
    if (scoringFormat === "Full PPR") return position === "WR" ? 4 : position === "RB" ? 2 : position === "TE" ? 1 : 0
    if (scoringFormat === "Half PPR") return position === "WR" || position === "RB" ? 2 : position === "TE" ? 1 : 0
    if (scoringFormat === "Standard") return position === "RB" ? 4 : position === "WR" ? -2 : position === "TE" ? -1 : 0
    return 0
  }

  const getRosterNeed = (position) => {
    const count = selectedRosterCounts[position] || 0
    const directTarget = starterTargets[position] || 0
    const directOpen = Math.max(directTarget - count, 0)
    const flexEligibleCount = FLEX_POSITIONS.reduce((sum, pos) => sum + (selectedRosterCounts[pos] || 0), 0)
    const flexEligibleTarget = starterTargets.RB + starterTargets.WR + starterTargets.TE + flexSlots
    const flexOpen = CORE_STARTER_POSITIONS.includes(position) ? Math.max(flexEligibleTarget - flexEligibleCount, 0) : 0
    const superFlexOpen = position === "QB" ? Math.max(starterTargets.QB + superFlexSlots - count, 0) : 0
    const benchOpen = selectedRosterCounts.total >= starterCount && selectedRosterCounts.total < rosterSize
    const rosterFull = selectedRosterCounts.total >= rosterSize

    if (directOpen > 0) return { bonus: position === "WR" ? 13 : position === "RB" ? 12 : position === "TE" ? 10 : 6, reason: `${directOpen} ${position} starter slot${directOpen === 1 ? "" : "s"} open`, eligible: true }
    if (superFlexOpen > 0) return { bonus: 7, reason: `${superFlexOpen} superflex QB slot${superFlexOpen === 1 ? "" : "s"} open`, eligible: true }
    if (position === "QB" || position === "TE") {
      return { bonus: -100, reason: `skip double ${position}; starter slot is covered`, eligible: false }
    }
    if (flexOpen > 0) return { bonus: position === "TE" ? 4 : 7, reason: `${flexOpen} flex slot${flexOpen === 1 ? "" : "s"} open`, eligible: true }
    if (benchOpen && BENCH_TARGET_POSITIONS.includes(position)) return { bonus: 3, reason: `bench upside should be RB/WR only`, eligible: true }
    if (rosterFull) return { bonus: -10, reason: "roster is full", eligible: false }
    return { bonus: 1, reason: `usable ${position} depth`, eligible: BENCH_TARGET_POSITIONS.includes(position) }
  }

  const getScarcityBonus = (player, available) => getTierCliff(player, available, scoringFormat)

  const availablePlayers = getAvailablePlayers?.() || []
  const draftRound = draftData?.numTeams ? Math.floor((Number(currentPick) - 1) / draftData.numTeams) + 1 : 1
  const replacementSnapshot = getReplacementSnapshot({ playerPool: availablePlayers, scoringFormat, numTeams: draftData?.numTeams || 12 })
  const picksUntilNextTurn = getPicksUntilNextTurn({ currentPick, selectedTeamRosterId, numTeams: draftData?.numTeams || 12 })

  const draftedRoundsByPosition = getSelectedPickRoundsByPosition({ draftedPlayers, selectedTeamRosterId, numTeams: draftData?.numTeams || 12 })
  const strategyLock = getBuildStrategyLock({ rosterCounts: selectedRosterCounts, starterTargets, flexSlots, round: draftRound, isSuperFlex: superFlexSlots > 0, scoringFormat, draftedRoundsByPosition, strategyOverride: selectedStrategyOverride })
  const qbMode = getQbMode({ starterTargets, superFlexSlots })
  const rosterHealth = getRosterHealth({ rosterCounts: selectedRosterCounts, starterTargets, flexSlots, scoringFormat, strategyKey: strategyLock.activeKey })

  const positionalRunAlert = getRunAlert(draftedPlayers)

  const pickWindowBack = draftRound <= 2 ? 2 : draftRound <= 5 ? 4 : 6
  const pickWindowForward = draftRound <= 2 ? 10 : draftRound <= 5 ? 16 : 24
  const pickWindowFloor = Math.max(1, Number(currentPick || 1) - pickWindowBack)
  const pickWindowCeil = Number(currentPick || 1) + pickWindowForward
  const activeBuildType = getSuggestionBuildType(strategyLock.activeKey)
  const isSuggestionCandidate = (player) => {
    const analystRank = getAnalystCompositeRank(player, scoringFormat)
    return !Number.isNaN(analystRank) && analystRank <= pickWindowCeil
  }
  const qbTierGap = getQbTierGap(availablePlayers
    .filter((player) => isPlayerInsidePickWindow(player, pickWindowFloor, pickWindowCeil))
    .map((player) => ({ player, analystRank: getAnalystCompositeRank(player, scoringFormat) })))

  const suggestionCandidateLimit = 6
  const suggestionDisplayCount = 3
  const topValuePlayerKeys = new Set(
    availablePlayers
      .filter(isSuggestionCandidate)
      .map((player) => {
        const analystRank = getAnalystCompositeRank(player, scoringFormat)
        return { player, analystRank, currentPickValue: Number(currentPick || 0) - analystRank }
      })
      .filter(({ analystRank }) => !Number.isNaN(analystRank))
      .sort((a, b) => b.currentPickValue - a.currentPickValue || a.analystRank - b.analystRank)
      .slice(0, suggestionCandidateLimit)
      .map(({ player }) => String(player.id || `${player.name}-${player.team}-${player.position}`)),
  )

  const rankedSuggestedPicks = availablePlayers
    .filter(isSuggestionCandidate)
    .map((player) => {
      if (!currentPick) return null
      const analystRank = getAnalystCompositeRank(player, scoringFormat)
      if (Number.isNaN(analystRank)) return null
      const livePick = Number.parseFloat(currentPick)
      const valueGap = livePick - analystRank
      const valueDiff = valueGap
      let earlyContextAdjustment = 0
      const expertRank = analystRank
      const expertEdge = Number.isNaN(livePick) || Number.isNaN(expertRank) ? 0 : livePick - expertRank
      const rosterNeed = getRosterNeed(player.position)
      if (activeBuildType === "HERO_RB" && player.position === "RB" && draftRound <= 3 && selectedRosterCounts.RB < 2) earlyContextAdjustment += 4
      if (activeBuildType === "ZERO_RB" && player.position === "RB" && draftRound <= 4) earlyContextAdjustment -= 8
      if (activeBuildType === "ZERO_RB" && (player.position === "WR" || player.position === "TE") && draftRound <= 4) earlyContextAdjustment += 3
      if (activeBuildType === "EARLY_QB" && player.position === "QB" && selectedRosterCounts.QB === 0 && qbTierGap >= 8) earlyContextAdjustment += 5
      if (draftRound >= 3 && selectedRosterCounts[player.position] < (starterTargets[player.position] || 0)) earlyContextAdjustment += 2
      const vbdProfile = getVbdProfile({ player, availablePlayers, scoringFormat, replacementSnapshot, picksUntilNextTurn, starterTargets, flexSlots })
      const liveScarcity = getLiveScarcityProfile({ position: player.position, availablePlayers, draftedPlayers, replacementSnapshot, draftData, scoringFormat })
      let tags = getPlayerTags(player)
      const tagFormatAdjustment = getTagFormatAdjustment(tags, scoringFormat)
      const opportunityProfile = getOpportunityProfile(player, scoringFormat)
      opportunityProfile.badges.forEach((badge) => tags.push(badge))
      const schemeProfile = getSchemeProfile(player, tags)
      const tierProfile = PLAYER_TIERS_2026[normalizeNameKey(player.name)] || { tier: `${player.position} Tier`, bonus: 0 }
      const categoryFlag = CATEGORY_FLAGS_2026[normalizeNameKey(player.name)] || null
      if (categoryFlag && !tags.includes(categoryFlag.type)) tags.push(categoryFlag.type)
      if (AIR_YARDS_LOTTERY.has(normalizeNameKey(player.name))) tags.push("AIR YARDS LOTTERY")
      tags = [...new Set(tags)]
      const roundGate = getRoundGate({ player, round: draftRound, currentPick, rosterCounts: selectedRosterCounts, starterTargets, superFlexSlots, valueGap, tags })
      const formatBonus = getFormatBonus(player.position) + tagFormatAdjustment / 4
      const playerKey = String(player.id || `${player.name}-${player.team}-${player.position}`)
      const hasLaterRoundStarterNeed = rosterNeed.eligible && rosterNeed.bonus >= 12 && draftRound >= 5 && selectedRosterCounts.total < starterCount
      if ((!topValuePlayerKeys.has(playerKey) && !hasLaterRoundStarterNeed) || !rosterNeed.eligible || roundGate.suppress) return null
      const tierCliff = getScarcityBonus(player, availablePlayers)
      const runScarcityBonus = positionalRunAlert?.position === player.position ? 2 : 0
      const liveScarcityBonus = liveScarcity.high ? 3 : liveScarcity.score >= 0.6 ? 1.5 : 0
      const scarcityBonus = tierCliff.bonus + runScarcityBonus + liveScarcityBonus
      const strategySignal = getPlayerStrategySignal(player)
      const ocImpact = getOcTendencyImpact(player, scoringFormat)
      const thematicSignal = getThematicStrategySignal({
        player,
        round: draftRound,
        rosterNeed,
        rosterCounts: selectedRosterCounts,
        starterTargets,
        flexSlots,
        superFlexSlots,
        scoringFormat,
        draftType,
      })
      const adpRound = getAdpRound(analystRank, draftData?.numTeams || 12)
      const note = getPlayerIntelligenceNote(player)
      const leagueFormat = getLeagueFormatKey(scoringFormat)
      const researchEdge = getResearchEdge({
        player,
        round: draftRound,
        adpRound,
        rosterNeed,
        rosterCounts: selectedRosterCounts,
        starterTargets,
        flexSlots,
        superFlexSlots,
        scoringFormat,
      })
      const manualStrategySignal = getManualStrategySignal({ strategyOverride: selectedStrategyOverride, player, round: draftRound, rosterCounts: selectedRosterCounts, starterTargets, flexSlots, scoringFormat, isSuperFlex: superFlexSlots > 0 })
      const valueLabel = getValueLabel(valueDiff)
      const isDeadZoneRb = player.position === "RB" && Number(currentPick) >= 35 && Number(currentPick) <= 80
      const deadZoneExempt = tags.includes("WORKHORSE") || tags.includes("LOTTERY") || valueGap >= 15
      const deadZonePenalty = isDeadZoneRb && !deadZoneExempt ? -7 : 0
      const intelligenceResearchDetail = note
        ? `${researchEdge.detail}${researchEdge.detail ? " | " : ""}${note.key_note || ""}${note.format_edge ? ` [${leagueFormat.toUpperCase()}]: ${note.format_edge}` : ""}`
        : researchEdge.detail
      const alertLines = []
      if (note?.risk_flag && note?.risk_alert) alertLines.push(note.risk_alert)
      if (note?.sleeper && note?.sleeper_note) alertLines.push(`💎 SLEEPER: ${note.sleeper_note}`)
      const intelligenceWhyNote = buildWhyNote(note, leagueFormat)
      const primaryStrategySignal = ocImpact || (manualStrategySignal.bonus !== 0 ? manualStrategySignal : researchEdge.bonus !== 0 ? researchEdge : strategySignal.bonus !== 0 ? strategySignal : thematicSignal)
      const positionMultiplier = getPositionMultiplier({ position: player.position, round: draftRound, scoringFormat, isSuperFlex: superFlexSlots > 0, rosterNeed })
      const strategyBonus = (strategySignal.bonus + thematicSignal.bonus + researchEdge.bonus + manualStrategySignal.bonus + roundGate.bonus + tierProfile.bonus + (ocImpact?.bonus || 0) + deadZonePenalty) * positionMultiplier
      const playerNote = getPlayerNote(player, scoringFormat)
      const analystContext = getAnalystContext(player)
      const ocSummary = getOcTendencySummary(player)
      const fallbackOcCards = {
        pass: { label: "OC pass", value: 50, detail: "No major pass-rate OC change flagged" },
        run: { label: "OC run", value: 50, detail: "No major run-rate OC change flagged" },
      }
      const whySignal = ocImpact
        ? `${ocImpact.coordinator} ${ocImpact.bonus > 0 ? "helps" : "adds risk to"} this ${player.position} profile.`
        : playerNote || primaryStrategySignal.detail
      const teamCompositionInsight = getRosterCompositionInsight({ position: player.position, rosterCounts: selectedRosterCounts, starterTargets, flexSlots, scoringFormat, round: draftRound })
      const compositeComponents = {
        vorp: Number((vbdProfile.vorp + tagFormatAdjustment).toFixed(1)),
        vona: vbdProfile.vona,
        opportunity: opportunityProfile.bonus,
        scheme: schemeProfile.bonus,
        category: categoryFlag?.bonus || 0,
        roundGate: roundGate.bonus,
        tier: tierProfile.bonus,
        deadZone: deadZonePenalty,
        scarcity: Number((scarcityBonus * 2 + liveScarcity.score).toFixed(1)),
        strategy: Number(strategyBonus.toFixed(1)),
      }
      const compositeRank = Number(Object.values(compositeComponents).reduce((sum, value) => sum + value, 0).toFixed(1))
      const whyPickNote = buildSuggestionWhy({ player, analystRank, valueDiff }, { currentPickOverall: Number(currentPick), buildType: activeBuildType })
      const valueScore = clamp(50 + valueDiff * 4, 0, 100)
      const expertScore = clamp(50 + expertEdge * 3, 0, 100)
      const needScore = clamp(50 + rosterNeed.bonus * 4, 0, 100)
      const formatScore = clamp(50 + formatBonus * 5, 0, 100)
      const scarcityScore = clamp(50 + scarcityBonus * 10, 0, 100)
      const strategyScore = clamp(50 + strategyBonus * 7, 0, 100)
      const baseResearchScore = clamp(50 + researchEdge.bonus * 7, 0, 100)
      const researchScore = computeResearchScore({ note, existingBaseResearch: baseResearchScore, playerValueVsAdp: valueDiff, leagueFormat })
      const advancedConfidenceBonus = (opportunityProfile.score >= 70 ? 8 : 0) + (schemeProfile.bonus > 0 ? 5 : 0) + (categoryFlag?.type?.includes("BUST") ? -18 : categoryFlag ? 8 : 0)
      const rawConfidenceScore = clamp(
        valueScore * 0.36 +
          expertScore * 0.18 +
          needScore * 0.16 +
          formatScore * 0.04 +
          scarcityScore * 0.04 +
          strategyScore * 0.06 +
          researchScore * 0.05 +
          opportunityProfile.score * 0.08 +
          clamp(50 + schemeProfile.bonus * 6, 0, 100) * 0.03 +
          advancedConfidenceBonus,
        0,
        100,
      )
      const valueConfidenceFloor = valueDiff > 0 ? clamp(valueScore - 8, 0, 100) : 0
      const confidenceScore = Math.round(Math.max(rawConfidenceScore, valueConfidenceFloor))
      const confidenceStars = getConfidenceStars(confidenceScore)
      const tierUrgency = scarcityBonus >= 4 ? 2 : scarcityBonus >= 2 ? 1 : 0
      const hybridScore = 0.44 * valueDiff + 0.22 * expertEdge + 0.14 * rosterNeed.bonus + 0.03 * formatBonus + 0.04 * scarcityBonus + 0.05 * strategyBonus + 0.08 * researchEdge.bonus + tierUrgency
      const contextualSupport = clamp(
        earlyContextAdjustment + rosterNeed.bonus * 0.45 + formatBonus * 0.25 + scarcityBonus * 0.45 + strategyBonus * 0.15 + researchEdge.bonus * 0.3 + tierUrgency,
        player.position === "TE" ? -6 : -8,
        player.position === "TE" ? 6 : 8,
      )
      const boardRankPressure = Number.isNaN(analystRank) ? 0 : (Number(currentPick) - analystRank) * 2.4
      const outsideTopValueStarterNeedPenalty = !topValuePlayerKeys.has(playerKey) && hasLaterRoundStarterNeed ? -10 : 0
      const finalScore = valueDiff * 15 + expertEdge * 1.2 + boardRankPressure + contextualSupport + outsideTopValueStarterNeedPenalty

      return {
        ...player,
        valueDiff,
        valueGap,
        valueLabel,
        vbdProfile,
        liveScarcity,
        tags,
        tagFormatAdjustment,
        formatAdjustedVorp: Number((compositeComponents.vorp + compositeComponents.opportunity + compositeComponents.scheme).toFixed(1)),
        compositeRank,
        compositeComponents,
        opportunityProfile,
        schemeProfile,
        tierProfile,
        categoryFlag,
        roundGate,
        confidenceStars,
        qbMode,
        scarcityFlag: scarcityBonus >= 3,
        scarcityMessage: positionalRunAlert?.position === player.position ? positionalRunAlert.message : tierCliff.nextName ? `Tier drop of ${tierCliff.gap} before ${tierCliff.nextName}. ${liveScarcity.message}` : liveScarcity.message,
        expertEdge,
        formatBonus,
        scarcityBonus,
        strategyBonus,
        strategySignal,
        thematicSignal,
        researchEdge: { ...researchEdge, detail: intelligenceResearchDetail },
        intelligenceNote: note,
        intelligenceWhyNote,
        alertLines,
        ocImpact,
        manualStrategySignal,
        playerNote: whyPickNote,
        analystContext,
        ocSummary,
        scoreCards: [
          { label: "Value", value: Math.round(valueScore), detail: `${valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(1)} vs ADP` },
          { label: "Roster", value: Math.round(needScore), detail: rosterNeed.reason },
          { label: "Tier", value: Math.round(scarcityScore), detail: scarcityBonus >= 4 ? `Meaningful ${scoringFormat} tier drop (${tierCliff.gap} to ${tierCliff.nextName || "next"})` : scarcityBonus > 0 ? `Small ${scoringFormat} tier edge (${tierCliff.gap})` : "No urgent format-adjusted tier cliff" },
          { label: "VBD", value: Math.round(clamp(50 + vbdProfile.vorp, 0, 100)), detail: `VORP ${vbdProfile.vorp}; VONA ${vbdProfile.vona}; VOLS ${vbdProfile.vols}` },
          { label: "Opp", value: opportunityProfile.score, detail: `${opportunityProfile.tier}: WOPR ${opportunityProfile.wopr}` },
          { label: "Scheme", value: Math.round(clamp(50 + schemeProfile.bonus * 6, 0, 100)), detail: `${schemeProfile.badges.join(", ")} (${schemeProfile.bonus >= 0 ? "+" : ""}${schemeProfile.bonus})` },
          { label: "Research", value: Math.round(researchScore), detail: `${researchEdge.label}: ${researchEdge.detail}` },
        ],
        teamCompositionInsight,
        rosterReason: rosterNeed.reason,
        confidenceScore,
        confidence: getConfidenceLabel(confidenceScore),
        confidenceColor: getSignalColor(confidenceScore),
        analystRank: Math.round(analystRank * 10) / 10,
        adp: analystRank,
        finalScore: Math.round(finalScore * 10) / 10,
        hybridScore,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.valueDiff - a.valueDiff || b.finalScore - a.finalScore || a.analystRank - b.analystRank || b.confidenceScore - a.confidenceScore || b.hybridScore - a.hybridScore)

  const suggestedPicks = getPositionSplitSuggestions(rankedSuggestedPicks, suggestionDisplayCount)
  const positionalFallbacks = POSITION_SPLIT_ORDER
    .flatMap((position) => {
      const recommendationCount = suggestedPicks.filter((player) => player.position === position).length
      if (recommendationCount > 0) return []
      const fallback = availablePlayers
        .filter((player) => player.position === position)
        .map((player) => {
          const analystRank = getAnalystCompositeRank(player, scoringFormat)
          if (Number.isNaN(analystRank)) return null
          const valueDiff = Number(currentPick || 0) - analystRank
          const confidenceScore = Math.round(clamp(50 + valueDiff * 4, 10, 92))
          return {
            ...player,
            analystRank: Math.round(analystRank * 10) / 10,
            valueDiff,
            valueLabel: getValueLabel(valueDiff),
            confidenceScore,
            confidenceColor: getSignalColor(confidenceScore),
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.valueDiff - a.valueDiff || a.analystRank - b.analystRank)[0]
      return [{ position, recommendationCount, fallback }]
    })

  const isHorizontal = layout === "horizontal"

  return (
    <Card className={isHorizontal ? "flex flex-col" : "flex h-full min-h-0 flex-col"} style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base font-bold tracking-wide" style={{ color: colors.gold }}>
          <span>SUGGESTED PICKS</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Top 3 • horizontal scroll • composite rank • {scoringFormat} • {draftTypeLabel} • {qbMode}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={isHorizontal ? "space-y-2 px-2 pt-0 pr-1 pb-2" : "min-h-0 flex-1 space-y-2 overflow-visible px-2 pt-0 pr-1 pb-2"}>
        {positionalRunAlert && (
          <div className="rounded-xl border px-3 py-2 text-xs font-black" style={{ borderColor: colors.gold, background: `${colors.gold}18`, color: colors.gold }}>
            {positionalRunAlert.message}
          </div>
        )}
        <div
          className="group rounded-xl border p-1.5 text-[11px] leading-snug transition-all duration-200 hover:p-2 focus-within:p-2"
          style={{ borderColor: colors.lightBorder, background: colors.tableRow, color: colors.textSecondary }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <div className="truncate font-black uppercase tracking-wide" style={{ color: colors.textPrimary }}>
                Current strategy: {strategyLock.label}
              </div>
              <div className="truncate text-[10px] font-semibold" style={{ color: colors.textSecondary }}>
                {strategyLock.next} · Hover for full strategy controls
              </div>
            </div>
            <div className="shrink-0 rounded border px-2 py-1 text-[10px] font-black" style={{ borderColor: colors.gold, color: colors.gold, background: `${colors.gold}12` }}>
              Health {rosterHealth.score}/100
            </div>
          </div>

          <div className="mt-1 grid grid-cols-5 overflow-hidden rounded-lg border text-center text-[10px] font-black uppercase" style={{ borderColor: colors.lightBorder }}>
            {["R1-2 Anchor", "R3-5 Support", "R6-9 Value", "R10-12 Lottery", "R13+ Stream"].map((label, index) => {
              const active = (draftRound <= 2 && index === 0) || (draftRound >= 3 && draftRound <= 5 && index === 1) || (draftRound >= 6 && draftRound <= 9 && index === 2) || (draftRound >= 10 && draftRound <= 12 && index === 3) || (draftRound >= 13 && index === 4)
              const palette = ["#22c55e", "#3b82f6", "#facc15", "#fb923c", "#94a3b8"]
              return <span key={label} className="px-1 py-1" style={{ background: active ? `${palette[index]}44` : "transparent", color: active ? palette[index] : colors.textSecondary }}>{label}</span>
            })}
          </div>

          <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:mt-2 group-hover:max-h-[34rem] group-hover:opacity-100 group-focus-within:mt-2 group-focus-within:max-h-[34rem] group-focus-within:opacity-100">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-lg border px-2 py-2" style={{ borderColor: colors.lightBorder, background: colors.card }}>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="font-black uppercase tracking-wide" htmlFor="strategy-override" style={{ color: colors.textSecondary }}>Pivot strategy</label>
                  <select
                    id="strategy-override"
                    value={selectedStrategyOverride}
                    onChange={(event) => setSelectedStrategyOverride?.(event.target.value)}
                    className="rounded-md border px-2 py-1 text-[11px] font-bold outline-none"
                    style={{ borderColor: colors.lightBorder, background: colors.card, color: colors.textPrimary }}
                  >
                    {STRATEGY_OPTIONS.map((strategy) => (
                      <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-1">Detected: {STRATEGY_OPTIONS.find((strategy) => strategy.value === strategyLock.detectedKey)?.label || "Balanced BPA"}</div>
                <div className="mt-1 font-black" style={{ color: colors.gold }}>Roster Health: {rosterHealth.score}/100 — {rosterHealth.message}</div>
                <div className="mt-1 font-semibold" style={{ color: colors.textPrimary }}>{strategyLock.next}</div>
              </div>

              <div className="rounded-lg border px-2 py-2" style={{ borderColor: colors.lightBorder, background: colors.card }}>
                <div>{strategyLock.guidance}</div>
                <div className="mt-1">{strategyLock.guardrail} {strategyLock.format}</div>
                <div className="mt-1" title={RESEARCH_PILLARS_2026.join(" ")}>{ANALYST_MODEL_VERSION}: layers round gates, opportunity metrics, scheme intel, {qbMode} QB strategy, sleeper/breakout/bust flags, VBD, ADP, tier cliffs, RB dead-zone caution, and elite-or-late QB/TE rules.</div>
              </div>
            </div>

            <details className="mt-2 rounded-lg border px-2 py-1" style={{ borderColor: colors.lightBorder }}>
              <summary className="cursor-pointer font-black uppercase" style={{ color: colors.gold }}>Scheme Intel</summary>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                {Object.entries(SCHEME_INTEL_2026).slice(0, 10).map(([team, scheme]) => (
                  <div key={team} className="rounded-md px-2 py-1" style={{ background: colors.card, color: colors.textSecondary }}>
                    <span className="font-black" style={{ color: colors.textPrimary }}>{team}</span> · pace {scheme.pace} · PA {scheme.paRate}% · motion {scheme.motionRate}% · RZ PROE {scheme.rzProe} · OL {scheme.olGrade} · {scheme.badges.join(", ")}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
        {positionalFallbacks.length > 0 && (
          <div className="rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: colors.lightBorder, background: colors.tableRow, color: colors.textSecondary }}>
            <div className="mb-1 font-black uppercase tracking-wide" style={{ color: colors.textPrimary }}>Best available for positions without a recommendation</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {positionalFallbacks.map(({ position, fallback }) => (
                <div key={position} className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-lg border px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: fallback ? fallback.confidenceColor : colors.lightBorder, background: fallback ? `${fallback.confidenceColor}12` : colors.card }}>
                  <div className="shrink-0">
                    <BubbleSymbol pos={position} colors={colors} />
                  </div>
                  {fallback ? (
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="truncate text-sm font-black" style={{ color: colors.textPrimary }} title={fallback.name}>{fallback.name}</div>
                        <span className="shrink-0 rounded-full border px-3 py-1 text-xs font-black shadow-sm" style={{ borderColor: colors.gold, background: colors.highlight, color: colors.gold }}>{fallback.confidenceScore}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-semibold">
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: `${getValueDiffColor(fallback.valueDiff)}18`, color: getValueDiffColor(fallback.valueDiff) }}>{fallback.valueDiff >= 20 ? "💎 " : fallback.valueDiff <= -20 ? "🫏 " : ""}{fallback.valueDiff >= 0 ? "+" : ""}{fallback.valueDiff.toFixed(1)} value</span>
                        <span style={{ color: colors.textSecondary }}>{fallback.valueLabel} · Rank {fallback.analystRank}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-black uppercase" style={{ color: colors.textSecondary }}>None</div>
                      <div className="mt-1 font-semibold">No available {position} with an analyst rank.</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {suggestedPicks.length === 0 ? (
          <div className="rounded border px-3 py-2 text-xs" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
            Connect a draft or load players to see pick suggestions.
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-2 pb-2 pt-1 md:grid-cols-3" aria-label="Suggested picks">
            {suggestedPicks.map((player, idx) => {
              const playerKey = String(player.id || `${player.name}-${player.team}-${player.position}`)
              const valueDiffColor = getValueDiffColor(player.valueDiff)
              const valueEmoji = player.valueDiff >= 20 ? "💎" : player.valueDiff <= -20 ? "🫏" : null
              return (
                <button
                  key={playerKey}
                  type="button"
                  className="group relative flex min-w-0 flex-col rounded-xl border p-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:-translate-y-0.5 focus:outline-none focus:ring-2"
                  style={{ borderColor: idx === 0 ? player.confidenceColor : colors.lightBorder, background: idx === 0 ? `${player.confidenceColor}18` : colors.tableRow, color: colors.textPrimary }}
                  aria-label={`Recommendation summary for ${player.name}; hover or focus to show a compact draft-day summary`}
                >
                  <div className={`pointer-events-none absolute top-full z-50 mt-2 hidden w-full min-w-[18rem] group-hover:block group-focus:block group-focus-within:block md:w-[28rem] ${idx === 0 ? "left-0 right-auto" : idx === suggestedPicks.length - 1 ? "left-auto right-0" : "left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2"}`}>
                    <div className="pointer-events-auto rounded-2xl border p-3 shadow-2xl backdrop-blur" style={{ borderColor: player.confidenceColor, background: colors.card }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: player.confidenceColor }}>{getActionLabel(player)} · {player.confidence} confidence</div>
                          <div className="mt-1 text-base font-black" style={{ color: colors.textPrimary }}>{player.alertLines?.length > 0 && (
                            <div className="mb-1 flex flex-wrap gap-1">
                              {player.intelligenceNote?.risk_flag && (
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="destructive" className="risk-badge text-[9px]">⚠️ RISK</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{player.intelligenceNote.risk_alert}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {player.intelligenceNote?.sleeper && <Badge variant="secondary" className="sleeper-badge bg-green-600 text-[9px] text-white hover:bg-green-600">💎 VALUE</Badge>}
                            </div>
                          )}
                          {player.name}</div>
                          <div className="mt-0.5 text-[11px]" style={{ color: colors.textSecondary }}>{player.position} · Rank {player.adp} · {player.valueLabel} · Composite {player.compositeRank} · Opp {player.opportunityProfile.score} · {player.rosterReason}</div>
                        </div>
                        <div className="rounded-full border px-3 py-2 text-center" style={{ borderColor: player.confidenceColor, background: `${player.confidenceColor}22` }}>
                          <div className="text-lg font-black leading-none" style={{ color: player.confidenceColor }}>{player.confidenceScore}</div>
                          <div className="mt-0.5 text-[9px] font-bold uppercase leading-none" style={{ color: colors.textSecondary }}>{player.confidenceStars.stars}</div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 rounded-xl border px-2 py-2 text-[11px] leading-snug" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                        {player.alertLines?.map((line: any) => <div key={line} className="rounded-md px-2 py-1 font-black" style={{ background: `${player.confidenceColor}18`, color: player.confidenceColor }}>{line}</div>)}
                        <div><span className="font-black" style={{ color: colors.textPrimary }}>Pick case:</span> {player.playerNote}</div>
                        <div><span className="font-black" style={{ color: colors.textPrimary }}>Roster fit:</span> {player.teamCompositionInsight}</div>
                        <div><span className="font-black" style={{ color: colors.textPrimary }}>Value:</span> {player.valueLabel} · {player.tierProfile.tier} · {player.scarcityMessage}</div>
                        <div><span className="font-black" style={{ color: colors.textPrimary }}>Opportunity:</span> {player.opportunityProfile.tier} ({player.opportunityProfile.score}/100){player.opportunityProfile.badges?.length ? ` · ${player.opportunityProfile.badges.slice(0, 2).join(", ")}` : ""}</div>
                        {player.categoryFlag && <div><span className="font-black" style={{ color: colors.textPrimary }}>Watch out:</span> {player.categoryFlag.type} — {player.categoryFlag.detail}</div>}
                        <div><span className="font-black" style={{ color: colors.textPrimary }}>Research:</span> {player.researchEdge.label} — {player.researchEdge.detail}</div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-4">
                        {player.scoreCards.map((card: any) => (
                          <div key={card.label} className="rounded-lg border px-2 py-1" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                            <div className="flex items-center justify-between gap-2"><span className="font-bold" style={{ color: colors.textPrimary }}>{card.label}</span><span className="font-bold" style={{ color: getSignalColor(card.value) }}>{card.value}</span></div>
                            <div className="mt-0.5 leading-snug" title={card.detail}>{card.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full items-center gap-2">
                    <span className="w-5 text-center text-xs font-black" style={{ color: player.confidenceColor }}>{idx + 1}</span>
                    <BubbleSymbol pos={player.position} colors={colors} compact />
                    <span className="min-w-0 flex-1 truncate text-sm font-black" title={player.name}>{player.name}</span>
                    {valueEmoji && <span className="shrink-0 text-base leading-none" aria-label={player.valueDiff >= 20 ? "Elite 20+ value pick" : "-20 or worse value fade"}>{valueEmoji}</span>}
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: `${player.confidenceColor}22`, color: player.confidenceColor }}>{player.confidenceScore}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 px-0.5 text-[10px] font-bold" style={{ color: colors.textSecondary }}>
                    <span>{player.position}</span>
                    <span>·</span>
                    <span className="rounded-full px-2 py-0.5 font-black" style={{ background: `${valueDiffColor}18`, color: valueDiffColor }}>{player.valueDiff >= 0 ? "+" : ""}{player.valueDiff.toFixed(1)} value</span>
                    <span>·</span>
                    <span>{player.confidence} confidence</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
