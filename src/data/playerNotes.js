/**
 * Player intelligence notes for the draft suggestion engine.
 * Keys are normalized as firstname-lastname-teamabbrev.
 */
export const PLAYER_NOTES = {
  "jahmyr-gibbs-det": { name: "Jahmyr Gibbs", team: "DET", pos: "RB", adp_ppr: 2.1, opportunity: 94, confidence: 96, tags: ["WORKHORSE", "PASS_CATCHER", "DUAL_THREAT_RB"], sleeper: false, risk_flag: false, key_note: "Unquestioned DET bellcow after David Montgomery's departure (now HOU). Snap share jumped from 56% → 66.6% in 2025; led all RBs in 20+ yd runs (6). 94 targets last season. DET carries the league's easiest projected 2026 schedule.", risk_note: "Pacheco replaces Montgomery (minimal committee effect on Gibbs).", format_edge: "PPR elite — 94 targets justify the reception volume. Standard: Robinson edges him slightly via TD volume." },
  "puka-nacua-lar": { name: "Puka Nacua", team: "LAR", pos: "WR", adp_ppr: 3.5, opportunity: 97, confidence: 88, tags: ["TARGET_HOG", "SLOT", "ELITE_EFFICIENCY"], sleeper: false, risk_flag: false, key_note: "WR1 PPG in 3 consecutive seasons. Led ALL receivers with 20.0 PPR PPG since entering the league in 2023. Highest TPRR (0.38) among all WRs in 2025. 164 targets → 129 catches → 1,715 yards → 10 TDs. Red zone ceiling expands with Adams departed.", risk_note: "Off-field incident (entered rehab in early 2026) — monitor for any suspension. Stafford retirement would collapse value.", format_edge: "The single best PPR player outside the elite RBs. Exceptional full PPR due to reception volume. Slight Standard value drop but still WR1-tier." },
  "rashee-rice-kc": { name: "Rashee Rice", team: "KC", pos: "WR", adp_ppr: 20.0, opportunity: 82, confidence: 68, tags: ["SLOT", "TARGET_HOG", "RED_ZONE_WR"], sleeper: false, risk_flag: true, key_note: "In 8 healthy 2025 games: top-5 red zone targets, averaged elite PPR production, weekly WR1 upside. Mahomes' offense creates the premier KC target environment. Talent and opportunity are undeniable when available. Binary outcome: if cleared, WR1 overall candidate.", risk_note: "Multiple unresolved legal issues entering 2026. Suspension risk is real and significant.", risk_alert: "⚠️ OFF-FIELD: Multiple unresolved legal issues — suspension risk. Monitor through August.", format_edge: "Excellent all formats when healthy and available. Red zone integration makes him viable in Standard." },
  "bhayshul-tuten-jax": { name: "Bhayshul Tuten", team: "JAX", pos: "RB", adp_ppr: 65.0, opportunity: 78, confidence: 74, tags: ["WORKHORSE", "SPEEDSTER", "SLEEPER"], sleeper: true, sleeper_note: "Travis Etienne departed to NO — Tuten is the presumptive JAX starter. 4.29s 40-time (fastest RB in 2025 draft class). Averaged 12.8 FPTS in 10+ touch games. Scored in all 4 games with 9+ touches. JAX was 8th in rush attempts in 2025. Round 6-7 ADP, RB1 opportunity.", risk_flag: false, key_note: "Presumptive JAX starter after Etienne's departure. Elite athleticism (4.29 40). Scored in all 4 games with 9+ touches as a rookie. Home-run threat in a run-heavy scheme.", risk_note: "Fumbling issues in limited rookie sample. Chris Rodrigues (foot surgery recovery) could compete. JAX pass-catching void without Etienne limits PPR ceiling early.", format_edge: "Best Standard / Half-PPR given rush-heavy role. PPR upside limited until JAX passing game develops." },
  "tyler-shough-no": { name: "Tyler Shough", team: "NO", pos: "QB", adp_ppr: 105.0, opportunity: 77, confidence: 78, tags: ["DUAL_THREAT", "SLEEPER", "YEAR2_BREAKOUT"], sleeper: true, sleeper_note: "QB12 per-game as a rookie (9 starts, 69% completion rate). Year 2 in Kellen Moore's top-4 pace offense (top-4 in pace in 6 of 7 Moore seasons; NO ranked 1st in pace in 2025). NO used the 8th pick on WR Jordyn Tyson — upgraded weapons. Year 2 QB breakouts dominated 2025. QB20 ADP with QB12-15 ceiling.", risk_flag: false, key_note: "QB12 per-game rookie production with solid efficiency (69% comp) and rushing value added. Year 2 in Kellen Moore's pace-first offense. NO drafted WR Jordyn Tyson 8th overall. Saints were the fastest-paced offense in the NFL in 2025.", risk_note: "Small starter sample (9 games). Weak 2025 OL (19th in PFF grade). WR room relies on Olave + rookie Tyson.", format_edge: "Best Standard / Superflex. Viable late-round streaming QB1 with upside in 1QB leagues." },
}

export function getPlayerNoteId(firstName = "", lastName = "", teamAbbrev = "") {
  const normalize = (str = "") => String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "")
  return `${normalize(firstName)}-${normalize(lastName)}-${normalize(teamAbbrev)}`
}

export function buildWhyNote(note, format = "ppr") {
  if (!note) return null
  const lines = []
  if (note.risk_flag && note.risk_alert) lines.push(note.risk_alert)
  if (note.sleeper && note.sleeper_note) lines.push(`💎 SLEEPER: ${note.sleeper_note}`)
  if (note.key_note) lines.push(note.key_note)
  if (note.format_edge) lines.push(`[${format.toUpperCase()}] ${note.format_edge}`)
  return lines.join(" | ")
}

export const FORMAT_TAG_BOOSTS = {
  ppr: { tags: ["PASS_CATCHER", "TARGET_HOG", "RECEIVING_TE", "SLOT"], boost: 5 },
  half_ppr: { tags: ["WORKHORSE", "PASS_CATCHER", "TARGET_HOG", "DUAL_THREAT_RB"], boost: 3 },
  standard: { tags: ["WORKHORSE", "RED_ZONE_WR", "DUAL_THREAT_RB", "RED_ZONE_TE"], boost: 5 },
}
