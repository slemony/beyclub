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
  /** Blades whose recommended or community build names this part. */
  bladesUsing: (part: Part) => Part[]
}

const CATEGORY_FALLBACKS: PartCategory[] = ['ratchet', 'bit', 'assist', 'blade']

export function buildPartIndex(parts: Part[]): PartIndex {
  /**
   * The bare code a part is referenced by. Assist blades are catalogued as
   * "輔助X", but every reference to them — a blade's stock column, a build
   * string — names the bare "X". Strip the prefix so both sides meet.
   */
  const partCode = (cat: PartCategory, id: string) =>
    cat === 'assist' ? id.replace(/^輔助/, '') : id

  /** Category-tagged code, so a bit "J" and an assist "J" never cross-match. */
  const tag = (cat: PartCategory, code: string) => `${cat}|${normalize(code)}`

  const byKey = new Map<string, Part>()
  for (const part of parts) {
    byKey.set(`${normalize(partCode(part.cat, part.id))}|${part.cat}`, part)
  }

  const blades = parts.filter((p) => p.cat === 'blade')

  /**
   * Which codes each blade recommends. Built once — a per-part scan over every
   * blade's build strings would re-parse hundreds of cells on every sheet open.
   */
  const bladeUsage = blades.map((blade) => {
    const recommended = parseCombo(blade.combo)
    const community = parseCombo(blade.communityCombo)
    const a = comboPartCodes(recommended)
    const b = comboPartCodes(community)

    const codes = new Set<string>()
    for (const set of [a.ratchets, b.ratchets]) {
      for (const code of set) codes.add(tag('ratchet', code))
    }
    for (const set of [a.bits, b.bits]) {
      for (const code of set) codes.add(tag('bit', code))
    }
    for (const set of [a.assists, b.assists]) {
      for (const code of set) codes.add(tag('assist', code))
    }
    // Stock parts count as usage too — that's how the bey ships.
    if (blade.stockRatchet) codes.add(tag('ratchet', blade.stockRatchet))
    if (blade.stockBit) codes.add(tag('bit', blade.stockBit))
    if (blade.stockAssist) codes.add(tag('assist', blade.stockAssist))

    return { blade, codes }
  })

  return {
    resolve(code, expected) {
      const key = normalize(code)
      const direct = byKey.get(`${key}|${expected}`)
      if (direct) return direct

      // Build strings are positionally ambiguous — a bare letter can be a bit
      // or an assist. Trust the catalogue over the position it was written in.
      for (const cat of CATEGORY_FALLBACKS) {
        if (cat === expected) continue
        const found = byKey.get(`${key}|${cat}`)
        if (found) return found
      }
      return undefined
    },

    bladesUsing(part) {
      if (part.cat === 'blade') return []
      const key = tag(part.cat, partCode(part.cat, part.id))
      return bladeUsage.filter((u) => u.codes.has(key)).map((u) => u.blade)
    },
  }
}
