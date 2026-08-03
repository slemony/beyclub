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
  const byKey = new Map<string, Part>()
  for (const part of parts) {
    byKey.set(`${normalize(part.id)}|${part.cat}`, part)
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
    for (const set of [a.ratchets, a.bits, a.assists, b.ratchets, b.bits, b.assists]) {
      for (const code of set) codes.add(normalize(code))
    }
    // Stock parts count as usage too — that's how the bey ships.
    if (blade.stockRatchet) codes.add(normalize(blade.stockRatchet))
    if (blade.stockBit) codes.add(normalize(blade.stockBit))
    if (blade.stockAssist) codes.add(normalize(blade.stockAssist))

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
      const key = normalize(part.id)
      return bladeUsage.filter((u) => u.codes.has(key)).map((u) => u.blade)
    },
  }
}
