import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CUSTOM_RANKINGS = 25
const MAX_REQUEST_BYTES = 1_000_000
const MAX_PLAYERS_PER_RANKING = 600
const MAX_TEXT_FIELD_LENGTH = 120
const DATA_DIR = path.join(process.cwd(), ".data")
const DATA_FILE = path.join(DATA_DIR, "custom-rankings.json")

type RankingSet = {
  id?: string
  name?: string
  analyst?: string
  analysts?: string[]
  format?: string
  updated?: string
  playerCount?: number
  data?: unknown[]
}

type RankingPlayer = {
  id: string
  name: string
  firstName: string
  lastName: string
  position: string
  team: string
  adp: number
  expertRank?: number
  marketAdp?: number
  projectedPoints?: number
  value: number
  drafted: false
}

async function readRankingSets(): Promise<RankingSet[]> {
  try {
    const file = await fs.readFile(DATA_FILE, "utf8")
    const parsed = JSON.parse(file)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CUSTOM_RANKINGS) : []
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT") return []
    console.error("Custom rankings read error:", error)
    return []
  }
}

async function writeRankingSets(sets: RankingSet[]) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(sets.slice(0, MAX_CUSTOM_RANKINGS), null, 2))
}

async function readLimitedJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > MAX_REQUEST_BYTES) return { tooLarge: true, body: null }

  const reader = request.body?.getReader()
  if (!reader) return { tooLarge: false, body: null }

  let size = 0
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_REQUEST_BYTES) {
      await reader.cancel()
      return { tooLarge: true, body: null }
    }
    chunks.push(value)
  }

  try {
    const text = new TextDecoder().decode(Buffer.concat(chunks))
    return { tooLarge: false, body: JSON.parse(text) }
  } catch {
    return { tooLarge: false, body: null }
  }
}

function trimText(value: unknown, fallback = "") {
  return String(value || fallback).trim().slice(0, MAX_TEXT_FIELD_LENGTH)
}

function normalizeAnalysts(value: unknown) {
  const rawAnalysts = Array.isArray(value) ? value : String(value || "").split(/,|\s+&\s+|\s+and\s+/i)

  return rawAnalysts
    .map((analyst) => trimText(analyst))
    .filter(Boolean)
}

function finiteNumber(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function sanitizeRankingPlayer(player: unknown, index: number): RankingPlayer | null {
  if (!player || typeof player !== "object") return null

  const rawPlayer = player as Record<string, unknown>
  const name = trimText(rawPlayer.name)
  const position = trimText(rawPlayer.position || "FLEX", "FLEX").toUpperCase()

  if (!name || !position) return null

  return {
    id: trimText(rawPlayer.id, `row-${index}`),
    name,
    firstName: trimText(rawPlayer.firstName),
    lastName: trimText(rawPlayer.lastName),
    position,
    team: trimText(rawPlayer.team, "N/A"),
    adp: finiteNumber(rawPlayer.adp, index + 1),
    expertRank: rawPlayer.expertRank === undefined ? undefined : finiteNumber(rawPlayer.expertRank, index + 1),
    marketAdp: rawPlayer.marketAdp === undefined ? undefined : finiteNumber(rawPlayer.marketAdp, index + 1),
    projectedPoints:
      rawPlayer.projectedPoints === undefined ? undefined : finiteNumber(rawPlayer.projectedPoints, 0),
    value: finiteNumber(rawPlayer.value, 0),
    drafted: false,
  }
}

function sanitizeRankingSet(set: RankingSet): RankingSet | null {
  if (!set || typeof set !== "object") return null
  const analysts = normalizeAnalysts(set.analysts?.length ? set.analysts : set.analyst)
  const analyst = analysts.join(", ")
  const format = trimText(set.format)
  const updated = trimText(set.updated)
  const data = Array.isArray(set.data)
    ? set.data.slice(0, MAX_PLAYERS_PER_RANKING).map(sanitizeRankingPlayer).filter((player) => player !== null)
    : []

  if (!analyst || !format || !updated || data.length === 0) return null

  return {
    id: trimText(set.id, `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    name: trimText(set.name, analyst),
    analyst,
    analysts,
    format,
    updated,
    playerCount: data.length,
    data,
  }
}

export async function GET() {
  const sets = await readRankingSets()
  return NextResponse.json({ sets })
}

export async function POST(request: Request) {
  const { tooLarge, body } = await readLimitedJson(request)
  if (tooLarge) {
    return NextResponse.json({ error: "Custom ranking uploads must be 1 MB or less." }, { status: 413 })
  }

  const incomingSet = sanitizeRankingSet(body?.set)

  if (!incomingSet) {
    return NextResponse.json({ error: "A custom ranking set with analyst, format, updated, and players is required." }, { status: 400 })
  }

  const existingSets = await readRankingSets()
  const sets = [incomingSet, ...existingSets.filter((set) => set.id !== incomingSet.id)].slice(0, MAX_CUSTOM_RANKINGS)
  await writeRankingSets(sets)

  return NextResponse.json({ sets })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "A ranking set id is required." }, { status: 400 })
  }

  const existingSets = await readRankingSets()
  const sets = existingSets.filter((set) => set.id !== id)
  await writeRankingSets(sets)

  return NextResponse.json({ sets })
}
