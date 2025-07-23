"use client"

const POSITION_LABELS = {
  FLEX: "WRT",
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  BN: "BN",
}

const getBubbleColorsForSlot = (pos, colors) => {
  switch (pos) {
    case "QB":
      return { bg: colors.pillQB, text: colors.pillTextQB }
    case "RB":
      return { bg: colors.pillRB, text: colors.pillTextRB }
    case "WR":
      return { bg: colors.pillWR, text: colors.pillTextWR }
    case "TE":
      return { bg: colors.pillTE, text: colors.pillTextTE }
    case "FLEX":
      return { bg: colors.pillWR, text: colors.pillTextWR }
    case "BN":
      return { bg: colors.pillBN, text: colors.pillTextBN }
    default:
      return { bg: "#333", text: colors.white }
  }
}

export function BubbleSymbol({ pos, colors }) {
  const { bg, text } = getBubbleColorsForSlot(pos, colors)
  return (
    <span
      className="inline-block px-2 py-1 rounded-full text-xs font-bold border"
      style={{
        background: bg,
        color: text,
        borderColor: colors.cardBorder,
      }}
    >
      {POSITION_LABELS[pos] || pos}
    </span>
  )
}
