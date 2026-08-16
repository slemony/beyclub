import { comboPartCodes, parseCombo } from './combo'
import { normalize } from './text'
import type { Part, PartCategory } from './types'

/**
 * Lookup layer over a loaded dataset: turns the bare part codes inside build
 * strings ("1-60", "UF") into real parts, and answers the reverse question —
 * which blades actually run a given ratchet or bit.
 */
export type PartIndex = {
  /** Resolve a code to a part, preferring the expected category. */
  resolve: (code: string, expected: PartCategory) => Part | undefined
  /** Blades that ship this part in the box (its stock ratchet/bit/assist/over blade). */
  bladesShipping: (part: Part) => Part[]
  /** Blades whose recommended or community build names this part. */
  bladesUsingInBuild: (part: Part) => Part[]
}

const CATEGORY_FALLBACKS: PartCategory[] = ['ratchet', 'bit', 'assist', 'overblade', 'blade']

/**
 * The bare code a part is referenced by. Assist blades are catalogued as
 * "輔助X", but every reference to them — a blade's stock column, a build
 * string, a `resolve()` call — names the bare "X". Strip the prefix so both
 * sides meet. Exported so any caller that starts from a Part's own `id`
 * (rather than a code already read off a blade's stock/combo columns) can
 * derive the same code `resolve()` expects back.
 */
export const partCode = (cat: PartCategory, id: string) =>
  cat === 'assist' ? id.replace(/^輔助/, '') : id

export function buildPartIndex(parts: Part[]): PartIndex {
  /** Category-tagged code, so a bit "J" and an assist "J" never cross-match. */
  const tag = (cat: PartCategory, code: string) => `${cat}|${normalize(code)}`

  // Exact code first, normalised as a fallback: "NR" and "Nr" are two
  // different bits on different grades, and normalize() folds both to the
  // same key, so a normalized-only map would let whichever is inserted last
  // silently resolve every reference to the other one.
  const byExact = new Map<string, Part>()
  const byKey = new Map<string, Part>()
  for (const part of parts) {
    const code = partCode(part.cat, part.id)
    byExact.set(`${code}|${part.cat}`, part)
    byKey.set(`${normalize(code)}|${part.cat}`, part)
  }

  const blades = parts.filter((p) => p.cat === 'blade')

  /**
   * The parts each blade names — kept as two sets so the detail sheet can tell
   * "ships in the box" from "named in a suggested build". Built once — a
   * per-part scan over every blade's build strings would re-parse hundreds of
   * cells on every sheet open.
   */
  const bladeUsage = blades.map((blade) => {
    const recommended = parseCombo(blade.combo)
    const community = parseCombo(blade.communityCombo)
    const a = comboPartCodes(recommended)
    const b = comboPartCodes(community)

    const buildCodes = new Set<string>()
    for (const set of [a.ratchets, b.ratchets]) {
      for (const code of set) buildCodes.add(tag('ratchet', code))
    }
    for (const set of [a.bits, b.bits]) {
      for (const code of set) buildCodes.add(tag('bit', code))
    }
    for (const set of [a.assists, b.assists]) {
      for (const code of set) buildCodes.add(tag('assist', code))
    }

    // What actually comes in the box — the original parts, kept apart from the
    // suggested build above.
    const stockCodes = new Set<string>()
    if (blade.stockRatchet) stockCodes.add(tag('ratchet', blade.stockRatchet))
    if (blade.stockBit) stockCodes.add(tag('bit', blade.stockBit))
    if (blade.stockAssist) stockCodes.add(tag('assist', blade.stockAssist))
    if (blade.stockOverblade) stockCodes.add(tag('overblade', blade.stockOverblade))

    return { blade, buildCodes, stockCodes }
  })

  const bladesWhere = (part: Part, pick: (u: (typeof bladeUsage)[number]) => Set<string>) => {
    if (part.cat === 'blade') return []
    const key = tag(part.cat, partCode(part.cat, part.id))
    return bladeUsage.filter((u) => pick(u).has(key)).map((u) => u.blade)
  }

  return {
    resolve(code, expected) {
      const key = normalize(code)
      const tryCategory = (cat: PartCategory) => byExact.get(`${code}|${cat}`) ?? byKey.get(`${key}|${cat}`)

      const direct = tryCategory(expected)
      if (direct) return direct

      // Build strings are positionally ambiguous — a bare letter can be a bit
      // or an assist. Trust the catalogue over the position it was written in.
      for (const cat of CATEGORY_FALLBACKS) {
        if (cat === expected) continue
        const found = tryCategory(cat)
        if (found) return found
      }
      return undefined
    },

    bladesShipping(part) {
      return bladesWhere(part, (u) => u.stockCodes)
    },

    bladesUsingInBuild(part) {
      return bladesWhere(part, (u) => u.buildCodes)
    },
  }
}
