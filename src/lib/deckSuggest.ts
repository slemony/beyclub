import { parseCombo } from './combo'
import { partCode } from './partIndex'
import { normalize } from './text'
import { slotEnabled, type BuildSlot } from './builds'
import { TIER_SCORES } from './buyRec'
import type { CollectionEntry, Part, PartCategory, SavedBuild } from './types'

export type DeckPins = Partial<Record<BuildSlot, string>>[]

export type RankedBuild = {
  build: SavedBuild
  score: number
  explanation: string[]
}

export type DeckSuggestion = {
  builds: RankedBuild[]
  score: number
  explanation: string[]
  random: boolean
}

export type SuggestFilters = {
  bannedBlades?: string[]
  bannedParts?: string[]
  excludeAttackBits?: boolean
}

export type SuggestDeckResult =
  | { ok: true; suggestion: DeckSuggestion }
  | { ok: false; reason: string }

const ACCESSORY_SLOTS: [Exclude<BuildSlot, 'blade'>, PartCategory][] = [
  ['ratchet', 'ratchet'],
  ['bit', 'bit'],
  ['assist', 'assist'],
  ['overblade', 'overblade'],
]

const ownKey = (cat: PartCategory, code: string) => `${cat}|${normalize(code)}`
const scoreOf = (part: Part) => part.rating?.score ?? TIER_SCORES[part.tier] ?? 0
const labelOf = (part: Part) => part.nameEn ?? part.name

type Candidate = {
  build: SavedBuild
  parts: Part[]
  score: number
  explanation: string[]
  randomRank: number
}

/**
 * Finds a strong, complete three-bey deck using only catalogue parts present
 * in the collection. `seed` selects a reproducible weighted variation; omit it
 * to return the highest-scoring legal deck.
 */
export function suggestDeck(
  parts: Part[],
  entries: CollectionEntry[],
  pins: DeckPins,
  allowDuplicates: boolean,
  seed?: number,
  filters: SuggestFilters = {},
): SuggestDeckResult {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    if (!entry.code) continue
    const key = ownKey(entry.cat, entry.code)
    counts.set(key, (counts.get(key) ?? 0) + entry.sources.reduce((n, source) => n + source.qty, 0))
  }

  const owned = new Map<string, Part>()
  for (const part of parts) {
    if ((counts.get(ownKey(part.cat, partCode(part.cat, part.id))) ?? 0) > 0) {
      owned.set(ownKey(part.cat, partCode(part.cat, part.id)), part)
    }
  }

  const bannedBlades = new Set((filters.bannedBlades ?? []).map(normalize))
  const bannedParts = new Set((filters.bannedParts ?? []).map((key) => normalize(key)))
  const blades = [...owned.values()].filter((part) => part.cat === 'blade' && !bannedBlades.has(normalize(part.id)))
  if (blades.length < 3) {
    return { ok: false, reason: `You need at least 3 different owned blades; your collection has ${blades.length}.` }
  }

  const categoryParts = new Map<PartCategory, Part[]>([
    ['ratchet', []], ['bit', []], ['assist', []], ['overblade', []],
  ])
  for (const part of owned.values()) {
    if (part.cat === 'blade') continue
    if (bannedParts.has(normalize(ownKey(part.cat, partCode(part.cat, part.id))))) continue
    if (filters.excludeAttackBits && part.cat === 'bit' && part.type === 'attack') continue
    categoryParts.get(part.cat)?.push(part)
  }

  const randomMode = seed !== undefined
  const rng = seededRandom(seed ?? 0)

  // Build a separate candidate pool for each row: pins belong to a row, so a
  // part locked in row two must not accidentally become a constraint on row one.
  const byPosition = Array.from({ length: 3 }, (_, position) => {
    const pin = pins[position] ?? {}
    const candidateSets = blades
      .filter((blade) => !pin.blade || normalize(pin.blade) === normalize(blade.id))
      .map((blade) => makeCandidates(blade, categoryParts, pin, randomMode ? rng : undefined))
      .filter((set) => set.length > 0)
      .sort((a, b) => randomMode ? b[0].randomRank - a[0].randomRank : b[0].score - a[0].score)
    return candidateSets.slice(0, pin.blade ? candidateSets.length : randomMode ? 60 : 24).flat()
  })

  if (byPosition.some((options) => options.length === 0)) {
    return { ok: false, reason: 'A pinned blade or part cannot be completed from the parts you own. Change a pinned choice and try again.' }
  }

  let chosen: Candidate[] | undefined
  let chosenRank = Number.NEGATIVE_INFINITY
  const selected: Candidate[] = []
  const usedCounts = new Map<string, number>()
  const bladeKeys = new Set<string>()

  const visit = (position: number, total: number): boolean => {
    if (position === 3) {
      const mean = total / 3
      if (randomMode) {
        chosen = [...selected]
        chosenRank = mean
        return true
      }
      const rank = mean
      if (rank > chosenRank) {
        chosenRank = rank
        chosen = [...selected]
      }
      return false
    }

    for (const candidate of byPosition[position]) {
      const bladeKey = ownKey('blade', candidate.build.blade ?? '')
      if (bladeKeys.has(bladeKey)) continue

      const added: string[] = []
      let valid = true
      for (const part of candidate.parts) {
        const key = ownKey(part.cat, partCode(part.cat, part.id))
        const nextCount = (usedCounts.get(key) ?? 0) + 1
        const max = Math.min(counts.get(key) ?? 0, allowDuplicates ? Number.POSITIVE_INFINITY : 1)
        if (nextCount > max) {
          valid = false
          break
        }
        usedCounts.set(key, nextCount)
        added.push(key)
      }

      let stop = false
      if (valid) {
        bladeKeys.add(bladeKey)
        selected.push(candidate)
        stop = visit(position + 1, total + candidate.score)
        selected.pop()
        bladeKeys.delete(bladeKey)
      }
      for (const key of added) {
        const next = (usedCounts.get(key) ?? 1) - 1
        if (next) usedCounts.set(key, next)
        else usedCounts.delete(key)
      }
      if (stop) return true
    }
    return false
  }

  visit(0, 0)
  if (!chosen) {
    return { ok: false, reason: 'I could not find three complete builds with these pinned choices and available parts. Remove a pin or allow owned duplicate parts.' }
  }

  const rankedBuilds: RankedBuild[] = chosen.map(({ build, score, explanation }) => ({ build, score, explanation }))
  const deckScore = rankedBuilds.reduce((sum, build) => sum + build.score, 0) / rankedBuilds.length
  const explain = [
    `Average deck competitiveness score: ${Math.round(deckScore)} / 100.`,
    allowDuplicates
      ? 'Repeated parts are allowed only up to the number of copies in your collection.'
      : 'No part is repeated within this deck; your other saved decks are considered separately.',
    seed === undefined ? 'Ranked highest among the searched owned-part combinations.' : 'Randomised among high-scoring legal combinations.',
  ]

  return { ok: true, suggestion: { builds: rankedBuilds, score: deckScore, explanation: explain, random: seed !== undefined } }
}

function makeCandidates(
  blade: Part,
  categoryParts: Map<PartCategory, Part[]>,
  pin: Partial<Record<BuildSlot, string>>,
  rng?: () => number,
): Candidate[] {
  const slotParts: [Exclude<BuildSlot, 'blade'>, PartCategory, Part[]][] = []

  for (const [slot, cat] of ACCESSORY_SLOTS) {
    const pinnedCode = pin[slot]
    if (!slotEnabled(slot, blade)) {
      if (pinnedCode) return []
      continue
    }
    let options = categoryParts.get(cat) ?? []
    if (pinnedCode) options = options.filter((part) => normalize(partCode(cat, part.id)) === normalize(pinnedCode))
    options = [...options].sort((a, b) => partPotential(blade, slot, b) - partPotential(blade, slot, a))
    if (pinnedCode) options = options.slice(0, 1)
    else if (rng) options = randomPartPool(blade, slot, options, rng)
    else options = options.slice(0, 12)
    if (!options.length) return []
    slotParts.push([slot, cat, options])
  }

  const result: Candidate[] = []
  const selected: Part[] = []
  const chosenCodes: Partial<Record<BuildSlot, string>> = { blade: blade.id }

  const collect = (at: number) => {
    if (at < slotParts.length) {
      const [slot, cat, options] = slotParts[at]
      for (const part of options) {
        chosenCodes[slot] = partCode(cat, part.id)
        selected.push(part)
        collect(at + 1)
        selected.pop()
      }
      delete chosenCodes[slot]
      return
    }

    const { score, explanation } = scoreBuild(blade, selected)
    const build: SavedBuild = {
      id: '',
      blade: blade.id,
      ratchet: chosenCodes.ratchet,
      bit: chosenCodes.bit,
      assist: chosenCodes.assist,
      overblade: chosenCodes.overblade,
      createdAt: '',
      updatedAt: '',
    }
    const randomRank = rng ? score + (rng() - 0.25) * 30 : score
    result.push({ build, parts: [blade, ...selected], score, explanation, randomRank })
  }

  collect(0)
  result.sort((a, b) => rng ? b.randomRank - a.randomRank : b.score - a.score)
  return result.slice(0, rng ? 12 : 6)
}

/** Keep the strongest choices, then sample lower-ranked owned parts as well. */
function randomPartPool(blade: Part, slot: Exclude<BuildSlot, 'blade'>, sorted: Part[], rng: () => number): Part[] {
  // Keep the Cartesian search bounded (a blade can have four accessory slots).
  const poolSize = 10
  if (sorted.length <= poolSize) return sorted
  const selected = sorted.slice(0, 6)
  const remaining = sorted.slice(6)
  while (selected.length < poolSize && remaining.length) {
    const weights = remaining.map((_, index) => 1 / (1 + (index + 6) * 0.045))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let pick = rng() * total
    let at = 0
    while (at < weights.length - 1 && (pick -= weights[at]) > 0) at += 1
    selected.push(remaining.splice(at, 1)[0])
  }
  return selected.sort((a, b) => partPotential(blade, slot, b) - partPotential(blade, slot, a))
}

function partPotential(blade: Part, slot: Exclude<BuildSlot, 'blade'>, part: Part): number {
  let value = scoreOf(part)
  if (slot === 'ratchet' && blade.rating?.tournament?.topRatchet && normalize(blade.rating.tournament.topRatchet) === normalize(partCode(part.cat, part.id))) value += 18
  if (slot === 'bit' && blade.rating?.tournament?.topBit && normalize(blade.rating.tournament.topBit) === normalize(partCode(part.cat, part.id))) value += 18
  return value
}

function scoreBuild(blade: Part, accessories: Part[]) {
  const partsUsed = [blade, ...accessories]
  const total = partsUsed.reduce((sum, part) => sum + scoreOf(part), 0)
  // Keep the score on the same 0–100 scale as the app's blended ratings,
  // reserving one fifth for directly observed combo-pairing evidence.
  let score = (total / partsUsed.length) * 0.8
  const reasons: string[] = []
  const record = blade.rating?.tournament

  if (record) {
    reasons.push(`${record.allTime} all-time and ${record.recent90} recent top-four placements${record.firsts ? `, ${record.firsts} first places` : ''}.`)
  } else {
    reasons.push('No tournament placement record; this blade is scored from available part ratings.')
  }

  const ratchet = accessories.find((part) => part.cat === 'ratchet')
  const bit = accessories.find((part) => part.cat === 'bit')
  if (ratchet && record?.topRatchet && normalize(partCode('ratchet', ratchet.id)) === normalize(record.topRatchet)) {
    score += 8
    reasons.push(`${labelOf(ratchet)} is the ratchet most often recorded with this blade.`)
  }
  if (bit && record?.topBit && normalize(partCode('bit', bit.id)) === normalize(record.topBit)) {
    score += 8
    reasons.push(`${labelOf(bit)} is the bit most often recorded with this blade.`)
  }

  const parsed = [parseCombo(blade.combo), parseCombo(blade.communityCombo)]
  const custom = blade.customBuilds ?? []
  const assist = accessories.find((part) => part.cat === 'assist')
  const matchingCombo = parsed.some((combo) =>
    combo.builds.some((build) => {
      const ratchetMatches = !ratchet || build.ratchets.some((code) => normalize(code) === normalize(ratchet.id))
      const bitMatches = !bit || build.bits.some((code) => normalize(code) === normalize(bit.id))
      const assistCode = assist?.id.replace(/^輔助/, '')
      const assistMatches = !assist || build.assists.some((code) => normalize(code) === normalize(assistCode ?? ''))
      return ratchetMatches && bitMatches && assistMatches
    }),
  )
  const matchingCustom = custom.some((build) =>
    normalize(build.ratchet) === normalize(ratchet?.id ?? '') &&
    normalize(build.bit) === normalize(bit?.id ?? '') &&
    (!build.assist || normalize(build.assist) === normalize(assist?.id.replace(/^輔助/, '') ?? '')),
  )
  if (matchingCombo || matchingCustom) {
    score += 4
    reasons.push('This combination also appears in a published combo recommendation.')
  }

  reasons.push(...partsUsed.map((part) => {
    const sources = [
      part.rating?.tournament ? 'tournament results' : undefined,
      part.rating?.community ? 'Taiwan community grades' : undefined,
      part.rating?.japan ? 'Japan grades' : undefined,
    ].filter(Boolean)
    const rating = part.tier === '-' ? 'unrated' : `blended grade ${part.tier}`
    const evidence = sources.length ? ` from ${sources.join(', ')}` : ' with no published grade evidence'
    return `${labelOf(part)}: ${rating}${evidence}.`
  }))
  return { score, explanation: reasons }
}

function seededRandom(seed: number) {
  let state = (seed >>> 0) || 0x6d2b79f5
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
