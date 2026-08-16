import { partCode, type PartIndex } from './partIndex'
import { normalize } from './text'
import { tierRank } from './tiers'
import type { Part, PartCategory, SavedBuild } from './types'

/** One filled slot, with the reason it was chosen — a suggestion has to show its working. */
export type Suggested = { part: Part; why: string }

export type BuildSuggestion = Partial<Record<'ratchet' | 'bit' | 'assist' | 'overblade', Suggested>>

/** Matches collection.ts's entryKey, so an ownership filter agrees with what's stored. */
const ownKey = (part: Part) => `${part.cat}|${normalize(partCode(part.cat, part.id))}`

const bestOf = (parts: Part[], cat: PartCategory, owned?: Set<string>) => {
  const pool = parts.filter((p) => p.cat === cat && (!owned || owned.has(ownKey(p))))
  return [...pool].sort((a, b) => tierRank(a.tier) - tierRank(b.tier))[0]
}

/**
 * What to put around a blade: the ratchet and bit tournament winners actually
 * pair it with, falling back to the highest-graded part in the category when
 * the blade has no placement record to learn from.
 *
 * Every slot is gated on the blade's own box: most blades have no assist
 * blade, only CX ships an over blade, and a few UX blades integrate the
 * ratchet. Suggesting into a slot its line doesn't have would describe a bey
 * that cannot be assembled — and the editor disables those slots anyway, so
 * the suggestion would be unfillable.
 */
export function suggestBuild(blade: Part, parts: Part[], index: PartIndex, owned?: Set<string>): BuildSuggestion {
  const out: BuildSuggestion = {}
  const record = blade.rating?.tournament

  const fill = (cat: 'ratchet' | 'bit', ships: string | undefined, topCode?: string) => {
    if (!ships) return
    const top = topCode ? index.resolve(topCode, cat) : undefined
    if (top) {
      out[cat] = { part: top, why: `most used with this blade in tournaments` }
      return
    }
    const best = bestOf(parts, cat, owned)
    if (best) out[cat] = { part: best, why: `highest-graded ${cat} we have` }
  }

  fill('ratchet', blade.stockRatchet, record?.topRatchet)
  fill('bit', blade.stockBit, record?.topBit)

  // The box tells us whether this blade's line uses these slots at all.
  if (blade.stockAssist) {
    const best = bestOf(parts, 'assist', owned)
    const stock = index.resolve(blade.stockAssist, 'assist')
    const pick = best ?? stock
    if (pick) out.assist = { part: pick, why: best ? 'highest-graded assist blade' : 'the one it ships with' }
  }
  if (blade.stockOverblade) {
    const stock = index.resolve(blade.stockOverblade, 'overblade')
    if (stock) out.overblade = { part: stock, why: 'the over blade in its box' }
  }

  return out
}

/** Folds a suggestion onto a draft, leaving slots the user already chose alone. */
export function applySuggestion(build: SavedBuild, suggestion: BuildSuggestion): SavedBuild {
  const next = { ...build }
  for (const [slot, pick] of Object.entries(suggestion) as [keyof BuildSuggestion, Suggested][]) {
    // Bare code, never the catalogue's 輔助-prefixed id — that's the form
    // every other reference (and resolve()) uses.
    if (!next[slot]) next[slot] = partCode(pick.part.cat, pick.part.id)
  }
  return next
}
