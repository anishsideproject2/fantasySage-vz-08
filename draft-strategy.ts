export const OC_VARIANCE_SYMBOL = "⚡"

// 2026 OC-change research, last refreshed 2026-06-17.
// Primary sources consulted:
// - FOX Sports 2026 Coaching/GM Tracker (updated 2026-02-20): lists Cardinals, Falcons, Ravens,
//   Bills, Browns, Broncos, Lions, Chiefs, Raiders, Chargers, Rams, Giants, Jets, Steelers,
//   Eagles, Seahawks, Buccaneers, Titans, and Commanders offensive coordinator hires/promotions.
// - CBS Sports 2026 coordinator grades: reports 21 teams hired new offensive coordinators and
//   identifies Bears OC Press Taylor plus Dolphins OC Bobby Slowik among the new OC hires.
export const NEW_OC_BY_TEAM = {
  ARI: { coordinator: "Nathaniel Hackett", previousCoordinator: "Drew Petzing", note: "new HC/OC; scheme and play-caller assumptions are volatile" },
  ATL: { coordinator: "Tommy Rees", previousCoordinator: "Zac Robinson", note: "new HC/OC; Cleveland-style transition creates usage variance" },
  BAL: { coordinator: "Declan Doyle", previousCoordinator: "Todd Monken", note: "new OC and first-time play-caller environment" },
  BUF: { coordinator: "Pete Carmichael Jr.", previousCoordinator: "Joe Brady", note: "new OC under promoted HC Joe Brady" },
  CHI: { coordinator: "Press Taylor", previousCoordinator: "Declan Doyle", note: "new OC, but Ben Johnson remains the offensive driver" },
  CLE: { coordinator: "Travis Switzer", previousCoordinator: "Tommy Rees", note: "new HC/OC with run-game roots" },
  DEN: { coordinator: "Davis Webb", previousCoordinator: "Joe Lombardi", note: "promoted OC; possible play-calling shift from Sean Payton", actualChange: false },
  DET: { coordinator: "Drew Petzing", previousCoordinator: "John Morton", note: "new OC joining a strong but changing offensive ecosystem" },
  KC: { coordinator: "Eric Bieniemy", previousCoordinator: "Matt Nagy", note: "returning OC; familiar system but adjusted roles", actualChange: false },
  LAC: { coordinator: "Mike McDaniel", previousCoordinator: "Greg Roman", note: "major offensive philosophy change" },
  LAR: { coordinator: "Nathan Scheelhaase", previousCoordinator: "Mike LaFleur", note: "promoted OC/co-OC structure", actualChange: false },
  LV: { coordinator: "Andrew Janocko", previousCoordinator: "Chip Kelly", note: "new HC/OC after staff overhaul" },
  MIA: { coordinator: "Bobby Slowik", previousCoordinator: "Frank Smith", note: "new HC/OC environment after Mike McDaniel departure" },
  NYG: { coordinator: "Matt Nagy", previousCoordinator: "Mike Kafka", note: "new HC/OC staff with uncertain play-calling translation" },
  NYJ: { coordinator: "Frank Reich", previousCoordinator: "Tanner Engstrand", note: "new OC and veteran play-caller reset" },
  PHI: { coordinator: "Sean Mannion", previousCoordinator: "Kevin Patullo", note: "new OC with limited play-calling sample" },
  PIT: { coordinator: "Brian Angelichio", previousCoordinator: "Arthur Smith", note: "new HC/OC; Mike McCarthy expected to drive the offense" },
  SEA: { coordinator: "Brian Fleury", previousCoordinator: "Klint Kubiak", note: "new OC replacing Klint Kubiak" },
  TB: { coordinator: "Zac Robinson", previousCoordinator: "Josh Grizzard", note: "new OC and play-caller adjustment" },
  TEN: { coordinator: "Brian Daboll", previousCoordinator: "Nick Holz", note: "new HC/OC; high-upside but high-variance reset" },
  WAS: { coordinator: "David Blough", previousCoordinator: "Kliff Kingsbury", note: "new first-time OC after Kliff Kingsbury departure" },
}

export const normalizeTeamAbbr = (team) => {
  const value = String(team || "").trim().toUpperCase()
  const aliases = {
    ARZ: "ARI",
    JAC: "JAX",
    LA: "LAR",
    OAK: "LV",
    SD: "LAC",
    STL: "LAR",
    WSH: "WAS",
  }

  return aliases[value] || value
}

export const getTeamOcVariance = (team) => NEW_OC_BY_TEAM[normalizeTeamAbbr(team)] || null

const formatRate = (rate) => `${Math.round(rate * 10) / 10}%`
const formatDelta = (delta) => `${delta >= 0 ? "+" : ""}${Math.round(delta * 10) / 10} pts`
const normalizePlayerName = (name) => String(name || "").toLowerCase().replace(/[^a-z]/g, "")

const PASS_CATCHING_RBS = new Set([
  "jahmyrgibbs",
  "bijanrobinson",
  "christianmccaffrey",
  "devonachane",
  "breecehall",
  "saquonbarkley",
  "jonathantaylor",
  "jamescook",
  "alvinkamara",
  "rachaadwhite",
  "dandre swift",
].map(normalizePlayerName))

const RUN_SCHEME_RBS = new Set([
  "derrickhenry",
  "joshjacobs",
  "kyrenwilliams",
  "kennethwalker",
  "buckyirving",
  "chasebrown",
  "omarionhampton",
  "treveyonhenderson",
].map(normalizePlayerName))

// Situation-neutral tendencies compare each new OC's most recent 2025 offense sample
// to the player's 2025 team environment. Rates use neutral-script pass rate where
// available, otherwise overall pass/run split as the fallback proxy.
export const OC_TENDENCY_CHANGES_BY_TEAM = {
  ARI: { passRate: 58.7, runRate: 41.3, previousPassRate: 65.9, previousRunRate: 34.1, source: "Hackett's prior play-caller sample vs 2025 ARI" },
  ATL: { passRate: 54.1, runRate: 45.9, previousPassRate: 57.2, previousRunRate: 42.8, source: "Rees 2025 CLE profile vs 2025 ATL" },
  BAL: { passRate: 55.9, runRate: 44.1, previousPassRate: 52.9, previousRunRate: 47.1, source: "Doyle 2025 CHI profile vs 2025 BAL" },
  BUF: { passRate: 59.5, runRate: 40.5, previousPassRate: 56.1, previousRunRate: 43.9, source: "Carmichael play-caller profile vs 2025 BUF" },
  CHI: { passRate: 56.8, runRate: 43.2, previousPassRate: 55.9, previousRunRate: 44.1, source: "Taylor recent JAX/CHI profile vs 2025 CHI" },
  CLE: { passRate: 52.9, runRate: 47.1, previousPassRate: 58.4, previousRunRate: 41.6, source: "Switzer BAL run-game profile vs 2025 CLE" },
  DEN: { passRate: 57.6, runRate: 42.4, previousPassRate: 57.6, previousRunRate: 42.4, source: "Webb promotion; same 2025 DEN ecosystem" },
  DET: { passRate: 65.9, runRate: 34.1, previousPassRate: 54.8, previousRunRate: 45.2, source: "Petzing 2025 ARI profile vs 2025 DET" },
  KC: { passRate: 61.2, runRate: 38.8, previousPassRate: 59.5, previousRunRate: 40.5, source: "Bieniemy/KC profile vs 2025 KC" },
  LAC: { passRate: 56.2, runRate: 43.8, previousPassRate: 52.1, previousRunRate: 47.9, source: "McDaniel MIA profile vs 2025 LAC" },
  LAR: { passRate: 60.0, runRate: 40.0, previousPassRate: 60.0, previousRunRate: 40.0, source: "Scheelhaase promotion; same 2025 LAR ecosystem" },
  LV: { passRate: 57.9, runRate: 42.1, previousPassRate: 61.1, previousRunRate: 38.9, source: "Janocko SEA background vs 2025 LV" },
  MIA: { passRate: 58.9, runRate: 41.1, previousPassRate: 56.2, previousRunRate: 43.8, source: "Slowik HOU profile vs 2025 MIA" },
  NYG: { passRate: 59.5, runRate: 40.5, previousPassRate: 55.0, previousRunRate: 45.0, source: "Nagy/KC profile vs 2025 NYG" },
  NYJ: { passRate: 57.4, runRate: 42.6, previousPassRate: 56.0, previousRunRate: 44.0, source: "Reich veteran play-caller profile vs 2025 NYJ" },
  PHI: { passRate: 55.2, runRate: 44.8, previousPassRate: 49.5, previousRunRate: 50.5, source: "Mannion/GB profile vs 2025 PHI" },
  PIT: { passRate: 56.8, runRate: 43.2, previousPassRate: 59.3, previousRunRate: 40.7, source: "Angelichio/McCarthy profile vs 2025 PIT" },
  SEA: { passRate: 50.8, runRate: 49.2, previousPassRate: 57.9, previousRunRate: 42.1, source: "Fleury SF run-game profile vs 2025 SEA" },
  TB: { passRate: 57.2, runRate: 42.8, previousPassRate: 58.1, previousRunRate: 41.9, source: "Robinson ATL profile vs 2025 TB" },
  TEN: { passRate: 61.8, runRate: 38.2, previousPassRate: 62.4, previousRunRate: 37.6, source: "Daboll/Giants profile vs 2025 TEN" },
  WAS: { passRate: 58.6, runRate: 41.4, previousPassRate: 54.7, previousRunRate: 45.3, source: "Blough/WAS transition profile vs 2025 WAS" },
}

export const getOcTendencyChange = (team) => OC_TENDENCY_CHANGES_BY_TEAM[normalizeTeamAbbr(team)] || null

const OC_TENDENCY_NOTE_THRESHOLD = 5
const clampScore = (value) => Math.min(Math.max(value, 0), 100)

export const getOcTendencySummary = (player) => {
  const tendency = getOcTendencyChange(player.team)
  const ocVariance = getTeamOcVariance(player.team)
  if (!tendency || !ocVariance || ocVariance.actualChange === false) return null

  const makeRateSummary = (rateType) => {
    const nextRate = rateType === "run" ? tendency.runRate : tendency.passRate
    const previousRate = rateType === "run" ? tendency.previousRunRate : tendency.previousPassRate
    const delta = nextRate - previousRate
    const favorable = delta > 0

    return {
      label: `OC ${rateType} ${favorable ? "boost" : "drag"}`,
      value: Math.round(clampScore(50 + delta * 4)),
      detail: `${formatDelta(delta)} from ${ocVariance.previousCoordinator || "last year's OC"} to ${ocVariance.coordinator} (${formatRate(previousRate)} → ${formatRate(nextRate)})`,
      delta,
      rateType,
    }
  }

  return {
    coordinator: ocVariance.coordinator,
    previousCoordinator: ocVariance.previousCoordinator || "last year's OC",
    pass: makeRateSummary("pass"),
    run: makeRateSummary("run"),
  }
}

export const getOcTendencyImpact = (player, scoringFormat = "") => {
  const tendency = getOcTendencyChange(player.team)
  const ocVariance = getTeamOcVariance(player.team)
  if (!tendency || !ocVariance || ocVariance.actualChange === false) return null

  const passDelta = tendency.passRate - tendency.previousPassRate
  const runDelta = tendency.runRate - tendency.previousRunRate
  const position = String(player.position || "").toUpperCase()
  const scoring = String(scoringFormat || "").toLowerCase()
  const isPpr = scoring.includes("ppr")
  const playerKey = normalizePlayerName(player.name)
  const isReceivingRb = PASS_CATCHING_RBS.has(playerKey)
  const isRunSchemeRb = RUN_SCHEME_RBS.has(playerKey)
  const isPassCatcher = position === "WR" || position === "TE" || position === "QB"
  const rbRateType = isReceivingRb && (isPpr || Math.abs(passDelta) > Math.abs(runDelta)) ? "pass" : "run"
  const relevantDelta = position === "RB" ? (rbRateType === "pass" ? passDelta : runDelta) : isPassCatcher ? passDelta : 0
  if (Math.abs(relevantDelta) <= OC_TENDENCY_NOTE_THRESHOLD) return null

  const rateType = position === "RB" ? rbRateType : "pass"
  const nextRate = rateType === "run" ? tendency.runRate : tendency.passRate
  const previousRate = rateType === "run" ? tendency.previousRunRate : tendency.previousPassRate
  const favorable = relevantDelta > 0
  const previousCoordinator = ocVariance.previousCoordinator || "last year's OC"
  const rbContext = position === "RB" && isReceivingRb && rateType === "pass"
    ? " Receiving-back profile gets extra PPR relevance."
    : position === "RB" && isRunSchemeRb && rateType === "run"
      ? " Run-game profile is more tied to rushing volume."
      : ""
  const bonus = favorable ? (position === "RB" && isReceivingRb && rateType === "pass" && isPpr ? 5 : 4) : -4

  return {
    coordinator: ocVariance.coordinator,
    previousCoordinator,
    delta: relevantDelta,
    bonus,
    label: favorable ? `OC ${rateType} boost` : `OC ${rateType} drag`,
    detail: `${ocVariance.coordinator} vs ${previousCoordinator}: ${formatDelta(relevantDelta)} neutral ${rateType} rate (${formatRate(nextRate)} vs ${formatRate(previousRate)}).${rbContext}`,
  }
}

export const getPlayerNote = (player, scoringFormat = "") => {
  const ocImpact = getOcTendencyImpact(player, scoringFormat)
  if (ocImpact) return ocImpact.detail

  const adp = Number.parseFloat(player.adp)
  if (player.position === "RB" && adp <= 60) {
    return "RB market is pricey: try to secure a starter in rounds 1-5 before the room locks you into replacement-level backs."
  }
  return ""
}

export const getDraftStrategySignal = ({ player, rosterReason, scoringFormat }) => {
  const adp = Number.parseFloat(player.adp)
  const ocImpact = getOcTendencyImpact(player, scoringFormat)

  if (ocImpact) {
    return {
      label: `${OC_VARIANCE_SYMBOL} ${ocImpact.label}`,
      detail: ocImpact.detail,
      tone: ocImpact.bonus > 0 ? "value" : "variance",
    }
  }

  if (player.position === "RB" && adp <= 36) {
    return {
      label: "RB scarce",
      detail: "RB market is pricey; prioritize landing a starter in rounds 1-5 before the room locks you out.",
      tone: "scarcity",
    }
  }

  if (player.position === "WR" && adp >= 24 && adp <= 72) {
    return {
      label: "WR pocket",
      detail: "Middle-round WR depth is useful after a hero-RB start; let analyst rank/value drive the pick.",
      tone: "value",
    }
  }

  if (player.position === "TE" && adp <= 80) {
    return {
      label: "TE tier check",
      detail: "Only draft TE here for an open starter slot; avoid bench TE unless your league rules demand it.",
      tone: "tier",
    }
  }

  return {
    label: "Strategy",
    detail: `${scoringFormat}: ${rosterReason}. Keep following analyst rank, ADP value, and roster fit.`,
    tone: "neutral",
  }
}
