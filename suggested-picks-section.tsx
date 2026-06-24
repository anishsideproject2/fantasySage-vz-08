"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BubbleSymbol } from "./bubble-symbol"
import { OC_VARIANCE_SYMBOL, getOcTendencyImpact, getOcTendencySummary, getPlayerNote } from "./draft-strategy"

const FLEX_POSITIONS = ["RB", "WR", "TE"]
const BENCH_TARGET_POSITIONS = ["RB", "WR"]

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

// Sources reflected in this model: FantasyPros Hero RB/Zero RB/QB strategy (May-Jun 2026),
// Footballguys 2026 RB/WR/TE strategy guides, Yahoo prospect target-share research,
// and Washington Post draft-efficiency research on WR/RB/QB/TE payoff curves.
const RESEARCH_PILLARS_2026 = [
  "Hero/Anchor RB research favors landing one early workhorse, then pivoting to target-earning WRs and selective onesie values.",
  "Zero-RB research still works when the room gives elite WR/TE value; do not patch RB with low-upside dead-zone volume.",
  "QB research is barbell: in 1QB, either take a true rushing/elite edge or wait past the comfort tier; Superflex stays QB-heavy.",
  "TE research is also barbell: elite leverage or late athletic upside beats the middle-round safety trap.",
  "WR evaluation should overweight target earning, especially prospect/young-player target share and clear No. 1 routes.",
]

const ANALYST_MODEL_VERSION = "Analyst Predictor v2 · sourced 2026 strategy blend"

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

const getRoundPlan = ({ round, isSuperFlex, scoringFormat }) => {
  if (isSuperFlex && round <= 3) return "Superflex: keep QB scarcity live while still comparing elite RB/WR values."
  if (round <= 2) return scoringFormat === "Full PPR" ? "Open with elite target volume or a true anchor RB; avoid low-ceiling positional reaches." : "Prioritize elite WRs and true bellcow RBs before positional cliffs appear."
  if (round <= 4) return "Build the RB/WR core, but let elite QB/TE leverage through only when the tier edge is real."
  if (round <= 8) return "Middle rounds: prefer target-earning WRs and clear tier drops; fade RB/TE safety traps unless role clarity is strong."
  return "Bench rounds: chase RB contingency upside, WR spike weeks, and late QB/TE athletic upside; skip redundant floor plays."
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
    if (isMiddle && adp <= 90) return { bonus: 3, label: "TE tier value", detail: "Middle-round TE value is better than forcing the position early." }
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

export function SuggestedPicksSection({ colors, draftData, currentPick, getAvailablePlayers, draftedPlayers = [], selectedTeamRosterId, layout = "stacked" }) {
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
    const flexOpen = position === "RB" || position === "WR" ? Math.max(flexEligibleTarget - flexEligibleCount, 0) : 0
    const superFlexOpen = position === "QB" ? Math.max(starterTargets.QB + superFlexSlots - count, 0) : 0
    const benchOpen = selectedRosterCounts.total >= starterCount && selectedRosterCounts.total < rosterSize
    const rosterFull = selectedRosterCounts.total >= rosterSize

    if (directOpen > 0) return { bonus: position === "RB" || position === "WR" ? 10 : 8, reason: `${directOpen} ${position} starter slot${directOpen === 1 ? "" : "s"} open`, eligible: true }
    if (superFlexOpen > 0) return { bonus: 7, reason: `${superFlexOpen} superflex QB slot${superFlexOpen === 1 ? "" : "s"} open`, eligible: true }
    if (position === "QB" || position === "TE") {
      return { bonus: -100, reason: `skip double ${position}; starter slot is covered`, eligible: false }
    }
    if (flexOpen > 0) return { bonus: 6, reason: `${flexOpen} flex slot${flexOpen === 1 ? "" : "s"} open`, eligible: true }
    if (benchOpen && BENCH_TARGET_POSITIONS.includes(position)) return { bonus: 3, reason: `bench upside should be RB/WR only`, eligible: true }
    if (rosterFull) return { bonus: -10, reason: "roster is full", eligible: false }
    return { bonus: 1, reason: `usable ${position} depth`, eligible: BENCH_TARGET_POSITIONS.includes(position) }
  }

  const getScarcityBonus = (player, available) => getTierCliff(player, available, scoringFormat)

  const availablePlayers = getAvailablePlayers?.() || []
  const draftRound = draftData?.numTeams ? Math.floor((Number(currentPick) - 1) / draftData.numTeams) + 1 : 1

  const roundPlan = getRoundPlan({ round: draftRound, isSuperFlex: superFlexSlots > 0, scoringFormat })

  const suggestedPicks = availablePlayers
    .map((player) => {
      if (player.adp === undefined || isNaN(player.adp) || !currentPick) return null
      const valueDiff = Number.parseFloat(currentPick) - Number.parseFloat(player.adp)
      const marketAdp = Number.parseFloat(player.marketAdp || player.adp)
      const expertRank = getFormatAwareRank(player, scoringFormat)
      const expertEdge = Number.isNaN(marketAdp) || Number.isNaN(expertRank) ? 0 : marketAdp - expertRank
      const rosterNeed = getRosterNeed(player.position)
      const formatBonus = getFormatBonus(player.position)
      if (!rosterNeed.eligible) return null
      const tierCliff = getScarcityBonus(player, availablePlayers)
      const scarcityBonus = tierCliff.bonus
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
      const adpRound = getAdpRound(player.adp, draftData?.numTeams || 12)
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
      const primaryStrategySignal = ocImpact || (researchEdge.bonus !== 0 ? researchEdge : strategySignal.bonus !== 0 ? strategySignal : thematicSignal)
      const positionMultiplier = getPositionMultiplier({ position: player.position, round: draftRound, scoringFormat, isSuperFlex: superFlexSlots > 0, rosterNeed })
      const strategyBonus = (strategySignal.bonus + thematicSignal.bonus + researchEdge.bonus + (ocImpact?.bonus || 0)) * positionMultiplier
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
      const whyPickNote = `${valueDiff >= 0 ? "Pick for value" : "Only pick if you need the position"}: ${valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(1)} vs ADP with ${rosterNeed.reason}. ${whySignal}`
      const valueScore = clamp(50 + valueDiff * 4, 0, 100)
      const expertScore = clamp(50 + expertEdge * 3, 0, 100)
      const needScore = clamp(50 + rosterNeed.bonus * 4, 0, 100)
      const formatScore = clamp(50 + formatBonus * 5, 0, 100)
      const scarcityScore = clamp(50 + scarcityBonus * 10, 0, 100)
      const strategyScore = clamp(50 + strategyBonus * 7, 0, 100)
      const researchScore = clamp(50 + researchEdge.bonus * 7, 0, 100)
      const confidenceScore = Math.round(
        clamp(valueScore * 0.28 + expertScore * 0.17 + needScore * 0.22 + formatScore * 0.05 + scarcityScore * 0.07 + strategyScore * 0.11 + researchScore * 0.10, 0, 100),
      )
      const tierUrgency = scarcityBonus >= 4 ? 2 : scarcityBonus >= 2 ? 1 : 0
      const hybridScore = 0.3 * valueDiff + 0.19 * expertEdge + 0.19 * rosterNeed.bonus + 0.04 * formatBonus + 0.07 * scarcityBonus + 0.11 * strategyBonus + 0.1 * researchEdge.bonus + tierUrgency

      return {
        ...player,
        valueDiff,
        expertEdge,
        formatBonus,
        scarcityBonus,
        strategyBonus,
        strategySignal,
        thematicSignal,
        researchEdge,
        ocImpact,
        playerNote: whyPickNote,
        analystContext,
        ocSummary,
        scoreCards: [
          { label: "Value", value: Math.round(valueScore), detail: `${valueDiff >= 0 ? "+" : ""}${valueDiff.toFixed(1)} vs ADP` },
          { label: "Roster", value: Math.round(needScore), detail: rosterNeed.reason },
          { label: "Tier", value: Math.round(scarcityScore), detail: scarcityBonus >= 4 ? `Meaningful ${scoringFormat} tier drop (${tierCliff.gap} to ${tierCliff.nextName || "next"})` : scarcityBonus > 0 ? `Small ${scoringFormat} tier edge (${tierCliff.gap})` : "No urgent format-adjusted tier cliff" },
          { label: "Research", value: Math.round(researchScore), detail: `${researchEdge.label}: ${researchEdge.detail}` },
        ],
        teamCompositionInsight,
        rosterReason: rosterNeed.reason,
        confidenceScore,
        confidence: getConfidenceLabel(confidenceScore),
        confidenceColor: getSignalColor(confidenceScore),
        hybridScore,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.confidenceScore - a.confidenceScore || b.hybridScore - a.hybridScore)
    .slice(0, 8)


  const isHorizontal = layout === "horizontal"

  return (
    <Card className={isHorizontal ? "flex flex-col" : "flex h-full min-h-0 flex-col"} style={{ background: colors.card, border: `1px solid ${colors.lightBorder}` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base font-bold tracking-wide" style={{ color: colors.gold }}>
          <span>SUGGESTED PICKS</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Live top 8 • analyst-value confidence • {scoringFormat} • {draftTypeLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={isHorizontal ? "space-y-2 px-2 pt-0 pr-1 pb-2" : "min-h-0 flex-1 space-y-2 overflow-visible px-2 pt-0 pr-1 pb-2"}>
        <div className="rounded-xl border p-2 text-[11px] leading-snug" style={{ borderColor: colors.lightBorder, background: colors.tableRow, color: colors.textSecondary }}>
          <div className="font-black uppercase tracking-wide" style={{ color: colors.textPrimary }}>2026 plan for this pick</div>
          <div className="mt-1">{roundPlan}</div>
          <div className="mt-1" title={RESEARCH_PILLARS_2026.join(" ")}>{ANALYST_MODEL_VERSION}: VBD + roster fit + ADP + tier cliffs + barbell QB/TE + RB dead-zone/WR target-earning research.</div>
        </div>
        {suggestedPicks.length === 0 ? (
          <div className="rounded border px-3 py-2 text-xs" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
            Connect a draft or load players to see pick suggestions.
          </div>
        ) : (
          <div className={isHorizontal ? "grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2" : "grid gap-2 pb-1 sm:grid-cols-2"}>
            {suggestedPicks.map((player, idx) => (
              <div key={player.id} className="group relative">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: idx === 0 ? player.confidenceColor : colors.lightBorder, background: idx === 0 ? `${player.confidenceColor}18` : colors.tableRow, color: colors.textPrimary }}
                  aria-label={`Show details for ${player.name}`}
                >
                  <span className="text-xs font-black" style={{ color: player.confidenceColor }}>{idx + 1}</span>
                  <BubbleSymbol pos={player.position} colors={colors} />
                  <span className="min-w-0 truncate text-sm font-black" title={player.name}>
                    {player.name}{player.ocImpact && <span title={player.ocImpact.detail}> {OC_VARIANCE_SYMBOL}</span>}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: `${player.confidenceColor}22`, color: player.confidenceColor }}>{player.confidenceScore}</span>
                </button>

                <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[min(92vw,34rem)] translate-y-1 rounded-2xl border p-3 opacity-0 shadow-2xl transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100" style={{ borderColor: player.confidenceColor, background: colors.card }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: player.confidenceColor }}>{getActionLabel(player)} · {player.confidence} confidence</div>
                      <div className="mt-1 text-base font-black" style={{ color: colors.textPrimary }}>{player.name}</div>
                      <div className="mt-0.5 text-[11px]" style={{ color: colors.textSecondary }}>{player.position} · ADP {player.adp} · {player.rosterReason}</div>
                    </div>
                    <div className="rounded-full border px-3 py-2 text-center" style={{ borderColor: player.confidenceColor, background: `${player.confidenceColor}22` }}>
                      <div className="text-lg font-black leading-none" style={{ color: player.confidenceColor }}>{player.confidenceScore}</div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase leading-none" style={{ color: colors.textSecondary }}>score</div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 rounded-xl border px-2 py-2 text-[11px] leading-snug" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                    <div><span className="font-black" style={{ color: colors.textPrimary }}>Why:</span> {player.playerNote}</div>
                    <div><span className="font-black" style={{ color: colors.textPrimary }}>Team build:</span> {player.teamCompositionInsight}</div>
                    <div><span className="font-black" style={{ color: colors.textPrimary }}>Research edge:</span> {player.researchEdge.label} — {player.researchEdge.detail}</div>
                    <div><span className="font-black" style={{ color: colors.textPrimary }}>{player.analystContext.analyst} note:</span> {player.analystContext.fact} <a className="font-bold underline" href={player.analystContext.url} target="_blank" rel="noreferrer">Source</a></div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-4">
                    {player.scoreCards.map((card) => (
                      <div key={card.label} className="rounded-lg border px-2 py-1" style={{ borderColor: colors.lightBorder, color: colors.textSecondary }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold" style={{ color: colors.textPrimary }}>{card.label}</span>
                          <span className="font-bold" style={{ color: getSignalColor(card.value) }}>{card.value}</span>
                        </div>
                        <div className="mt-0.5 leading-snug" title={card.detail}>{card.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
