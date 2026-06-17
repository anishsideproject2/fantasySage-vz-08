export const OC_VARIANCE_SYMBOL = "⚡"

// 2026 OC-change research, last refreshed 2026-06-17.
// Primary sources consulted:
// - FOX Sports 2026 Coaching/GM Tracker (updated 2026-02-20): lists Cardinals, Falcons, Ravens,
//   Bills, Browns, Broncos, Lions, Chiefs, Raiders, Chargers, Rams, Giants, Jets, Steelers,
//   Eagles, Seahawks, Buccaneers, Titans, and Commanders offensive coordinator hires/promotions.
// - CBS Sports 2026 coordinator grades: reports 21 teams hired new offensive coordinators and
//   identifies Bears OC Press Taylor plus Dolphins OC Bobby Slowik among the new OC hires.
export const NEW_OC_BY_TEAM = {
  ARI: { coordinator: "Nathaniel Hackett", note: "new HC/OC; scheme and play-caller assumptions are volatile" },
  ATL: { coordinator: "Tommy Rees", note: "new HC/OC; Cleveland-style transition creates usage variance" },
  BAL: { coordinator: "Declan Doyle", note: "new OC and first-time play-caller environment" },
  BUF: { coordinator: "Pete Carmichael Jr.", note: "new OC under promoted HC Joe Brady" },
  CHI: { coordinator: "Press Taylor", note: "new OC, but Ben Johnson remains the offensive driver" },
  CLE: { coordinator: "Travis Switzer", note: "new HC/OC with run-game roots" },
  DEN: { coordinator: "Davis Webb", note: "promoted OC; possible play-calling shift from Sean Payton" },
  DET: { coordinator: "Drew Petzing", note: "new OC joining a strong but changing offensive ecosystem" },
  KC: { coordinator: "Eric Bieniemy", note: "returning OC; familiar system but adjusted roles" },
  LAC: { coordinator: "Mike McDaniel", note: "major offensive philosophy change" },
  LAR: { coordinator: "Nathan Scheelhaase", note: "promoted OC/co-OC structure" },
  LV: { coordinator: "Andrew Janocko", note: "new HC/OC after staff overhaul" },
  MIA: { coordinator: "Bobby Slowik", note: "new HC/OC environment after Mike McDaniel departure" },
  NYG: { coordinator: "Matt Nagy", note: "new HC/OC staff with uncertain play-calling translation" },
  NYJ: { coordinator: "Frank Reich", note: "new OC and veteran play-caller reset" },
  PHI: { coordinator: "Sean Mannion", note: "new OC with limited play-calling sample" },
  PIT: { coordinator: "Brian Angelichio", note: "new HC/OC; Mike McCarthy expected to drive the offense" },
  SEA: { coordinator: "Brian Fleury", note: "new OC replacing Klint Kubiak" },
  TB: { coordinator: "Zac Robinson", note: "new OC and play-caller adjustment" },
  TEN: { coordinator: "Brian Daboll", note: "new HC/OC; high-upside but high-variance reset" },
  WAS: { coordinator: "David Blough", note: "new first-time OC after Kliff Kingsbury departure" },
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

export const getDraftStrategySignal = ({ player, rosterReason, scoringFormat }) => {
  const adp = Number.parseFloat(player.adp)
  const ocVariance = getTeamOcVariance(player.team)

  if (ocVariance) {
    return {
      label: `${OC_VARIANCE_SYMBOL} OC variance`,
      detail: `${ocVariance.coordinator}: ${ocVariance.note}`,
      tone: "variance",
    }
  }

  if (player.position === "RB" && adp <= 36) {
    return {
      label: "RB scarce",
      detail: "Early RBs are expensive; only take them when value and roster need agree.",
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
