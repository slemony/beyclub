import hanziSimplified from '../data/hanziSimplified.json'
import { editDistance, normalize } from './text'
import { tierRank } from './tiers'
import type { Part } from './types'

const SIMPLIFIED = hanziSimplified as Record<string, string>

/**
 * Folds a name down to one comparable form.
 *
 * The catalogue is Traditional Chinese but plenty of Malaysian bladers type
 * Simplified, so 魔導神杖 and 魔导神杖 have to be the same search. Both sides are
 * converted to Simplified — the mapping only covers the characters our own
 * catalogue uses, which keeps it to about a hundred entries instead of shipping
 * a conversion library.
 */
export function searchKey(s: string): string {
  const n = normalize(s)
  // Skip the scan entirely for the Latin ids and names, which are most of them.
  return /[㐀-鿿]/.test(n) ? [...n].map((c) => SIMPLIFIED[c] ?? c).join('') : n
}

/**
 * Several searches at once: "aero, cx13" asks for both, not for something that
 * is both. Chinese and Japanese commas count too, since half the names on this
 * page are typed on a CJK keyboard.
 */
export function parseTerms(query: string): string[] {
  return query
    .split(/[,，、]/)
    .map((t) => searchKey(t))
    .filter(Boolean)
}

/** Word starts, so "rod" finds "Wizard Rod" and "pega" finds "Aero Pegasus". */
function tokens(part: Part): string[] {
  return (part.nameEn ?? '').split(/\s+/).map(searchKey).filter(Boolean)
}

/**
 * How well one part answers one term, 0 for not at all.
 *
 * Graded rather than boolean so results can be ordered by confidence: an exact
 * product code should outrank a blade that merely contains the same letters.
 */
export function matchScore(part: Part, term: string): number {
  const id = searchKey(part.id)
  const nameEn = searchKey(part.nameEn ?? '')
  const name = searchKey(part.name)
  const product = searchKey(part.product ?? '')

  if (id === term || nameEn === term) return 100
  if (id.startsWith(term) || nameEn.startsWith(term)) return 90
  if (tokens(part).some((t) => t.startsWith(term))) return 80

  for (const field of [id, nameEn, name, product]) {
    if (field && field.includes(term)) return 70
  }

  // Initials and skipped letters: "wzrd" or "shrkedge".
  if (nameEn && isSubsequence(term, nameEn)) return 45

  // Typos, on names only. Product codes are deliberately excluded: CX-13 and
  // CX-14 are one edit apart and are different beys, so tolerance there would
  // answer a precise question with the wrong part.
  const budget = term.length <= 5 ? 1 : 2
  for (const candidate of [nameEn, ...tokens(part)]) {
    if (!candidate) continue
    if (Math.abs(candidate.length - term.length) > budget) continue
    if (editDistance(term, candidate, budget) <= budget) return 35
  }

  return 0
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const c of haystack) {
    if (c === needle[i]) i++
    if (i === needle.length) return true
  }
  return needle.length === 0
}

/**
 * Parts matching any term, best match first.
 *
 * Ties break on tier so that when a search is broad the strongest parts lead,
 * which is what someone typing "dran" is usually after.
 */
export function searchParts(parts: Part[], query: string): Part[] {
  const terms = parseTerms(query)
  if (!terms.length) return parts

  const scored: { part: Part; score: number }[] = []
  for (const part of parts) {
    let best = 0
    for (const term of terms) {
      const score = matchScore(part, term)
      if (score > best) best = score
    }
    if (best > 0) scored.push({ part, score: best })
  }

  return scored
    .sort((a, b) => b.score - a.score || tierRank(a.part.tier) - tierRank(b.part.tier))
    .map((s) => s.part)
}
