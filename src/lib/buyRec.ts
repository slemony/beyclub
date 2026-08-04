import type { BuyAdvice } from './types'

/**
 * Buy verdicts are always computed here, from the grades this app blends —
 * never read from a source. A sheet's own buy column was written against its
 * own tier list, so importing it would put two different judgements on one page
 * and leave a part graded S sitting under "skip".
 */
export const TIER_SCORES: Record<string, number> = {
  X: 100,
  'S+': 90,
  S: 80,
  'A+': 70,
  A: 60,
  'B+': 50,
  B: 40,
  'C+': 30,
  C: 20,
  'D+': 15,
  D: 10,
  'E+': 5,
  E: 0,
}

/**
 * A blade is judged on the whole package: its own grade counts double, its
 * stock parts once each. Called with a bare grade for a ratchet or bit, which
 * then stands on its own.
 *
 * An ungraded part simply drops out of the average, so an unrated blade is
 * judged on the ratchet and bit in the box — and a part with nothing graded at
 * all gets no verdict rather than a bad one.
 */
export function calculateBuyRec(
  bladeTier: string,
  ratchetTier?: string,
  bitTier?: string,
  assistTier?: string,
  overbladeTier?: string,
): BuyAdvice {
  const weighted: [string | undefined, number][] = [
    [bladeTier, 2],
    [ratchetTier, 1],
    [bitTier, 1],
    [assistTier, 1],
    [overbladeTier, 1],
  ]

  let totalScore = 0
  let totalWeight = 0

  for (const [tier, weight] of weighted) {
    const score = tier ? TIER_SCORES[tier] : undefined
    if (score === undefined) continue
    totalScore += score * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return ''

  const avg = totalScore / totalWeight
  if (avg >= 60) return 'yes'
  if (avg >= 40) return 'maybe'
  return 'no'
}


export const BUY_VERDICTS: Record<
  Exclude<BuyAdvice, ''>,
  { label: string; reason: string; tone: 'good' | 'warn' | 'bad' }
> = {
  yes: {
    label: 'Worth buying',
    reason: 'Performs well competitively — a solid investment.',
    tone: 'good',
  },
  maybe: {
    label: 'Situational',
    reason: 'Has its uses, but buy it only if the budget allows.',
    tone: 'warn',
  },
  no: {
    label: 'Skip for competitive',
    reason: 'Falls behind in the current meta — worth skipping.',
    tone: 'bad',
  },
}

/**
 * The verdict grades the whole product, so a top blade packaged with weak parts
 * lands on "situational" — surprising unless we say why. This spells out the
 * arithmetic in words so the rating never looks arbitrary.
 */
export function explainVerdict(part: {
  cat: string
  tier: string
  buy: BuyAdvice
  stockRatchet?: string
  ratchetTier?: string
  stockBit?: string
  bitTier?: string
}): string {
  const base = part.buy ? BUY_VERDICTS[part.buy as Exclude<BuyAdvice, ''>].reason : ''
  if (part.cat !== 'blade') return base

  const graded: { name: string; code: string; tier: string; score: number }[] = []
  for (const [name, code, tier] of [
    ['ratchet', part.stockRatchet, part.ratchetTier],
    ['bit', part.stockBit, part.bitTier],
  ] as const) {
    if (!code || !tier) continue
    const score = TIER_SCORES[tier]
    if (score !== undefined) graded.push({ name, code, tier, score })
  }

  const bladeScore = TIER_SCORES[part.tier]

  // Nobody has graded the blade, so the verdict is about the box: say so, or
  // the reader is left wondering what an unrated part is being praised for.
  if (bladeScore === undefined) {
    if (!graded.length) return base
    const parts = graded.map((g) => `its ${g.name} ${g.code} is ${g.tier}`)
    return `The blade itself isn't ranked yet, but ${parts.join(' and ')} — this grades the parts in the box, not the blade.`
  }

  const weak = graded.filter((g) => g.score < bladeScore).map((g) => `its ${g.name} ${g.code} is only ${g.tier}`)
  const strong = graded.filter((g) => g.score >= bladeScore).map((g) => `its ${g.name} ${g.code} is ${g.tier}`)

  if (weak.length) {
    return `The blade itself grades ${part.tier}, but ${weak.join(' and ')} — you are buying it for the blade, and will want better parts to go with it.`
  }
  if (strong.length) {
    return `Graded ${part.tier}, and ${strong.join(' and ')} — good value straight out of the box.`
  }
  return base
}
