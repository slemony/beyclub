import { TIER_SCORES } from './buyRec'
import { BLADE_TIERS } from './tiers'
import type { Rating, RatingSources, RatingTerm, SourceKey } from './types'

/**
 * The Japanese list runs a five-step S–D scale rather than our thirteen-step
 * one, so its grades are spread across the same 0–100 space instead of being
 * read as if S meant the same thing on both.
 */
export const JP_TIER_SCORES: Record<string, number> = { S: 95, A: 75, B: 55, C: 30, D: 10 }

const WEIGHTS: Record<SourceKey, number> = { tournament: 0.45, community: 0.35, japan: 0.2 }

/** How much of the tournament score is the long baseline vs. the current meta. */
const RECENCY = { allTime: 0.6, recent90: 0.4 }

/** Nothing enters these tiers on opinion alone. */
export const PROVEN_ONLY = ['X', 'S+', 'S']

/** The grade a part holds when no source has rated it at all. */
export const UNRATED = '-'

/**
 * Placement counts are wildly skewed — the top blade has thousands and the
 * median has a couple of dozen — so a linear share would flatten everything
 * below the leaders into one indistinguishable band. A log share keeps the
 * ordering while leaving usable spread at the bottom.
 *
 * Normalised per category because blade, ratchet and bit counts live on
 * different scales: a bit appears in every combo, a blade in one.
 */
export function tournamentScore(
  counts: { allTime: number; recent90: number },
  top: { allTime: number; recent90: number },
): number {
  const share = (n: number, max: number) => (n > 0 && max > 0 ? Math.log1p(n) / Math.log1p(max) : 0)

  return (
    100 *
    (RECENCY.allTime * share(counts.allTime, top.allTime) +
      RECENCY.recent90 * share(counts.recent90, top.recent90))
  )
}

/**
 * What each source contributed, with weights renormalised over the sources that
 * actually produced a score.
 *
 * The blend and the breakdown panel both read this, so the arithmetic a reader
 * is shown is by construction the arithmetic that was performed. A grade the
 * scale doesn't recognise — a typo in the sheet, a tier outside the Japanese
 * S–D range — drops out here rather than silently scoring zero in one place and
 * being displayed at full weight in the other.
 */
export function ratingTerms(sources: RatingSources): RatingTerm[] {
  const scored: [SourceKey, number | undefined][] = [
    ['tournament', sources.tournament?.score],
    ['community', sources.community ? TIER_SCORES[sources.community] : undefined],
    ['japan', sources.japan ? JP_TIER_SCORES[sources.japan] : undefined],
  ]

  const present = scored.filter((t): t is [SourceKey, number] => t[1] !== undefined)
  const total = present.reduce((n, [key]) => n + WEIGHTS[key], 0)

  return present.map(([key, score]) => ({ key, score, weight: WEIGHTS[key] / total }))
}

/**
 * Blends whichever sources rate this part.
 *
 * A missing tournament record is handled by the cap rather than the blend,
 * because "nobody has won with this" is real information, while "one blogger
 * did not write about it" is not. When nothing rates the part at all the grade
 * is left unrated: an absence of evidence must not read as evidence of being
 * bad, and scoring it zero would put it at the bottom of the list.
 */
export function blendRating(sources: RatingSources): Rating {
  const terms = ratingTerms(sources)
  const capped = !sources.tournament

  if (!terms.length) {
    return { ...sources, score: 0, capped, tier: UNRATED }
  }

  const score = terms.reduce((sum, t) => sum + t.score * t.weight, 0)
  return { ...sources, score, capped, tier: scoreToTier(score, capped) }
}

/** The nearest grade on our scale, skipping the proven-only tiers when capped. */
export function scoreToTier(score: number, capped: boolean): string {
  const pool = capped ? BLADE_TIERS.filter((t) => !PROVEN_ONLY.includes(t)) : BLADE_TIERS

  return pool.reduce((best, tier) =>
    Math.abs(TIER_SCORES[tier] - score) < Math.abs(TIER_SCORES[best] - score) ? tier : best,
  )
}

/** The best grade a part can reach without a tournament record. */
export function cappedCeiling(): string {
  return BLADE_TIERS.find((t) => !PROVEN_ONLY.includes(t)) ?? BLADE_TIERS[0]
}
