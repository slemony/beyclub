import type { Part, PartCategory, PartSpec } from './types'

/** Every category is graded on this one scale, so grades compare directly. */
export const BLADE_TIERS = ['X', 'S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E']

/** Same scale as the source site so rankings read identically across both. */
export const TIER_COLORS: Record<string, string> = {
  X: '#ff4466',
  'S+': '#ff7a2b',
  S: '#ffb830',
  'A+': '#c8e840',
  A: '#7adf60',
  'B+': '#40d4c0',
  B: '#38b0f0',
  'C+': '#8870ff',
  C: '#b060e0',
  'D+': '#cc5566',
  D: '#886688',
  'E+': '#556677',
  E: '#445566',
}

export const TYPE_LABELS: Record<string, string> = {
  attack: 'Attack',
  stamina: 'Stamina',
  defense: 'Defense',
  balance: 'Balance',
  special: 'Special',
  ratchet: 'Ratchet',
  bit: 'Bit',
  // Assist and over blades carry no attack/stamina type, so this chip names the
  // component instead — the same way it labels a ratchet or bit.
  assist: 'Assist',
  overblade: 'Over Blade',
}

export const TYPE_COLORS: Record<string, string> = {
  attack: '#ff5f78',
  stamina: '#7adf60',
  defense: '#ffb830',
  balance: '#b76bff',
  special: '#8be8ff',
  ratchet: '#8ba3c0',
  bit: '#8ba3c0',
  assist: '#8ba3c0',
  overblade: '#8ba3c0',
}

export const CATEGORY_LABELS: Record<PartCategory | 'all', string> = {
  all: 'All',
  blade: 'Blades',
  ratchet: 'Ratchets',
  bit: 'Bits',
  assist: 'Assist',
  overblade: 'Over Blade',
}

/** Singular forms, for prose like "Choose a ratchet" — the labels above are plural for filter chips. */
export const CATEGORY_SINGULAR: Record<PartCategory, string> = {
  blade: 'Blade',
  ratchet: 'Ratchet',
  bit: 'Bit',
  assist: 'Assist blade',
  overblade: 'Over blade',
}

export const BUY_LABELS: Record<string, string> = {
  yes: 'Worth buying',
  maybe: 'Situational',
  no: 'Skip for competitive',
}

/** Order tiers highest-first, with anything unrecognised last. */
export function tierRank(tier: string): number {
  const i = BLADE_TIERS.indexOf(tier)
  return i === -1 ? 999 : i
}

/** A tier row reads blade first — that is the part a buyer chooses around. */
const CATEGORY_ORDER: Record<PartCategory, number> = { blade: 0, ratchet: 1, bit: 2, assist: 3, overblade: 4 }

/**
 * Within one tier: category first, then strongest to the left.
 *
 * Grades are coarse — a whole row shares one — so the blended score underneath
 * is what actually separates them. The name breaks the remaining ties, which is
 * most of the unrated row, where every score is zero.
 */
export function comparePartsInTier(a: Part, b: Part): number {
  return (
    CATEGORY_ORDER[a.cat] - CATEGORY_ORDER[b.cat] ||
    (b.rating?.score ?? 0) - (a.rating?.score ?? 0) ||
    (a.nameEn ?? a.name).localeCompare(b.nameEn ?? b.name)
  )
}

/**
 * How a list of parts is ordered when the grade isn't the question.
 *
 * `tier` is the default everywhere — it is what BeyClub is for. The other two
 * read the measurements in partSpecs.json, which only bits and ratchets carry,
 * so they are offered only where they mean something.
 */
export type SpecSort = 'tier' | 'weight' | 'teeth' | 'height' | 'burst' | 'thickness'

/** Which categories carry measurements, and so can be sorted by them. */
export const MEASURED_CATEGORIES: PartCategory[] = ['bit', 'ratchet', 'blade', 'assist', 'overblade']

/**
 * Which way a measurement runs. Neither end is the obvious default — the
 * heaviest bit and the lightest are each the answer to a real question — so
 * the direction is the reader's to set.
 */
export type SortDir = 'desc' | 'asc'

/**
 * Bits have gear teeth, ratchets have ring blades: one measurement, two names.
 * `dir` is passed only for the sort actually in force, and puts the arrow on
 * that chip alone.
 */
export function specSortLabel(sort: SpecSort, cat: PartCategory, dir?: SortDir): string {
  const name = SORT_NAMES[sort] ?? (cat === 'ratchet' ? 'Protrusions' : 'Gears')
  if (sort === 'tier' || !dir) return name
  return `${name} ${dir === 'desc' ? '↓' : '↑'}`
}

const SORT_NAMES: Partial<Record<SpecSort, string>> = {
  tier: 'Tier',
  weight: 'Weight',
  height: 'Height',
  burst: 'Burst',
  thickness: 'Thickness',
}

/**
 * The sorts a category can actually honour.
 *
 * Only what the source measured: a Burst rating is a bit's alone, teeth and
 * height belong to the parts that spin on the floor, and a blade or an over
 * blade has nothing but its weight. Offering a sort a category cannot answer
 * would rank every row as unmeasured, which reads as a broken list rather than
 * an empty question.
 */
export function sortsFor(cat: PartCategory): SpecSort[] {
  if (cat === 'bit') return ['tier', 'weight', 'teeth', 'height', 'burst']
  if (cat === 'ratchet') return ['tier', 'weight', 'teeth', 'height']
  if (cat === 'assist') return ['tier', 'weight', 'thickness']
  return ['tier', 'weight']
}

/** dmm to millimetres — the source keeps tenths, so 122 reads as 12.2 mm. */
export const mm = (dmm: number) => (dmm / 10).toFixed(1)

/**
 * A part's height, as a reader should see it: one figure, or the span for the
 * ones that change. A fused bit's is measured on the ratchet's base scale, so
 * saying so stops it being read against every other bit's exposed height.
 */
export function formatHeight(spec: PartSpec): string | undefined {
  if (spec.heightDmm === undefined) return undefined
  const span =
    spec.heightAltDmm === undefined
      ? `${mm(spec.heightDmm)} mm`
      : `${mm(spec.heightDmm)}–${mm(spec.heightAltDmm)} mm`
  return spec.fused ? `base ${span}` : span
}

/**
 * By one measurement, heaviest or lightest first, with anything unmeasured at
 * the back either way.
 *
 * Unmeasured parts sort last in both directions rather than as zero: a part we
 * have no figure for is not a light part, and letting it lead an ascending list
 * would say exactly that. The name breaks ties, of which there are many — a
 * dozen bits weigh the same 2.3 g.
 */
export function compareBySpec(sort: Exclude<SpecSort, 'tier'>, dir: SortDir = 'desc') {
  const value = (p: Part) => {
    const spec = p.spec
    if (!spec) return undefined
    if (sort === 'weight') return spec.weightG
    if (sort === 'teeth') return spec.teeth
    if (sort === 'burst') return spec.burst
    if (sort === 'thickness') return spec.thicknessDmm
    // A fused bit's height is on the ratchet's base scale — a different ruler,
    // so it goes to the back with the unmeasured rather than claiming to be the
    // shortest bit in the game.
    return spec.fused ? undefined : spec.heightDmm
  }
  return (a: Part, b: Part): number => {
    const [x, y] = [value(a), value(b)]
    if (x === undefined && y === undefined) return comparePartsInTier(a, b)
    if (x === undefined) return 1
    if (y === undefined) return -1
    return (dir === 'desc' ? y - x : x - y) || (a.nameEn ?? a.name).localeCompare(b.nameEn ?? b.name)
  }
}

/**
 * 0 for a release anyone can walk in and buy, 1 for the rest.
 *
 * The sheet's product ids carry the line: `BX`, `UX` and `CX` are the numbered
 * retail releases, while `BXG` (gacha), `BXC` (collab), `BXH` and `BXA` are
 * prize, exclusive or event boxes. Read off the letters before the first dash,
 * so an unfamiliar prefix is treated as exclusive rather than silently
 * promoted over a retail box.
 *
 * The numbers are the order the lines appeared in, which `releaseOrder` reads.
 */
const RETAIL_LINES: Record<string, number> = { BX: 0, UX: 1, CX: 2 }
const standardRelease = (id: string): number =>
  id.split('-')[0].toUpperCase() in RETAIL_LINES ? 0 : 1

/**
 * 0 for a box of its own, 1 for one blade out of a box holding several.
 *
 * A third segment is a sub-code: `CX-17-03` is the third blade in the CX-17
 * blind box, where `UX-09` is a box you buy by name. Both open with a retail
 * line, so the prefix alone cannot separate them — the segment count can. A
 * reader asking where to get a blade wants the box they can walk out with,
 * not the one that might be inside the box they gambled on.
 */
const standaloneBox = (id: string): number => (id.split('-').length <= 2 ? 0 : 1)

/**
 * Release order, oldest first: line, then product number, then sub-code.
 *
 * BX came before UX before CX, and inside a line the numbers climb with the
 * release date, so the smallest tuple is the original release — the box the
 * mould first appeared in, rather than whichever later repackage happens to
 * sort first. An unfamiliar line sorts last rather than being called the
 * original.
 */
const releaseOrder = (id: string): [number, number, number] => {
  const [prefix, box, pick] = id.split('-')
  return [RETAIL_LINES[prefix.toUpperCase()] ?? 9, Number(box) || 999, Number(pick) || 0]
}

/**
 * One tile per blade and grade, not per box.
 *
 * The sheet lists every SKU a mould was ever sold in — twelve rows of 蒼龍神劍
 * across a starter, four metal coatings, a repackage and a sticker edition —
 * and each one draws its own tile. The list that results is mostly the same
 * blade over and over, which is a poor way to answer "what should I use".
 *
 * Folded on name *and* weight, which is what tells a re-release from a
 * re-tool: every Dran Sword collapses to one, but Dran Sword V2 is 2.7 g
 * heavier and stays its own entry.
 *
 * Grade folds too, because the sheet grades each box on the combo it ships
 * with: 武士星劍 is an A as CX-17-03 and a B+ as UX-09. Merging those would
 * hand one box a grade it never earned and bury the other, so they stay two
 * tiles — one in each row — and the reader sees both prices of admission.
 *
 * The survivor of a fold is the box a reader is most likely to be able to
 * buy. A plain BX / UX / CX release comes ahead of the BXG, BXC, BXH and BXA
 * lines, which are gacha, collab and event exclusives; a box of its own comes
 * ahead of one pick out of a blind box or a set; and the original release
 * comes ahead of every later repackage. Opening a fold on a prize-only box
 * would answer "where do I get this" with the one place you mostly cannot.
 *
 * Returns the counts alongside, so a folded tile can say how many boxes are
 * behind it rather than quietly hiding eleven of them.
 */
export function mergeVariants(parts: Part[]): { parts: Part[]; counts: Map<string, number> } {
  const groups = new Map<string, Part[]>()
  for (const part of parts) {
    // Weight is part of the identity here, so two rows that differ only by a
    // figure we have never measured still fold together. Grade is part of it
    // too — see above, a box keeps the grade it earned.
    const key = `${part.cat}|${part.nameEn ?? part.name}|${part.spec?.weightG ?? ''}|${part.tier}`
    const group = groups.get(key)
    if (group) group.push(part)
    else groups.set(key, [part])
  }

  const out: Part[] = []
  const counts = new Map<string, number>()
  for (const group of groups.values()) {
    const best = group.reduce((a, b) => {
      const byLine = standardRelease(a.id) - standardRelease(b.id)
      if (byLine !== 0) return byLine < 0 ? a : b
      const byBox = standaloneBox(a.id) - standaloneBox(b.id)
      if (byBox !== 0) return byBox < 0 ? a : b
      const [ra, rb] = [releaseOrder(a.id), releaseOrder(b.id)]
      const byRelease = ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2]
      if (byRelease !== 0) return byRelease < 0 ? a : b
      // Every member shares a grade by now, so this is the name breaking a
      // tie between two boxes sold in the same week.
      return comparePartsInTier(a, b) <= 0 ? a : b
    })
    out.push(best)
    counts.set(`${best.cat}-${best.id}`, group.length)
  }
  return { parts: out, counts }
}

/** The measured value a spec sort ranked on, for showing on the row that moved. */
export function specValueLabel(part: Part | undefined, sort: SpecSort): string | undefined {
  const spec = part?.spec
  if (sort === 'tier' || !spec || !part) return undefined
  if (sort === 'weight') return `${spec.weightG.toFixed(1)} g`
  if (sort === 'height') return formatHeight(spec)
  if (sort === 'burst') return spec.burst === undefined ? undefined : `Burst ${spec.burst}`
  if (sort === 'thickness')
    return spec.thicknessDmm === undefined ? undefined : `${mm(spec.thicknessDmm)} mm thick`
  if (spec.teeth === undefined) return undefined
  return `${spec.teeth} ${part.cat === 'ratchet' ? 'protrusions' : 'gears'}`
}

/** The sheet uses "-" for parts nobody has graded yet. */
export function tierLabel(tier: string): string {
  return tier === '-' ? 'Unrated' : tier
}

/**
 * Whether a part has no grade at all. Worth asking wherever a tier is drawn
 * as a badge: every real grade is one or two characters, but "Unrated" is
 * seven, so a badge sized for "S+" gets overrun by it.
 */
export const isUnrated = (tier: string): boolean => tier === '-'
