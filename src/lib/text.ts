/**
 * Pure string helpers shared by the app and the build scripts.
 *
 * This module must stay dependency-free: `scripts/fetch-tournament.mjs` loads it
 * directly through Node's type stripping, which only works on a file that
 * imports nothing at runtime.
 */

/** Case/space/hyphen-insensitive so "UX-03", "ux03" and "UX 03" all match. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s-]/g, '')
}

/** Drops everything but letters and digits — for matching across naming styles. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The blade a product code belongs to.
 *
 * The sheet lists colour variants, metal coatings and repackages under their own
 * codes — 魔導神杖, 魔導神杖(綠), 魔導神杖 金屬塗層:燦金 and 魔導神杖 特別版 are
 * one blade — so tournament wins and Japanese rankings have to roll up by name
 * rather than by id, or three of those four look untested.
 */
export function baseName(name: string): string {
  return name
    .replace(/[（(].*?[)）]/g, '')
    .replace(/\s.*$/, '')
    .trim()
}

/**
 * The retail product a code belongs to — "BX-35-04" to "BX-35".
 *
 * The sheet files everything a box contains under sub-codes of the box's own
 * code, so this is how a blade row finds the thing you actually buy. Two
 * segments and no more: BXG-54 and BXC-13 are whole products already, and a
 * third segment never carries meaning the first two do not.
 */
export function productCode(id: string): string {
  return id.split('-').slice(0, 2).join('-')
}

/**
 * Damerau-Levenshtein distance, bailing out once it exceeds `max`.
 *
 * Used for typo tolerance in search, and to fold misspellings in the
 * community-reported tournament data ("SliverWolf", "ColbaltDragoon") onto the
 * name they meant. The transposition case is what makes those two work — a
 * plain Levenshtein would score them the same as a genuine two-letter
 * difference.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1

  let prev2: number[] = []
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  let curr: number[] = []

  for (let i = 1; i <= a.length; i++) {
    curr = [i]
    let best = i

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)

      // Transposition: "sliver" -> "silver" is one edit, not two.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1)
      }

      curr[j] = d
      if (d < best) best = d
    }

    // Every future row is at least this expensive, so we can stop early.
    if (best > max) return max + 1

    prev2 = prev
    prev = curr
  }

  return prev[b.length]
}
